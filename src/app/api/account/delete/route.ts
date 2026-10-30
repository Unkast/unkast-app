import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { sendAccountDeletedEmail } from "@/lib/email";
import { ADMIN_ACCOUNT_TYPE } from "@/lib/adminSession";

type Admin = ReturnType<typeof createAdminClient>;

// POST { email } : le membre connecte supprime son propre compte (RGPD, Google Play).
// Le compte vient TOUJOURS de la session, jamais du body : l'email saisi ne sert
// qu'a confirmer l'intention. Une session d'un autre compte ne peut supprimer que
// ce compte-la, et seulement si elle tape son propre email.
//
// Ordre : session, Origin, limite, email, admin et suspension, Stripe, films solo,
// suppression. Tout ce qui precede la suppression peut arreter la route sans rien
// changer. Ce qui suit (Storage, lignes liees a l'email, limites, email) est fait
// au mieux : un echec est logue, jamais renvoye au membre, le compte etant deja supprime.
//
// En base (migration 20261101_account_deletion.sql), la suppression de auth.users
// declenche en cascade celle du profil, et deux triggers BEFORE DELETE :
// - keep_credit_name_on_profile_delete : ses credits sur les films des autres
//   gardent son nom affiche ;
// - transfer_projects_on_profile_delete : ses films solo (solo_projects_of) sont
//   supprimes, les autres passent au co-gestionnaire le plus ancien ou restent
//   depublies sans Responsable.

// Abonnement Stripe encore facturable : tout statut sauf ceux deja termines.
const ENDED_SUBSCRIPTION = new Set(["canceled", "incomplete_expired"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Ta session a expiré. Reconnecte-toi." }, { status: 401 });
  }

  // Une page d'un autre site ne peut pas declencher la suppression avec les cookies
  // du membre : l'en-tete Origin doit etre celui de l'adresse appelee.
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
  }

  if (!(await checkRateLimit(`account-delete:${user.id}`, 5, 3600))) {
    return NextResponse.json({ error: "Trop de tentatives. Réessaie dans une heure." }, { status: 429 });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("account_type, is_admin, is_suspended, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("[account-delete] lecture du profil impossible :", profileError);
    return NextResponse.json({ error: "Vérification impossible, réessaie." }, { status: 503 });
  }
  if (profile?.is_admin || profile?.account_type === ADMIN_ACCOUNT_TYPE) {
    return NextResponse.json({ error: "Un compte admin ne se supprime pas ici." }, { status: 403 });
  }

  const typed = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const accountEmail = (user.email ?? "").trim().toLowerCase();
  if (!accountEmail || typed !== accountEmail) {
    return NextResponse.json(
      { code: "email_mismatch", error: "Cet email ne correspond pas à ton compte." },
      { status: 400 }
    );
  }
  // Decision du 30/10/2026 : un compte suspendu reste sur la demande par email.
  if (profile?.is_suspended) {
    return NextResponse.json(
      { error: "Ton compte est suspendu : écris-nous pour le supprimer." },
      { status: 403 }
    );
  }

  // Resiliation immediate, sans remboursement. Echec = rien n'est supprime : un
  // membre sans compte ne doit jamais continuer a payer.
  if (profile?.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: "all", limit: 100 });
      for (const sub of subs.data) {
        if (!ENDED_SUBSCRIPTION.has(sub.status)) await stripe.subscriptions.cancel(sub.id);
      }
    } catch (err) {
      console.error(`[account-delete] resiliation Stripe impossible pour ${user.id} :`, err);
      return NextResponse.json(
        { error: "Impossible de résilier ton abonnement Pro pour le moment. Rien n'a été supprimé, réessaie plus tard." },
        { status: 502 }
      );
    }
  }

  // Avant la suppression : films qui vont partir (meme regle que le trigger) et
  // justificatifs de ses revendications (les lignes partent en cascade).
  const [soloRes, claimsRes] = await Promise.all([
    admin.rpc("solo_projects_of", { p_profile_id: user.id }),
    admin.from("project_claims").select("document_path").eq("claimant_id", user.id).not("document_path", "is", null),
  ]);
  if (soloRes.error || claimsRes.error) {
    console.error("[account-delete] lecture avant suppression impossible :", soloRes.error ?? claimsRes.error);
    return NextResponse.json({ error: "Suppression impossible pour le moment. Rien n'a été supprimé, réessaie." }, { status: 503 });
  }
  // setof uuid : PostgREST rend des valeurs seules ou des objets d'une colonne selon
  // sa version ; les deux formes sont lues.
  const soloIds = ((soloRes.data ?? []) as unknown[]).map((r) =>
    String(r !== null && typeof r === "object" ? Object.values(r)[0] : r)
  );
  const claimDocs = (claimsRes.data ?? []).map((c) => c.document_path as string);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error(`[account-delete] deleteUser echoue pour ${user.id} :`, deleteError);
    return NextResponse.json({ error: "Suppression impossible pour le moment. Réessaie dans un instant." }, { status: 500 });
  }

  await cleanUp(admin, user.id, accountEmail, soloIds, claimDocs);

  const mail = await sendAccountDeletedEmail({ to: user.email! });
  if (!mail.sent) console.error(`[account-delete] email de confirmation non envoye (${mail.reason})`);

  // Efface les cookies de session de cette requete (le compte n'existe plus).
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});

  return NextResponse.json({ success: true });
}

