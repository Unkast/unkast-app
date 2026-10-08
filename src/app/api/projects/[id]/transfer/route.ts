import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_PROJECTS_FREE, MAX_PROJECTS_PRO } from "@/lib/constants";
import { sendPushToUser } from "@/lib/push";
import { getActiveUser } from "@/lib/auth-guard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// Codes renvoyes par transfer_project.
const ERRORS: Record<string, [number, string]> = {
  not_found: [404, "Film introuvable."],
  forbidden: [403, "Seul le Responsable du film peut le transférer."],
  not_manager: [400, "Le film ne peut être transféré qu'à un co-gestionnaire."],
  limit_reached: [400, "Cette personne a atteint son plafond de films."],
};

// POST: transferer le film a un co-gestionnaire (Responsable seul)
export async function POST(
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
  const { profile_id } = body;
  if (!profile_id || typeof profile_id !== "string") {
    return NextResponse.json({ error: "profile_id requis." }, { status: 400 });
  }

  // Plafond du plan du destinataire, lu cote serveur.
  const admin = createAdminClient();
  const { data: recipient } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", profile_id)
    .maybeSingle();

  const { data: result, error } = await admin.rpc("transfer_project", {
    p_actor: user.id,
    p_project: id,
    p_new_owner: profile_id,
    p_limit: recipient?.plan === "pro" ? MAX_PROJECTS_PRO : MAX_PROJECTS_FREE,
  });

  if (error || !result) {
    // 22P02 : identifiant qui n'est pas un uuid.
    if (error?.code === "22P02") {
      return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    }
    console.error("[projects/transfer] transfer_project:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
  if (!result.ok) {
    const [status, message] = ERRORS[result.code] ?? [500, "Erreur serveur."];
    return NextResponse.json({ code: result.code, error: message }, { status });
  }

  // Notification best-effort au nouveau Responsable.
  const { data: project } = await admin.from("projects").select("title").eq("id", id).maybeSingle();
  sendPushToUser(profile_id, {
    title: "Tu es Responsable d'un film",
    body: `${guard.profile.full_name ?? "Quelqu'un"} t'a transféré "${project?.title ?? "un film"}"`,
    url: "/moi",
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
