import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// POST /api/credits/request
// Body: { project_id, role, message? }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { project_id, role, message } = body;

  if (!project_id || !role) {
    return NextResponse.json({ error: "project_id et role requis." }, { status: 400 });
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

  // Notify project owner
  const { data: project } = await supabase
    .from("projects")
    .select("profile_id, title")
    .eq("id", project_id)
    .single();

  const { data: requester } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (project) {
    sendPushToUser(project.profile_id, {
      title: "Nouvelle demande de credit",
      body: `${requester?.full_name || "Quelqu'un"} veut etre credite sur "${project.title}"`,
      url: "/dashboard/projets",
    }).catch(() => {});
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
