import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminId } from "@/lib/adminGuard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";
import { recomputePlan, isProGrantType, ADMIN_GRANTABLE_TYPES, validateGrantExpiry } from "@/lib/pro-plan";

// GET: fetch admin dashboard data
export async function GET(request: NextRequest) {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Non autorise." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "recruiters";
  const search = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const admin = createAdminClient();

  if (tab === "recruiters") {
    const { data: pending } = await admin.from("profiles")
      .select("id, full_name, slug, recruiter_company, recruiter_role, recruiter_website, recruiter_status, created_at")
      .eq("account_type", "recruiter").eq("recruiter_status", "pending")
      .order("created_at", { ascending: false });

    const { data: approved } = await admin.from("profiles")
      // `plan` : le badge « vérifié » est EFFECTIF seulement si le compte est Pro
      // (modele eco du 10/08/2026). L'admin doit voir les deux etats separement —
      // toggle pose vs badge reellement affiche au public (voir AdminClient).
      .select("id, full_name, slug, recruiter_company, recruiter_role, recruiter_website, recruiter_status, recruiter_verified, plan, is_suspended, created_at")
      .eq("account_type", "recruiter").eq("recruiter_status", "approved")
      .order("created_at", { ascending: false }).limit(50);

    // Modifications sensibles (description pro) en attente de re-validation.
    const { data: edits } = await admin.from("profiles")
      .select("id, full_name, slug, bio, bio_pending, recruiter_verified, plan, recruiter_company, created_at")
      .eq("recruiter_review_status", "pending")
      .order("created_at", { ascending: false });

    // Get emails from auth
    const enriched = async (items: typeof pending) => {
      if (!items) return [];
      return Promise.all(items.map(async (p) => {
        const { data: { user } } = await admin.auth.admin.getUserById(p.id);
        return { ...p, email: user?.email || "" };
      }));
    };

    return NextResponse.json({
      pending: await enriched(pending),
      approved: await enriched(approved),
      edits: edits ?? [],
    });
  }

  if (tab === "reports") {
    const { data: reports } = await admin.from("reports")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    // Enrich with reporter name and target info
    const enriched = await Promise.all((reports ?? []).map(async (r) => {
      const { data: reporter } = await admin.from("profiles").select("full_name, slug").eq("id", r.reporter_id).single();
      let targetName = "";
      let targetSlug = "";
      let targetOwnerId = "";
      if (r.target_type === "profile") {
        const { data: t } = await admin.from("profiles").select("full_name, slug").eq("id", r.target_id).single();
        targetName = t?.full_name || ""; targetSlug = t?.slug || ""; targetOwnerId = r.target_id;
      } else if (r.target_type === "project") {
        const { data: t } = await admin.from("projects").select("title, slug, profile_id").eq("id", r.target_id).single();
        targetName = t?.title || ""; targetSlug = t?.slug || ""; targetOwnerId = t?.profile_id || "";
      }
      // Count total reports for this target
      const { count } = await admin.from("reports").select("id", { count: "exact", head: true })
        .eq("target_type", r.target_type).eq("target_id", r.target_id).eq("status", "pending");
      const total = count || 1;
      return { ...r, reporter_name: reporter?.full_name || "", target_name: targetName, target_slug: targetSlug, target_owner_id: targetOwnerId, total_reports: total, urgent: total >= 3 };
    }));

    // Alerte prioritaire : les cibles les plus signalees remontent en tete
    // (>= 3 = urgent). Pas de blocage automatique — l'admin tranche.
    enriched.sort((a, b) => b.total_reports - a.total_reports);

    return NextResponse.json({ reports: enriched });
  }

  if (tab === "users") {
    // pro_grant_type/pro_grant_expires_at/subscription_status : necessaires
    // pour que l'admin voie l'ORIGINE du Pro (Stripe / offert / recruteur),
    // pas seulement le badge plan opaque (chantier grants, 2026-08-10).
    let query = admin.from("profiles")
      .select("id, full_name, slug, account_type, plan, is_suspended, status, created_at, pro_grant_type, pro_grant_expires_at, subscription_status")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.ilike("full_name", `%${search}%`);
    }

    const offset = (page - 1) * 20;
    const { data, count } = await query.range(offset, offset + 19);

    const enriched = await Promise.all((data ?? []).map(async (p) => {
      const { data: { user } } = await admin.auth.admin.getUserById(p.id);
      return { ...p, email: user?.email || "" };
    }));

    return NextResponse.json({ users: enriched, total: count || 0, page });
  }

  if (tab === "films") {
    const { data: pending } = await admin.from("projects")
      .select("id, title, slug, category, year, video_url, poster_url, preview_url, profile_id, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const enriched = await Promise.all((pending ?? []).map(async (p) => {
      const { data: owner } = await admin.from("profiles").select("full_name, slug").eq("id", p.profile_id).single();
      return { ...p, owner_name: owner?.full_name || "", owner_slug: owner?.slug || "" };
    }));

    return NextResponse.json({ films: enriched });
  }

  return NextResponse.json({ error: "Tab invalide." }, { status: 400 });
}

