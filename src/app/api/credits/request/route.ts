import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { getActiveUser } from "@/lib/auth-guard";
import { readJsonBody, invalidBodyResponse, isText, MAX_NOTE_LENGTH, MAX_ROLE_LENGTH } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";

// POST /api/credits/request
// Body: { project_id, role, message? }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { project_id, role, message } = body;

  if (!project_id || !role) {
    return NextResponse.json({ error: "project_id et role requis." }, { status: 400 });
  }
  if (!isText(project_id, 64) || !isText(role, MAX_ROLE_LENGTH) || !isText(message, MAX_NOTE_LENGTH, true)) {
    return NextResponse.json({ error: "Rôle ou message trop long." }, { status: 400 });
  }
  // Chaque demande notifie les gestionnaires du film : 20 par heure et par compte.
  if (!(await checkRateLimit(`credit-request:${user.id}`, 20, 3600))) {
    return NextResponse.json({ error: "Trop de demandes. Réessaie plus tard." }, { status: 429 });
  }

  // Check user is not already credited
  const { count: creditCount } = await supabase
    .from("project_credits")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project_id)
    .eq("profile_id", user.id);

  if ((creditCount ?? 0) > 0) {
    return NextResponse.json({ error: "Tu es deja credite sur ce projet." }, { status: 409 });
  }

  // Insert credit request
  const { error } = await supabase.from("credit_requests").insert({
    project_id,
    requester_id: user.id,
    role,
    message: message || null,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Tu as deja une demande en cours pour ce projet." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notifie les gestionnaires du film : Responsable (absent si le film n'en a
  // plus) et co-gestionnaires. Lecture par le client de confiance : le demandeur
  // ne lit pas project_managers.
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("profile_id, title")
    .eq("id", project_id)
    .single();

  if (project) {
    const { data: managers } = await admin
      .from("project_managers")
      .select("profile_id")
      .eq("project_id", project_id);

    const recipients = new Set<string>((managers ?? []).map((m) => m.profile_id));
    if (project.profile_id) recipients.add(project.profile_id);

    for (const recipientId of recipients) {
      sendPushToUser(recipientId, {
        title: "Nouvelle demande de credit",
        body: `${guard.profile.display_name || "Quelqu'un"} veut etre credite sur "${project.title}"`,
        url: "/dashboard/projets",
      }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
