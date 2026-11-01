// Films reels de la page de vente : publics, approuves, Responsable non suspendu.
// Lecture avec la cle publique SANS session (comme sitemap.ts) : la RLS repond
// comme a un visiteur, rien de reserve aux membres ne peut sortir ici.
import { createClient } from "@supabase/supabase-js";
import { CATEGORY_LABELS } from "@/lib/constants";
import { directorNames } from "@/lib/credits";
import { fetchVisitorCredits } from "@/lib/film-team";
import type { ProjectCategory, PublicProjectCredit } from "@/types/database";
import type { SiteFilm } from "./ui";

// Initiales « C.M », quel que soit le format recu (initiales visiteur « C. M. »,
// nom complet d'un realisateur ou d'un credit sans compte).
const initials = (name: string) =>
  name.split(/[\s.]+/).filter(Boolean).map((w) => w[0].toUpperCase()).join(".");

type Row = {
  id: string;
  slug: string;
  title: string;
  category: ProjectCategory;
  year: number | null;
  poster_url: string | null;
  preview_url: string | null;
  profiles: { is_suspended: boolean | null } | null;
};

export async function loadSiteFilms(limit = 16): Promise<SiteFilm[]> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, title, category, year, poster_url, preview_url, profiles!projects_profile_id_fkey ( is_suspended )")
    .eq("status", "approved")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit * 2);
  if (error) {
    // La page reste servie : les blocs de films sont simplement masques.
    console.error("[site] lecture des films impossible :", error.message);
    return [];
  }

  const rows = ((data ?? []) as unknown as Row[]).filter((p) => p.slug && !p.profiles?.is_suspended);
  // Films avec image d'abord : ce sont eux qui portent le hero et le catalogue.
  const films = [...rows.filter((p) => p.preview_url || p.poster_url), ...rows.filter((p) => !(p.preview_url || p.poster_url))].slice(0, limit);

  const credits = await fetchVisitorCredits(supabase as unknown as Parameters<typeof fetchVisitorCredits>[0], films.map((p) => p.id));
  const byFilm = new Map<string, PublicProjectCredit[]>();
  for (const c of credits) byFilm.set(c.project_id, [...(byFilm.get(c.project_id) ?? []), c]);

  return films.map((p) => {
    const team = byFilm.get(p.id) ?? [];
    return {
      slug: p.slug,
      title: p.title,
      category: CATEGORY_LABELS[p.category] ?? p.category,
      year: p.year,
      poster: p.preview_url || p.poster_url,
      director: directorNames(team.map((c) => ({ role_on_project: c.role_on_project, name: c.display_name }))) || null,
      team: team.filter((c) => c.display_name).slice(0, 4).map((c) => initials(c.display_name!)),
      teamCount: team.length,
    };
  });
}
