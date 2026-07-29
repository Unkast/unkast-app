import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_PROJECTS_FREE, MAX_PROJECTS_PRO } from "@/lib/constants";
import { slugify, extractVideoKey } from "@/lib/utils";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

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

  // Plafond plan-aware : 2 films (free) / 30 films (pro). Plan lu cote serveur.
  const { data: planRow } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  const projectLimit = planRow?.plan === "pro" ? MAX_PROJECTS_PRO : MAX_PROJECTS_FREE;

  const { count } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id);

  if ((count ?? 0) >= projectLimit) {
    return NextResponse.json(
      { error: `Maximum ${projectLimit} films pour ton offre actuelle.` },
      { status: 400 }
    );
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { title, category, year, video_url, description, owner_role, credits } = body;

  if (!title || !category || !video_url) {
    return NextResponse.json({ error: "Titre, categorie et URL video requis." }, { status: 400 });
  }

  // Anti-vol d'œuvre (chantier 9) : une même vidéo ne peut être revendiquée que
  // par un seul projet. On compare un identifiant canonique (youtube:<id> /
  // vimeo:<id>), pas l'URL brute. Si la plateforme n'est pas reconnue
  // (video_key null), aucune unicité n'est appliquée.
  const video_key = extractVideoKey(video_url);
  if (video_key) {
    const { data: dup } = await supabase
      .from("projects")
      .select("id")
      .eq("video_key", video_key)
      .limit(1)
      .maybeSingle();
    if (dup) {
      return NextResponse.json(
        { error: "Cette vidéo est déjà référencée sur Unkast." },
        { status: 409 }
      );
    }
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
      video_key,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !project) {
    // Filet de sécurité : si la vérif applicative a été contournée (course),
    // l'index unique partiel (code 23505) tranche → message propre.
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Cette vidéo est déjà référencée sur Unkast." },
        { status: 409 }
      );
    }
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
