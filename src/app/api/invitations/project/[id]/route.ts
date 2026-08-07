import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { getActiveUser } from "@/lib/auth-guard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// PATCH: accept or refuse an invitation (invited talent only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const { id } = await params;
  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { status } = body;

  if (!status || !["accepted", "refused"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch invitation
  const { data: inv } = await admin.from("project_invitations").select("*").eq("id", id).single();
  if (!inv) return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });
  if (inv.invited_profile_id !== user.id) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  // Update status
  await admin.from("project_invitations").update({ status }).eq("id", id);

  if (status === "accepted") {
    // Add to project credits
    await admin.from("project_credits").insert({
      project_id: inv.project_id,
      profile_id: user.id,
      role_on_project: inv.role,
    });

    // Notify creator
    const { data: talent } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
    const { data: project } = await admin.from("projects").select("title").eq("id", inv.project_id).single();
    sendPushToUser(inv.inviter_id, {
      title: "Invitation acceptée !",
      body: `${talent?.full_name} a rejoint l'équipe de "${project?.title}"`,
      url: "/moi",
    }).catch(() => {});
  } else {
    // Notify creator of refusal
    const { data: talent } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
    sendPushToUser(inv.inviter_id, {
      title: "Invitation déclinée",
      body: `${talent?.full_name} a décliné ton invitation`,
      url: "/moi",
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}

// DELETE: cancel an invitation (creator only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const { id } = await params;
  const admin = createAdminClient();
  await admin.from("project_invitations").delete().eq("id", id).eq("inviter_id", user.id);

  return NextResponse.json({ success: true });
}
