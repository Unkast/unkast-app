import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminId } from "@/lib/adminGuard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

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
      .select("id, full_name, slug, recruiter_company, recruiter_role, recruiter_website, recruiter_status, recruiter_verified, is_suspended, created_at")
      .eq("account_type", "recruiter").eq("recruiter_status", "approved")
      .order("created_at", { ascending: false }).limit(50);

    // Modifications sensibles (description pro) en attente de re-validation.
    const { data: edits } = await admin.from("profiles")
      .select("id, full_name, slug, bio, bio_pending, recruiter_verified, recruiter_company, created_at")
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
    let query = admin.from("profiles")
      .select("id, full_name, slug, account_type, plan, is_suspended, status, created_at")
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
  // recruteur. Les actions "avantage a soi" (set_pro, approve_*) restent permises :
  // admin unique, les bloquer imposerait du SQL manuel — admin_logs trace tout.
  // Films et signalements (approve_film, refuse_film, dismiss_report) : hors
  // perimetre, meme raison (decision produit du 07/08/2026).
  const SELF_BLOCKED_ACTIONS = ["suspend_user", "reject_recruiter", "revoke_recruiter_verified"];
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

  // Approve recruiter — règle métier : un recruteur approuvé passe plan 'pro'.
  // (La règle "recruiter ⇒ pro" vit ici, à la validation, pas à l'inscription :
  // un recruteur en attente reste gratuit jusqu'à approbation.)
  if (action === "approve_recruiter") {
    // pro_source='admin' => Pro accordé manuellement, jamais rétrogradé par le
    // webhook Stripe (chantier 7). On ne touche pas les champs stripe_*.
    const { error } = await admin.from("profiles").update({ recruiter_status: "approved", plan: "pro", pro_since: new Date().toISOString(), pro_source: "admin" }).eq("id", target_id);
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

  // Set pro
  if (action === "set_pro") {
    // pro_source='admin' => Pro manuel, protégé du webhook (jamais rétrogradé).
    const { error } = await admin.from("profiles").update({ plan: "pro", pro_since: new Date().toISOString(), pro_source: "admin" }).eq("id", target_id);
    return finalize(error, "set_pro", "profile");
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
    }).eq("id", target_id);
    return finalize(error, "approve_recruiter_edit", "profile");
  }

  // Refuser la modif : on garde l'ancienne version publique, on jette le brouillon.
  if (action === "reject_recruiter_edit") {
    const { error } = await admin.from("profiles").update({
      bio_pending: null,
      recruiter_review_status: "rejected",
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
