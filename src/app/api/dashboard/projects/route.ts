import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_PROJECTS_FREE } from "@/lib/constants";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// GET: fetch user's projects with credits
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  const projectsWithCredits = await Promise.all(
    (projects ?? []).map(async (project) => {
      const { data: credits } = await supabase
        .from("project_credits")
        .select("*")
        .eq("project_id", project.id);
      return { ...project, credits: credits ?? [] };
    })
  );

  return NextResponse.json({ projects: projectsWithCredits });
}

// POST: create a new project
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  // Check project limit
  const { count } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id);

  if ((count ?? 0) >= MAX_PROJECTS_FREE) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PROJECTS_FREE} projets en version gratuite.` },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { title, category, year, video_url, description, owner_role, credits } = body;

  if (!title || !category || !video_url) {
    return NextResponse.json({ error: "Titre, categorie et URL video requis." }, { status: 400 });
  }

  const projectSlug = slugify(title) + "-" + Date.now().toString(36);

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      profile_id: user.id,
      title,
      slug: projectSlug,
      description: description || null,
      category,
      year: year || new Date().getFullYear(),
      video_url,
    })
    .select("id")
    .single();

  if (error || !project) {
    return NextResponse.json({ error: error?.message ?? "Erreur creation projet." }, { status: 500 });
  }

  // Add owner credit
  if (owner_role) {
    await supabase.from("project_credits").insert({
      project_id: project.id,
      profile_id: user.id,
      role_on_project: owner_role,
    });
  }

  // Add other credits
  if (credits && Array.isArray(credits)) {
    const creditInserts = credits
      .filter((c: { name: string; role: string }) => c.name && c.role)
      .map((c: { name: string; role: string }) => ({
        project_id: project.id,
        ghost_name: c.name,
        role_on_project: c.role,
      }));
    if (creditInserts.length > 0) {
      await supabase.from("project_credits").insert(creditInserts);
    }
  }

  return NextResponse.json({ success: true, id: project.id });
}

// DELETE: delete a project
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("id");

  if (!projectId) {
    return NextResponse.json({ error: "ID projet requis." }, { status: 400 });
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("profile_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
