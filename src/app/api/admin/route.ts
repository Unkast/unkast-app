import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return null;
  return user.id;
}

// GET: fetch admin dashboard data
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const adminId = await isAdmin(supabase);
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
      if (r.target_type === "profile") {
        const { data: t } = await admin.from("profiles").select("full_name, slug").eq("id", r.target_id).single();
        targetName = t?.full_name || ""; targetSlug = t?.slug || "";
      } else if (r.target_type === "project") {
        const { data: t } = await admin.from("projects").select("title, slug").eq("id", r.target_id).single();
        targetName = t?.title || ""; targetSlug = t?.slug || "";
      }
      // Count total reports for this target
      const { count } = await admin.from("reports").select("id", { count: "exact", head: true })
        .eq("target_type", r.target_type).eq("target_id", r.target_id).eq("status", "pending");
      const total = count || 1;
      return { ...r, reporter_name: reporter?.full_name || "", target_name: targetName, target_slug: targetSlug, total_reports: total, urgent: total >= 3 };
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
  const supabase = await createClient();
  const adminId = await isAdmin(supabase);
  if (!adminId) return NextResponse.json({ error: "Non autorise." }, { status: 403 });

  const body = await request.json();
  const { action, target_id, reason } = body;
  const admin = createAdminClient();

  // Approve recruiter — règle métier : un recruteur approuvé passe plan 'pro'.
  // (La règle "recruiter ⇒ pro" vit ici, à la validation, pas à l'inscription :
  // un recruteur en attente reste gratuit jusqu'à approbation.)
  if (action === "approve_recruiter") {
    // pro_source='admin' => Pro accordé manuellement, jamais rétrogradé par le
    // webhook Stripe (chantier 7). On ne touche pas les champs stripe_*.
    await admin.from("profiles").update({ recruiter_status: "approved", plan: "pro", pro_since: new Date().toISOString(), pro_source: "admin" }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "approve_recruiter", target_type: "profile", target_id, details: {} });
    return NextResponse.json({ success: true });
  }

  // Reject recruiter
  if (action === "reject_recruiter") {
    await admin.from("profiles").update({ recruiter_status: "rejected" }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "reject_recruiter", target_type: "profile", target_id, details: { reason } });
    return NextResponse.json({ success: true });
  }

  // Suspend user
  if (action === "suspend_user") {
    await admin.from("profiles").update({ is_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: reason || null }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "suspend_user", target_type: "profile", target_id, details: { reason } });
    return NextResponse.json({ success: true });
  }

  // Reactivate user
  if (action === "reactivate_user") {
    await admin.from("profiles").update({ is_suspended: false, suspended_at: null, suspended_reason: null }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "reactivate_user", target_type: "profile", target_id, details: {} });
    return NextResponse.json({ success: true });
  }

  // Set pro
  if (action === "set_pro") {
    // pro_source='admin' => Pro manuel, protégé du webhook (jamais rétrogradé).
    await admin.from("profiles").update({ plan: "pro", pro_since: new Date().toISOString(), pro_source: "admin" }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "set_pro", target_type: "profile", target_id, details: {} });
    return NextResponse.json({ success: true });
  }

  // Approve film
  if (action === "approve_film") {
    await admin.from("projects").update({ status: "approved" }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "approve_film", target_type: "project", target_id, details: {} });
    return NextResponse.json({ success: true });
  }

  // Refuse film
  if (action === "refuse_film") {
    await admin.from("projects").update({ status: "refused" }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "refuse_film", target_type: "project", target_id, details: { reason } });
    return NextResponse.json({ success: true });
  }

  // --- Re-verification de la description pro d'un recruteur (chantier 2) ---

  // Approuver la modif : la version en attente devient publique.
  if (action === "approve_recruiter_edit") {
    const { data: target } = await admin.from("profiles").select("bio_pending").eq("id", target_id).single();
    await admin.from("profiles").update({
      bio: target?.bio_pending ?? null,
      bio_pending: null,
      recruiter_review_status: "none",
    }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "approve_recruiter_edit", target_type: "profile", target_id, details: {} });
    return NextResponse.json({ success: true });
  }

  // Refuser la modif : on garde l'ancienne version publique, on jette le brouillon.
  if (action === "reject_recruiter_edit") {
    await admin.from("profiles").update({
      bio_pending: null,
      recruiter_review_status: "rejected",
    }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "reject_recruiter_edit", target_type: "profile", target_id, details: { reason } });
    return NextResponse.json({ success: true });
  }

  // Accorder le badge "recruteur verifie".
  if (action === "grant_recruiter_verified") {
    await admin.from("profiles").update({ recruiter_verified: true, recruiter_verified_at: new Date().toISOString() }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "grant_recruiter_verified", target_type: "profile", target_id, details: {} });
    return NextResponse.json({ success: true });
  }

  // Retirer le badge "recruteur verifie".
  if (action === "revoke_recruiter_verified") {
    await admin.from("profiles").update({ recruiter_verified: false, recruiter_verified_at: null }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "revoke_recruiter_verified", target_type: "profile", target_id, details: { reason } });
    return NextResponse.json({ success: true });
  }

  // Dismiss report
  if (action === "dismiss_report") {
    await admin.from("reports").update({ status: "dismissed", reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq("id", target_id);
    await admin.from("admin_logs").insert({ admin_id: adminId, action: "dismiss_report", target_type: "report", target_id, details: {} });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}
