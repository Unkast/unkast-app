import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";
import { parseCreditRoles } from "@/lib/credits";
import { projectAccess } from "@/lib/project-invitations";

type Params = { params: Promise<{ id: string; creditId: string }> };

// Un credit de l'equipe d'un film (onglet « Créditer »). Service role apres controle :
//  - PATCH  : changer le role. Responsable et co-gestionnaires.
//  - DELETE : retirer la personne. Responsable seul (decision du 30/10/2026) ; un
//             membre se retire lui-meme par DELETE /api/dashboard/credits. Retirer un
//             credit sans compte supprime aussi son invitation par email (cascade).

async function loadCredit(admin: ReturnType<typeof createAdminClient>, projectId: string, creditId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(creditId)) return null;
  const { data } = await admin
    .from("project_credits")
    .select("id, profile_id, role_on_project")
    .eq("id", creditId)
    .eq("project_id", projectId)
    .maybeSingle();
  return data;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id, creditId } = await params;
  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  // Les roles de la personne sur ce film : des metiers de la liste, jamais du texte libre.
  const role = parseCreditRoles(body.roles ?? body.role);
  if (!role) {
    return NextResponse.json({ error: "Choisis des métiers dans la liste (6 au plus)." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { project } = await projectAccess(supabase, admin, id, guard.user.id);
  if (!project) {
    return NextResponse.json({ error: "Réservé aux gestionnaires du film." }, { status: 403 });
  }
  const credit = await loadCredit(admin, id, creditId);
  if (!credit) return NextResponse.json({ error: "Crédit introuvable." }, { status: 404 });

  const { error } = await admin.from("project_credits").update({ role_on_project: role }).eq("id", credit.id);
  if (error) {
    // 23505 : la personne a deja une autre ligne avec ce role sur ce film.
    if (error.code === "23505") {
      return NextResponse.json({ error: "Cette personne a déjà ce rôle sur ce film." }, { status: 409 });
    }
    console.error("[projects/credits] changement de role :", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id, creditId } = await params;

  const admin = createAdminClient();
  const { project, isOwner } = await projectAccess(supabase, admin, id, guard.user.id);
  if (!project || !isOwner) {
    return NextResponse.json({ error: "Seul le Responsable du film retire une personne de l'équipe." }, { status: 403 });
  }
  const credit = await loadCredit(admin, id, creditId);
  if (!credit) return NextResponse.json({ error: "Crédit introuvable." }, { status: 404 });

  const { error } = await admin.from("project_credits").delete().eq("id", credit.id);
  if (error) {
    console.error("[projects/credits] retrait :", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
