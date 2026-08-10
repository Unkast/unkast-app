import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputePlan } from "@/lib/pro-plan";
import { sendProExpiryReminderEmail } from "@/lib/email";

// Cron Vercel (vercel.json, une fois par jour) — chantier grants, commit 5.
//
// Deux passes INDEPENDANTES, chacune STRICTEMENT filtree (jamais de balayage
// ni de recompute global sur `profiles` — voir profiles_pro_grant_expiry_idx,
// migration 20260810_pro_grants.sql) :
//   1. Grants 'launch' echus -> recompute_plan() par profil concerne.
//   2. Grants a echeance (launch ou vip date) expirant sous 7 jours, jamais
//      relances -> email de rappel, colonne temoin posee UNIQUEMENT si l'envoi
//      a reellement reussi.
//
// Authentification (verifiee sur la doc Vercel courante, 2026-08 —
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs,
// PAS de memoire) : Vercel envoie `Authorization: Bearer ${CRON_SECRET}` sur
// chaque invocation programmee. Verifie AVANT toute autre chose, sinon
// n'importe qui connaissant l'URL publique pourrait forcer une expiration ou
// spammer les rappels.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // --------------------------------------------------------------------------
  // 1. Grants 'launch' echus -> recompute_plan()
  // --------------------------------------------------------------------------
  // Filtre STRICT sur pro_grant_type='launch' (pas 'vip', pas 'recruiter') :
  // seule la nature dont l'echeance est OBLIGATOIRE est traitee ici. Les
  // colonnes du grant ne sont PAS nettoyees (temoin conserve en base — voir
  // commentaire pro_grant_expires_at dans la migration) ; recompute_plan()
  // se contente de reevaluer `plan` a partir de l'etat courant (grant expire
  // = ne compte plus), sans jamais toucher a une autre ligne que celle visee.
  const { data: expiredLaunch, error: expiredQueryError } = await admin
    .from("profiles")
    .select("id")
    .eq("pro_grant_type", "launch")
    .lt("pro_grant_expires_at", nowIso);

  if (expiredQueryError) {
    console.error("[cron/pro-expiry] lecture des grants launch échus échouée :", expiredQueryError);
    return NextResponse.json({ error: "Lecture des grants échus échouée." }, { status: 500 });
  }

  let recomputed = 0;
  const recomputeErrors: string[] = [];
  if (expiredLaunch && expiredLaunch.length > 0) {
    const results = await Promise.all(
      expiredLaunch.map((p) => recomputePlan(admin, p.id))
    );
    results.forEach((r, i) => {
      const profileId = expiredLaunch[i].id;
      if (r.error) {
        recomputeErrors.push(`${profileId}: ${r.error.message}`);
        console.error(`[cron/pro-expiry] recompute_plan échoué pour ${profileId} :`, r.error);
      } else {
        recomputed++;
      }
    });
  }

  // --------------------------------------------------------------------------
  // 2. Rappel J-7 — grants a echeance, pas encore expires, jamais relances
  // --------------------------------------------------------------------------
  // `.gt(nowIso)` exclut les grants deja expires (deja traites, ou un 'vip' a
  // echeance passee que la passe 1 ne touche pas — pas de "c'est bientot fini"
  // a envoyer sur quelque chose de deja termine). `.lte(in7DaysIso)` borne la
  // fenetre a 7 jours. `.is(reminder_sent_at, null)` = jamais relance.
  const in7DaysIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: reminderCandidates, error: reminderQueryError } = await admin
    .from("profiles")
    .select("id, full_name, pro_grant_expires_at")
    .not("pro_grant_type", "is", null)
    .not("pro_grant_expires_at", "is", null)
    .gt("pro_grant_expires_at", nowIso)
    .lte("pro_grant_expires_at", in7DaysIso)
    .is("pro_grant_reminder_sent_at", null);

  if (reminderQueryError) {
    console.error("[cron/pro-expiry] lecture des candidats au rappel J-7 échouée :", reminderQueryError);
    return NextResponse.json({ error: "Lecture des candidats au rappel échouée." }, { status: 500 });
  }

  let reminderSent = 0;
  let reminderFailed = 0;
  // Sequentiel (pas Promise.all) : volume attendu minime (grants a echeance
  // rares), et chaque envoi conditionne une ecriture DB propre a lui — pas de
  // gain a paralleliser un appel a un service tiers (Resend) pour ce cas.
  for (const profile of reminderCandidates ?? []) {
    const { data: { user } } = await admin.auth.admin.getUserById(profile.id);
    if (!user?.email) {
      reminderFailed++;
      console.error(`[cron/pro-expiry] rappel J-7 impossible pour ${profile.id} : aucun email Auth associé.`);
      continue;
    }

    const result = await sendProExpiryReminderEmail({
      to: user.email,
      fullName: profile.full_name,
      expiresAt: profile.pro_grant_expires_at as string,
    });

    // CONTRAINTE : pro_grant_reminder_sent_at n'est posee QUE si l'envoi a
    // reellement reussi (result.sent === true). lib/email.ts renvoie
    // {sent:false, reason:'no_api_key'} en silence tant que RESEND_API_KEY
    // n'est pas branchee — si on posait la colonne quand meme, le rappel
    // serait marque envoye sans l'avoir ete et ne repartirait plus jamais.
    if (result.sent) {
      const { error: markError } = await admin
        .from("profiles")
        .update({ pro_grant_reminder_sent_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (markError) {
        // Email parti mais colonne non ecrite : risque de doublon demain (le
        // profil restera candidat). Prefere ce risque a l'inverse (colonne
        // posee sans envoi confirme), qui empecherait tout rappel futur.
        console.error(`[cron/pro-expiry] rappel envoyé à ${profile.id} mais pro_grant_reminder_sent_at non écrit :`, markError);
      }
      reminderSent++;
    } else {
      reminderFailed++;
      console.error(
        `[cron/pro-expiry] rappel J-7 NON envoyé pour ${profile.id} (raison: ${result.reason}) — pro_grant_reminder_sent_at reste NULL, nouvelle tentative au prochain passage.`
      );
    }
  }

  return NextResponse.json({
    expired_launch: {
      matched: expiredLaunch?.length ?? 0,
      recomputed,
      errors: recomputeErrors,
    },
    reminders: {
      candidates: reminderCandidates?.length ?? 0,
      sent: reminderSent,
      failed: reminderFailed,
    },
  });
}
