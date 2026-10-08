// Equipe et realisateur d'un film pour les pages de lecture (feed, categories,
// recherche, page film, profil).
//
// - Le nom du realisateur vient des credits de realisation (src/lib/credits.ts),
//   jamais du Responsable du film. Aucun credit de realisation = aucun nom.
// - Un visiteur non connecte ne lit aucune ligne de project_credits (RLS) : son
//   equipe passe par la fonction public_project_credits, en UN appel pour tous
//   les films de la page.
import type { createClient } from "@/lib/supabase/server";
import { directorNames, isDirectorRole } from "@/lib/credits";
import { DISPLAY_NAME_COLUMNS, displayNameOf, type DisplayNameRow } from "@/lib/profile";
import type { PublicProjectCredit } from "@/types/database";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Fragment de select a imbriquer sous `projects` (lu par les membres connectes). */
export const TEAM_SELECT = `project_credits ( role_on_project, ghost_name, profiles ( ${DISPLAY_NAME_COLUMNS}, slug ) )`;

type MemberCredit = {
  role_on_project: string;
  ghost_name: string | null;
  profiles: (DisplayNameRow & { slug: string }) | null;
};

export type FilmTeam = {
  /** Noms des realisateurs separes par une virgule, chaine vide si aucun. */
  director_name: string;
  /** Profil du realisateur, seulement s'il est seul et qu'il a un profil lisible. */
  director_slug: string | null;
  team_size: number;
};

const NO_TEAM: FilmTeam = { director_name: "", director_slug: null, team_size: 0 };

function summarize(credits: { role_on_project: string; name: string | null; slug: string | null }[]): FilmTeam {
  const directors = credits.filter((c) => isDirectorRole(c.role_on_project) && c.name);
  const names = new Set(directors.map((c) => c.name));
  return {
    director_name: directorNames(credits),
    director_slug: names.size === 1 ? directors.find((c) => c.slug)?.slug ?? null : null,
    team_size: credits.length,
  };
}

/** Equipe d'une liste de films, lisible par un visiteur (initiales hors realisation). */
export async function fetchVisitorCredits(supabase: Supabase, projectIds: string[]): Promise<PublicProjectCredit[]> {
  if (projectIds.length === 0) return [];
  const { data } = await supabase.rpc("public_project_credits", { p_project_ids: [...new Set(projectIds)] });
  return (data ?? []) as PublicProjectCredit[];
}

/**
 * Realisateur et taille d'equipe de chaque film.
 * Membre : depuis les credits imbriques (TEAM_SELECT). Visiteur : un seul appel rpc.
 */
export async function loadFilmTeams(
  supabase: Supabase,
  isVisitor: boolean,
  projects: { id: string; project_credits?: unknown }[]
): Promise<(projectId: string) => FilmTeam> {
  const teams = new Map<string, FilmTeam>();

  if (isVisitor) {
    const byProject = new Map<string, PublicProjectCredit[]>();
    for (const c of await fetchVisitorCredits(supabase, projects.map((p) => p.id))) {
      byProject.set(c.project_id, [...(byProject.get(c.project_id) ?? []), c]);
    }
    for (const [id, credits] of byProject) {
      teams.set(
        id,
        summarize(credits.map((c) => ({ role_on_project: c.role_on_project, name: c.display_name, slug: c.profile_slug })))
      );
    }
  } else {
    for (const p of projects) {
      const credits = (p.project_credits ?? []) as MemberCredit[];
      teams.set(
        p.id,
        summarize(
          credits.map((c) => ({
            role_on_project: c.role_on_project,
            name: displayNameOf(c.profiles) ?? c.ghost_name,
            slug: c.profiles?.slug ?? null,
          }))
        )
      );
    }
  }

  return (projectId) => teams.get(projectId) ?? NO_TEAM;
}

/**
 * Credit visiteur au format d'un credit lu par un membre : les initiales vont
 * dans ghost_name, et `profile` n'existe que pour un credit de realisation dont
 * le profil est approuve. Les pages affichent ainsi les deux cas avec le meme code.
 */
export function visitorCreditAsMemberCredit(c: PublicProjectCredit) {
  return {
    id: c.id,
    project_id: c.project_id,
    profile_id: c.profile_id,
    ghost_name: c.display_name,
    role_on_project: c.role_on_project,
    profiles:
      c.profile_id && c.profile_slug
        ? { id: c.profile_id, full_name: c.display_name ?? "", slug: c.profile_slug, avatar_url: c.avatar_url, location: null }
        : null,
  };
}