// Nettoyage apres suppression : chaque etape est independante et ne leve jamais.
async function cleanUp(admin: Admin, userId: string, email: string, soloIds: string[], claimDocs: string[]) {
  const step = async (label: string, run: () => PromiseLike<{ error: unknown }>) => {
    try {
      const { error } = await run();
      if (error) console.error(`[account-delete] nettoyage « ${label} » :`, error);
    } catch (err) {
      console.error(`[account-delete] nettoyage « ${label} » :`, err);
    }
  };

  // Dossier d'un bucket : liste puis suppression des fichiers qu'il contient.
  const emptyFolder = (bucket: string, folder: string) =>
    step(`${bucket}/${folder}`, async () => {
      const { data, error } = await admin.storage.from(bucket).list(folder);
      if (error || !data?.length) return { error };
      return admin.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`));
    });

  // Films vraiment supprimes : un credit ajoute entre la lecture et la suppression
  // garde le film, et ses fichiers avec.
  let goneIds: string[] = [];
  if (soloIds.length) {
    const { data, error } = await admin.from("projects").select("id").in("id", soloIds);
    if (error) console.error("[account-delete] relecture des films impossible, Storage des films conserve :", error);
    else {
      const still = new Set((data ?? []).map((p) => p.id as string));
      goneIds = soloIds.filter((id) => !still.has(id));
    }
  }

  // ilike sans joker : % et _ (frequent dans un email) sont echappes.
  const exactEmail = email.replace(/[\\%_]/g, "\\$&");

  await Promise.all([
    emptyFolder("avatars", userId),
    ...goneIds.flatMap((id) => [emptyFolder("posters", id), emptyFolder("claims", id)]),
    claimDocs.length ? step("claims (justificatifs)", () => admin.storage.from("claims").remove(claimDocs)) : null,
    step("invitations recues", () => admin.from("invitations").delete().ilike("email", exactEmail)),
    step("contact_requests envoyees", () => admin.from("contact_requests").delete().ilike("from_email", exactEmail)),
    step("waitlist", () => admin.from("waitlist").delete().ilike("email", exactEmail)),
    step("limites (compte)", () => admin.from("rate_limits").delete().like("key", `%:${userId}`)),
    step("limites (email)", () => admin.from("rate_limits").delete().in("key", [`pw-reset:${email}`, `resend-confirm:${email}`])),
  ]);
}
