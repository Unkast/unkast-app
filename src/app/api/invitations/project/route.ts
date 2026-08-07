import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { getActiveUser } from "@/lib/auth-guard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// POST: create a project invitation (creator only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("account_type, full_name").eq("id", user.id).single();
  if (profile?.account_type !== "creator") {
    return NextResponse.json({ error: "Seuls les créateurs peuvent inviter." }, { status: 403 });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { project_id, invited_profile_id, role, message } = body;

  if (!project_id || !invited_profile_id || !role) {
    return NextResponse.json({ error: "project_id, invited_profile_id et role requis." }, { status: 400 });
  }

  // Verify project belongs to creator
  const { data: project } = await admin.from("projects").select("id, title, profile_id").eq("id", project_id).eq("profile_id", user.id).single();
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  // Insert invitation
  const { error } = await admin.from("project_invitations").insert({
    project_id,
    invited_profile_id,
    inviter_id: user.id,
    role,
    message: message || null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Tu as déjà invité cette personne sur ce projet." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Push notification
  sendPushToUser(invited_profile_id, {
    title: "Nouvelle invitation",
    body: `${profile.full_name} t'invite à rejoindre "${project.title}"`,
    url: "/moi",
  }).catch(() => {});

  return NextResponse.json({ success: true }, { status: 201 });
}

// GET: list invitations (for activity tab)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const admin = createAdminClient();

  // Invitations received (as talent)
  const { data: received } = await admin.from("project_invitations")
    .select("*").eq("invited_profile_id", user.id).order("created_at", { ascending: false });

  const receivedEnriched = await Promise.all((received ?? []).map(async (inv) => {
    const { data: project } = await admin.from("projects").select("title, slug, poster_url").eq("id", inv.project_id).single();
    const { data: inviter } = await admin.from("profiles").select("full_name, slug").eq("id", inv.inviter_id).single();
    return { ...inv, project_title: project?.title, project_slug: project?.slug, project_poster: project?.poster_url, inviter_name: inviter?.full_name, inviter_slug: inviter?.slug };
  }));

  // Invitations sent (as creator)
  const { data: sent } = await admin.from("project_invitations")
    .select("*").eq("inviter_id", user.id).order("created_at", { ascending: false });

  const sentEnriched = await Promise.all((sent ?? []).map(async (inv) => {
    const { data: project } = await admin.from("projects").select("title, slug").eq("id", inv.project_id).single();
    const { data: invited } = await admin.from("profiles").select("full_name, slug, avatar_url").eq("id", inv.invited_profile_id).single();
    return { ...inv, project_title: project?.title, project_slug: project?.slug, invited_name: invited?.full_name, invited_slug: invited?.slug, invited_avatar: invited?.avatar_url };
  }));

  return NextResponse.json({ received: receivedEnriched, sent: sentEnriched });
}
