import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markProjectEdited } from "@/lib/project-edit";
import { sendPushToUser } from "@/lib/push";
import { getActiveUser } from "@/lib/auth-guard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// PATCH: accept or refuse a credit request (gestionnaires du film)
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
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !creditReq) {
    return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  }

  // Gestionnaire du film : Responsable ou co-gestionnaire (la fonction parle de
  // l'appelant, d'ou le client utilisateur).
  const { data: isManager } = await supabase.rpc("is_project_manager", { p_project_id: creditReq.project_id });
  if (!isManager) {
    return NextResponse.json({ error: "Non autorise." }, { status: 403 });
  }

  if (status === "accepted") {
    // Aucun client n'a le droit d'inserer un credit (migration 20261020) : la route
    // l'ecrit en service role, APRES avoir verifie ci-dessus que l'appelant gere le
    // film et que la demande vient bien de la personne creditee.
    const admin = createAdminClient();
    const { error: creditError } = await admin.from("project_credits").insert({
      project_id: creditReq.project_id,
      profile_id: creditReq.requester_id,
      role_on_project: creditReq.role,
    });
    if (creditError) {
      console.error("[credits] insertion du credit impossible :", creditError);
      return NextResponse.json({ error: "Crédit impossible à enregistrer, réessaie." }, { status: 500 });
    }
    await markProjectEdited(admin, creditReq.project_id, guard.user.id);
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
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const { id } = await params;

  // La policy ne laisse supprimer que sa propre demande en attente.
  const { data: deleted, error } = await supabase
    .from("credit_requests")
    .delete()
    .eq("id", id)
    .eq("requester_id", user.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Demande introuvable ou déjà traitée." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
