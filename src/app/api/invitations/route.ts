import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: create an invitation (project owner only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, email, role } = body;

  if (!project_id || !email || !role) {
    return NextResponse.json({ error: "project_id, email et role requis." }, { status: 400 });
  }

  // Verify user owns the project
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", project_id)
    .eq("profile_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Projet introuvable ou non autorise." }, { status: 403 });
  }

  const { error } = await supabase.from("invitations").insert({
    project_id,
    email,
    role,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Cette personne a deja ete invitee." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
