import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// PATCH: accept or refuse a credit request (project owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const { id } = await params;
  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { status } = body;

  if (!status || !["accepted", "refused"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  // Fetch the credit request
  const { data: creditReq, error: fetchError } = await supabase
    .from("credit_requests")
    .select("*, projects!inner(profile_id, id)")
    .eq("id", id)
    .single();

  if (fetchError || !creditReq) {
    return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  }

  // Verify user is project owner
  const project = creditReq.projects as { profile_id: string; id: string };
  if (project.profile_id !== user.id) {
    return NextResponse.json({ error: "Non autorise." }, { status: 403 });
  }

  if (status === "accepted") {
    // Insert into project_credits
    await supabase.from("project_credits").insert({
      project_id: creditReq.project_id,
      profile_id: creditReq.requester_id,
      role_on_project: creditReq.role,
    });
  }

  // Update credit request status
  const { error: updateError } = await supabase
    .from("credit_requests")
    .update({ status })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Notify requester
  if (status === "accepted") {
    const { data: proj } = await supabase
      .from("projects")
      .select("title")
      .eq("id", creditReq.project_id)
      .single();

    sendPushToUser(creditReq.requester_id, {
      title: "Credit accepte !",
      body: `Tu as ete credite sur "${proj?.title || "un projet"}"`,
      url: `/projet/${creditReq.project_id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}

// DELETE: cancel a credit request (requester only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from("credit_requests")
    .delete()
    .eq("id", id)
    .eq("requester_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
