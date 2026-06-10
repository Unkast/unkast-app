import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const type = searchParams.get("type") ?? "all"; // all | talents | projets
  const category = searchParams.get("category") ?? "";
  const location = searchParams.get("location") ?? "";
  const role = searchParams.get("role") ?? "";
  const sort = searchParams.get("sort") ?? "pertinence"; // pertinence | date | projets

  const supabase = await createClient();

  let talents: Record<string, unknown>[] = [];
  let projects: Record<string, unknown>[] = [];

  // --- Talents (single query with joins) ---
  if (type === "all" || type === "talents") {
    let query = supabase
      .from("profiles")
      .select(`
        id, full_name, slug, avatar_url, location, is_available, bio, created_at,
        profile_roles ( role_name ),
        projects ( id )
      `)
      .eq("status", "approved");

    if (q) {
      query = query.or(`full_name.ilike.%${q}%,bio.ilike.%${q}%`);
    }
    if (location) {
      query = query.ilike("location", `%${location}%`);
    }

    if (sort === "date") {
      query = query.order("created_at", { ascending: false });
    } else {
      query = query.order("full_name", { ascending: true });
    }

    query = query.limit(50);
    const { data } = await query;

    if (data) {
      talents = data.map((profile: Record<string, unknown>) => {
        const roles = profile.profile_roles as { role_name: string }[] | null;
        const profileProjects = profile.projects as { id: string }[] | null;
        return {
          id: profile.id,
          full_name: profile.full_name,
          slug: profile.slug,
          avatar_url: profile.avatar_url,
          location: profile.location,
          is_available: profile.is_available,
          bio: profile.bio,
          created_at: profile.created_at,
          roles: (roles ?? []).map((r) => r.role_name),
          project_count: profileProjects?.length ?? 0,
        };
      });

      // Filter by role if specified
      if (role) {
        const roleLower = role.toLowerCase();
        talents = talents.filter((t) =>
          (t.roles as string[]).some((r) =>
            r.toLowerCase().includes(roleLower)
          )
        );
      }

      // Sort by project count if requested
      if (sort === "projets") {
        talents.sort(
          (a, b) => (b.project_count as number) - (a.project_count as number)
        );
      }
    }
  }

  // --- Projects (single query with join) ---
  if (type === "all" || type === "projets") {
    let query = supabase
      .from("projects")
      .select(`
        id, title, slug, description, category, year, video_url, profile_id, created_at,
        profiles!projects_profile_id_fkey ( full_name, slug )
      `)
      .eq("status", "approved");

    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }
    if (category) {
      query = query.eq("category", category);
    }

    if (sort === "date") {
      query = query.order("created_at", { ascending: false });
    } else {
      query = query.order("year", { ascending: false });
    }

    query = query.limit(50);
    const { data } = await query;

    if (data) {
      projects = data.map((project: Record<string, unknown>) => {
        const owner = project.profiles as { full_name: string; slug: string } | null;
        return {
          id: project.id,
          title: project.title,
          slug: project.slug,
          description: project.description,
          category: project.category,
          year: project.year,
          video_url: project.video_url,
          profile_id: project.profile_id,
          created_at: project.created_at,
          owner_name: owner?.full_name ?? "",
          owner_slug: owner?.slug ?? "",
        };
      });
    }
  }

  return NextResponse.json({
    talents,
    projects,
    counts: {
      talents: talents.length,
      projects: projects.length,
      total: talents.length + projects.length,
    },
  });
}