// PATCH: admin actions
export async function PATCH(request: NextRequest) {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Non autorise." }, { status: 403 });

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { action, target_id, reason } = body;
  const admin = createAdminClient();

  // Auto-protection : refuse les actions qui, appliquees a soi-meme, sortiraient
  // l'admin du back-office (suspension) ou degraderaient son propre statut
  // recruteur. Les actions "avantage a soi" (grant_pro, approve_*) restent
  // permises : admin unique, les bloquer imposerait du SQL manuel — admin_logs
  // trace tout. revoke_pro_grant sur soi reste permis pour la meme raison
  // (inoffensif : retire un avantage, ne degrade aucun statut structurel).
  // revoke_recruiter_approval rejoint SELF_BLOCKED_ACTIONS le 2026-08-10 —
  // meme famille que reject_recruiter, degraderait le statut recruteur de
  // l'admin qui l'appliquerait a lui-meme.
  // Films et signalements (approve_film, refuse_film, dismiss_report) : hors
  // perimetre, meme raison (decision produit du 07/08/2026).
  const SELF_BLOCKED_ACTIONS = ["suspend_user", "reject_recruiter", "revoke_recruiter_verified", "revoke_recruiter_approval"];
  if (SELF_BLOCKED_ACTIONS.includes(action) && target_id === adminId) {
    // Journalisation best-effort : le refus tient meme si le log echoue,
    // contrairement a finalize() ou l'ecriture metier a deja porte.
    await admin.from("admin_logs").insert({
      admin_id: adminId,
      action: "self_action_blocked",
      target_type: "profile",
      target_id,
      details: { attempted_action: action, reason: reason ?? null },
    });
    return NextResponse.json(
      { error: "Auto-protection : un admin ne peut pas appliquer cette action à son propre compte." },
      { status: 403 }
    );
  }

  // Fiabilite (audit) : chaque action = une ecriture metier + une ligne d'audit,
  // et CHAQUE ecriture est verifiee — plus de success renvoye sur echec.
  // finalize() mutualise : echec metier -> 500 explicite ; sinon journalisation
  // admin_logs, elle aussi verifiee (si elle echoue, l'action a DEJA porte :
  // on le dit tel quel plutot que de pretendre a un echec complet).
  async function finalize(
    writeError: { message: string } | null,
    actionName: string,
    targetType: string,
    details: Record<string, unknown> = {}
  ) {
    if (writeError) {
      return NextResponse.json(
        { error: `Échec de l'action ${actionName} : ${writeError.message}` },
        { status: 500 }
      );
    }
    const { error: logError } = await admin
      .from("admin_logs")
      .insert({ admin_id: adminId, action: actionName, target_type: targetType, target_id, details });
    if (logError) {
      return NextResponse.json(
        { error: `Action ${actionName} appliquée, mais journal admin non écrit : ${logError.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  }

  // Approve recruiter — approuve le STATUT, rien d'autre. La règle "recruiter ⇒
  // pro" est morte le 2026-08-10 (nouveau modèle économique) : le Pro s'achète
  // (9,99 €) ou s'offre explicitement (grant_pro), il ne se gagne plus en étant
  // approuvé. Un recruteur approuvé mais free garde son statut et son
  // éligibilité au badge « vérifié » — le badge ne s'affiche au public que s'il
  // est AUSSI Pro (double condition, arbitrée à l'affichage : rien à recalculer
  // ici, et une résiliation Stripe retire le badge sans action admin).
  // Pas d'écriture de grant, donc pas de recomputePlan : `plan` ne dépend plus
  // de cette action.
  if (action === "approve_recruiter") {
    const { error } = await admin.from("profiles").update({
      recruiter_status: "approved",
    }).eq("id", target_id);
    return finalize(error, "approve_recruiter", "profile");
  }

  // Reject recruiter
  if (action === "reject_recruiter") {
    const { error } = await admin.from("profiles").update({ recruiter_status: "rejected" }).eq("id", target_id);
    return finalize(error, "reject_recruiter", "profile", { reason });
  }

  // Suspend user
  if (action === "suspend_user") {
    const { error } = await admin.from("profiles").update({ is_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: reason || null }).eq("id", target_id);
    return finalize(error, "suspend_user", "profile", { reason });
  }

  // Reactivate user
  if (action === "reactivate_user") {
    const { error } = await admin.from("profiles").update({ is_suspended: false, suspended_at: null, suspended_reason: null }).eq("id", target_id);
    return finalize(error, "reactivate_user", "profile");
  }

  // Accorder un Pro offert (ex-set_pro, renomme le 2026-08-10 — le nom
  // different dans admin_logs date volontairement le passage au modele
  // grant). Types posables a la main : launch, vip (pas recruiter, qui ne
  // naît que de approve_recruiter — voir ADMIN_GRANTABLE_TYPES).
  if (action === "grant_pro") {
    const { grant_type, expires_at } = body;

    if (!isProGrantType(grant_type) || !ADMIN_GRANTABLE_TYPES.includes(grant_type)) {
      return NextResponse.json(
        { error: `Type de grant invalide. Valeurs acceptées : ${ADMIN_GRANTABLE_TYPES.join(", ")}.` },
        { status: 400 }
      );
    }

    // expires_at : ISO string ou null/absent. Toute autre valeur est rejetee
    // avant d'atteindre la base — evite un 500 Postgres brut si le champ est
    // mal forme cote client.
    let normalizedExpiresAt: string | null = null;
    if (expires_at !== undefined && expires_at !== null) {
      if (typeof expires_at !== "string" || Number.isNaN(Date.parse(expires_at))) {
        return NextResponse.json({ error: "Échéance invalide (date ISO attendue)." }, { status: 400 });
      }
      normalizedExpiresAt = expires_at;
    }

    // Meme regle que le CHECK Postgres profiles_pro_grant_expiry_check, mais
    // avec un message clair plutot qu'une erreur 500 brute si violee.
    const validationError = validateGrantExpiry(grant_type, normalizedExpiresAt);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Meme garde-fou que revoke_pro_grant (2026-08-10) : un grant 'recruiter'
    // existant ne doit jamais etre ecrase silencieusement par cette action.
    // Le commit precedent avait masque le bouton correspondant cote UI
    // (AdminClient.tsx), mais un appel API direct contournait ce garde
    // purement visuel — la verification doit vivre ici, cote serveur.
    const { data: current, error: readError } = await admin
      .from("profiles")
      .select("pro_grant_type")
      .eq("id", target_id)
      .single();
    if (readError || !current) {
      return NextResponse.json({ error: "Profil cible introuvable ou illisible." }, { status: 404 });
    }
    if (current.pro_grant_type === "recruiter") {
      return NextResponse.json(
        { error: "Ce profil a un Pro lié au statut recruteur approuvé — utilise \"Révoquer le statut recruteur\" (revoke_recruiter_approval) plutôt que cette action." },
        { status: 400 }
      );
    }

    const { error } = await admin.from("profiles").update({
      pro_grant_type: grant_type,
      pro_grant_expires_at: normalizedExpiresAt,
      pro_grant_granted_by: adminId,
      pro_grant_granted_at: new Date().toISOString(),
    }).eq("id", target_id);
    if (error) {
      return NextResponse.json({ error: `Échec de l'action grant_pro : ${error.message}` }, { status: 500 });
    }

    const { error: recomputeError } = await recomputePlan(admin, target_id);
    if (recomputeError) {
      return NextResponse.json(
        { error: `Grant enregistré, mais recalcul du plan échoué : ${recomputeError.message}. Le compte peut ne pas encore refléter le Pro.` },
        { status: 500 }
      );
    }

    return finalize(null, "grant_pro", "profile", { grant_type, expires_at: normalizedExpiresAt });
  }

  // Retirer un Pro offert (launch/vip). Le grant 'recruiter' est EXCLU de
  // cette action — il est structurellement lie au statut recruteur approuve
  // et ne se retire que via revoke_recruiter_approval, qui retire les deux
  // ensemble. Sans ce garde-fou, un clic ici sur un recruteur approuve le
  // laisserait "approuve" sans Pro : plus de messagerie, plus moyen de
  // recruter, sans que rien d'autre ne l'indique.
  if (action === "revoke_pro_grant") {
    const { data: current, error: readError } = await admin
      .from("profiles")
      .select("pro_grant_type")
      .eq("id", target_id)
      .single();
    if (readError || !current) {
      return NextResponse.json({ error: "Profil cible introuvable ou illisible." }, { status: 404 });
    }
    if (current.pro_grant_type === "recruiter") {
      return NextResponse.json(
        { error: "Ce Pro est lié au statut recruteur approuvé — utilise \"Révoquer le statut recruteur\" plutôt que cette action." },
        { status: 400 }
      );
    }

    const { error } = await admin.from("profiles").update({
      pro_grant_type: null,
      pro_grant_expires_at: null,
      pro_grant_granted_by: null,
      pro_grant_granted_at: null,
      pro_grant_reminder_sent_at: null,
    }).eq("id", target_id);
    if (error) {
      return NextResponse.json({ error: `Échec de l'action revoke_pro_grant : ${error.message}` }, { status: 500 });
    }

    const { error: recomputeError } = await recomputePlan(admin, target_id);
    if (recomputeError) {
      return NextResponse.json(
        { error: `Grant retiré, mais recalcul du plan échoué : ${recomputeError.message}. Le compte peut rester Pro à tort.` },
        { status: 500 }
      );
    }

    return finalize(null, "revoke_pro_grant", "profile");
  }

  // Révoquer un statut recruteur préalablement approuvé (ex. fraude détectée
  // après coup) — distinct de reject_recruiter, qui ne s'applique qu'à une
  // candidature encore pending. Retire le statut ET le grant 'recruiter' (s'il
  // est toujours présent — un admin a pu le remplacer entretemps par un autre
  // type, auquel cas on ne touche pas à ce grant sans rapport).
  if (action === "revoke_recruiter_approval") {
    const { data: current, error: readError } = await admin
      .from("profiles")
      .select("pro_grant_type")
      .eq("id", target_id)
      .single();
    if (readError || !current) {
      return NextResponse.json({ error: "Profil cible introuvable ou illisible." }, { status: 404 });
    }

    const updates: Record<string, unknown> = { recruiter_status: "rejected" };
    if (current.pro_grant_type === "recruiter") {
      updates.pro_grant_type = null;
      updates.pro_grant_expires_at = null;
      updates.pro_grant_granted_by = null;
      updates.pro_grant_granted_at = null;
      updates.pro_grant_reminder_sent_at = null;
    }

    const { error } = await admin.from("profiles").update(updates).eq("id", target_id);
    if (error) {
      return NextResponse.json({ error: `Échec de l'action revoke_recruiter_approval : ${error.message}` }, { status: 500 });
    }

    const { error: recomputeError } = await recomputePlan(admin, target_id);
    if (recomputeError) {
      return NextResponse.json(
        { error: `Statut recruteur révoqué, mais recalcul du plan échoué : ${recomputeError.message}. Le compte peut rester Pro à tort.` },
        { status: 500 }
      );
    }

    return finalize(null, "revoke_recruiter_approval", "profile", { reason });
  }

  // Approve film
  if (action === "approve_film") {
    const { error } = await admin.from("projects").update({ status: "approved" }).eq("id", target_id);
    return finalize(error, "approve_film", "project");
  }

  // Refuse film
  if (action === "refuse_film") {
    const { error } = await admin.from("projects").update({ status: "refused" }).eq("id", target_id);
    return finalize(error, "refuse_film", "project", { reason });
  }

  // --- Re-verification de la description pro d'un recruteur (chantier 2) ---

  // Approuver la modif : la version en attente devient publique.
  if (action === "approve_recruiter_edit") {
    const { data: target, error: readError } = await admin.from("profiles").select("bio_pending").eq("id", target_id).single();
    // Sans lecture fiable du brouillon, on n'ecrase PAS la bio publique
    // (sinon une lecture en echec publierait bio=null).
    if (readError || !target) {
      return NextResponse.json({ error: "Profil cible introuvable ou illisible." }, { status: 404 });
    }
    const { error } = await admin.from("profiles").update({
      bio: target.bio_pending ?? null,
      bio_pending: null,
      recruiter_review_status: "none",
      recruiter_review_reason: null,
    }).eq("id", target_id);
    return finalize(error, "approve_recruiter_edit", "profile");
  }

  // Refuser la modif : on garde l'ancienne version publique, on jette le brouillon.
  // Le motif est stocke sur le profil (recruiter_review_reason) pour etre lisible
  // par le recruteur via GET /api/dashboard/profile — admin_logs ne lui est pas
  // accessible. Nettoye a l'approbation et a toute nouvelle soumission.
  if (action === "reject_recruiter_edit") {
    const { error } = await admin.from("profiles").update({
      bio_pending: null,
      recruiter_review_status: "rejected",
      recruiter_review_reason: reason || null,
    }).eq("id", target_id);
    return finalize(error, "reject_recruiter_edit", "profile", { reason });
  }

  // Accorder le badge "recruteur verifie".
  if (action === "grant_recruiter_verified") {
    const { error } = await admin.from("profiles").update({ recruiter_verified: true, recruiter_verified_at: new Date().toISOString() }).eq("id", target_id);
    return finalize(error, "grant_recruiter_verified", "profile");
  }

  // Retirer le badge "recruteur verifie".
  if (action === "revoke_recruiter_verified") {
    const { error } = await admin.from("profiles").update({ recruiter_verified: false, recruiter_verified_at: null }).eq("id", target_id);
    return finalize(error, "revoke_recruiter_verified", "profile", { reason });
  }

  // Dismiss report
  if (action === "dismiss_report") {
    const { error } = await admin.from("reports").update({ status: "dismissed", reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq("id", target_id);
    return finalize(error, "dismiss_report", "report");
  }

  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}
