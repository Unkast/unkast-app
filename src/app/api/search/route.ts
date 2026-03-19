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

  // --- Talents ---
  if (type === "all" || type === "talents") {
    let query = supabase
      .from("profiles")
      .select("id, full_name, slug, avatar_url, location, is_available, bio, created_at")
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
      // Enrich with roles and project count
      talents = await Promise.all(
        data.map(async (profile) => {
          const { data: roles } = await supabase
            .from("profile_roles")
            .select("role_name")
            .eq("profile_id", profile.id);

          const { count } = await supabase
            .from("projects")
            .select("*", { count: "exact", head: true })
            .eq("profile_id", profile.id);

          return {
            ...profile,
            roles: (roles ?? []).map((r) => r.role_name),
            project_count: count ?? 0,
          };
        })
      );

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

  // --- Projects ---
  if (type === "all" || type === "projets") {
    let query = supabase
      .from("projects")
      .select("id, title, slug, description, category, year, video_url, profile_id, created_at");

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
      // Enrich with owner name
      projects = await Promise.all(
        data.map(async (project) => {
          const { data: owner } = await supabase
            .from("profiles")
            .select("full_name, slug")
            .eq("id", project.profile_id)
            .single();

          return {
            ...project,
            owner_name: owner?.full_name ?? "",
            owner_slug: owner?.slug ?? "",
          };
        })
      );
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
