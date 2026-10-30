import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { projectAccess } from "@/lib/project-invitations";

type Params = { params: Promise<{ id: string }> };

// DELETE: annuler une invitation PAR EMAIL encore en attente (onglet « Créditer »).
// Le lien recu ne fonctionne plus. Le credit sans compte reste dans l'equipe : le
// retirer est une autre action (DELETE /api/projects/[id]/credits/[creditId]).
// Responsable du film ou auteur de l'invitation. Service role apres controle.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });

  const admin = createAdminClient();
  const { data: inv } = await admin.from("invitations").select("id, project_id, inviter_id, status").eq("id", id).maybeSingle();
  if (!inv) return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });

  const { project, isOwner } = await projectAccess(supabase, admin, inv.project_id, guard.user.id);
  if (!project || (!isOwner && inv.inviter_id !== guard.user.id)) {
    return NextResponse.json({ error: "Réservé au Responsable du film ou à l'auteur de l'invitation." }, { status: 403 });
  }
  if (inv.status === "accepted") {
    return NextResponse.json({ error: "Cette invitation a déjà été acceptée." }, { status: 409 });
  }

  const { error } = await admin.from("invitations").delete().eq("id", id);
  if (error) {
    console.error("[invitations] annulation :", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
