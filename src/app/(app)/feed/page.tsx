import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, SERIES_CATEGORY } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";
import { Section, AnimatedCard } from "./HomeAnimations";
import Avatar from "@/components/Avatar";
import GlassCard from "@/components/ui/GlassCard";
import HeroCarousel from "./HeroCarousel";
import ConversionBanner from "./ConversionBanner";
import FilmRow, { type FilmRowItem } from "./FilmRow";
import { RestoreFilmScroll } from "@/components/FilmLink";
import { TEAM_SELECT, loadFilmTeams, type FilmTeam } from "@/lib/film-team";
import { DISPLAY_NAME_COLUMNS, displayNameOf, type DisplayNameRow } from "@/lib/profile";

export const revalidate = 300; // Cache 5 minutes

interface ProjectCard {
  id: string;
  title: string;
  slug: string;
  category: ProjectCategory;
  year: number;
  description: string | null;
  video_url: string;
  // Realisateur : credits de realisation du film, jamais son Responsable.
  director_name: string;
  director_slug: string | null;
  team_size: number;
  team_preview: FilmTeam["team_preview"];
  poster_url?: string | null;
  preview_url?: string | null;
  episode_count: number | null;
}

interface TalentCard {
  id: string;
  full_name: string;
  slug: string;
  avatar_url: string | null;
  location: string | null;
  is_available: boolean;
  roles: string[];
  project_count: number;
}

interface ContentRow {
  title: string;
  href: string;
  items: ProjectCard[];
}

// Une rangee ne recoit que ce qu'elle affiche (pas la description ni l'apercu d'equipe).
function toRowItem(p: ProjectCard): FilmRowItem {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    category: p.category,
    year: p.year,
    director_name: p.director_name,
    team_size: p.team_size,
    image: p.preview_url || p.poster_url || null,
    episode_count: p.episode_count,
  };
}

// Films d'une liste. La visibilite (public / membres seulement / depublie) est
// appliquee par la RLS : toutes les lectures de cette page passent par le client
// utilisateur, aucune par le service role.
const PROJECT_SELECT = `
  id, title, slug, category, year, description, video_url, poster_url, preview_url, episode_count,
  profiles!projects_profile_id_fkey ( is_suspended ),
  ${TEAM_SELECT}
`;

type RawProject = Record<string, unknown> & { id: string };

// Retire les films dont le Responsable est suspendu (chantier 3). Un film sans
// Responsable (profile_id null) n'a pas de profil joint : rien a tester.
function notSuspended(p: RawProject) {
  return !(p.profiles as { is_suspended?: boolean } | null)?.is_suspended;
}

function toCard(p: RawProject, team: FilmTeam): ProjectCard {
  return {
    id: p.id,
    title: p.title as string,
    slug: p.slug as string,
    category: p.category as ProjectCategory,
    year: p.year as number,
    description: p.description as string | null,
    video_url: p.video_url as string,
    ...team,
    poster_url: (p.poster_url as string | null) ?? null,
    preview_url: (p.preview_url as string | null) ?? null,
    episode_count: (p.episode_count as number | null) ?? null,
  };
}

async function getHomeData() {
  const supabase = await createClient();
  // Visiteur non connecte : il ne lit aucune ligne de project_credits (RLS),
  // son equipe passe par public_project_credits (un seul appel pour la page).
  const { data: { user } } = await supabase.auth.getUser();

  const categoriesToShow: ProjectCategory[] = ["court-metrage", SERIES_CATEGORY, "publicite", "clip", "documentaire"];

  const [recentResult, ...categoryResults] = await Promise.all([
    supabase
      .from("projects")
      .select(PROJECT_SELECT)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(12),
    ...categoriesToShow.map((cat) =>
      supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .eq("category", cat)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(10)
    ),
  ]);

  const recentRaw = ((recentResult.data ?? []) as unknown as RawProject[]).filter(notSuspended);
  const categoryRaw = categoryResults.map((r) => ((r.data ?? []) as unknown as RawProject[]).filter(notSuspended));

  const teamOf = await loadFilmTeams(supabase, !user, [...recentRaw, ...categoryRaw.flat()]);

  const recentAll: ProjectCard[] = recentRaw.map((p) => toCard(p, teamOf(p.id)));

  // Projects with poster images first (for the carousel)
  const recent = [
    ...recentAll.filter((p) => p.poster_url),
    ...recentAll.filter((p) => !p.poster_url),
  ];

  // Category rows
  const categoryRows: ContentRow[] = [];
  for (let i = 0; i < categoriesToShow.length; i++) {
    const cat = categoriesToShow[i];
    // Meme condition qu'avant : la ligne existe des que la categorie a un film lisible.
    if ((categoryResults[i].data ?? []).length > 0) {
      const items = categoryRaw[i].map((p) => toCard(p, teamOf(p.id)));
      const title = cat === SERIES_CATEGORY ? "Séries" : CATEGORY_LABELS[cat];
      categoryRows.push({ title, href: `/recherche?category=${cat}`, items });
    }
  }

  // Talents — single query with join for roles
  const { data: rawTalents } = await supabase
    .from("profiles")
    .select(`
      id, ${DISPLAY_NAME_COLUMNS}, slug, avatar_url, location, is_available,
      profile_roles ( role_name ),
      projects!projects_profile_id_fkey ( id )
    `)
    .eq("status", "approved")
    .not("is_suspended", "is", true) // chantier 3 : suspendus hors vue publique
    .order("created_at", { ascending: false })
    .limit(12);

  const talents: TalentCard[] = (rawTalents ?? []).map((t: Record<string, unknown>) => {
    const roles = t.profile_roles as { role_name: string }[] | null;
    const projects = t.projects as { id: string }[] | null;
    return {
      id: t.id as string,
      full_name: displayNameOf(t as DisplayNameRow) as string,
      slug: t.slug as string,
      avatar_url: t.avatar_url as string | null,
      location: t.location as string | null,
      is_available: t.is_available as boolean,
      roles: (roles ?? []).map((r) => r.role_name),
      project_count: projects?.length ?? 0,
    };
  });

  return { recent, categoryRows, talents };
}

export default async function Home() {
  const { recent, categoryRows, talents } = await getHomeData();

  return (
    <div>
      <RestoreFilmScroll />
      <div className="mx-auto w-full max-w-[1600px]">
      {/* À LA UNE */}
      {recent.length > 0 && (
        <HeroCarousel projects={recent.slice(0, 5)} />
      )}

      {/* CONTENT ROWS */}
      <div className="space-y-8 lg:space-y-12 py-6 lg:py-10">
        {recent.length > 5 && (
          <Section>
            <FilmRow title="Projets récents" href="/recherche?type=projets" items={recent.slice(5).map(toRowItem)} />
          </Section>
        )}

        {categoryRows.map((row) => (
          <Section key={row.title}>
            <FilmRow title={row.title} href={row.href} items={row.items.map(toRowItem)} />
          </Section>
        ))}

        {talents.length > 0 && (
          <Section>
            <section className="glow-lime px-5 sm:px-8 lg:px-12 xl:px-16">
              <div className="flex items-end justify-between mb-3 lg:mb-4">
                <h2 className="text-[15px] lg:text-xl font-bold text-text-primary tracking-tight">Talents à découvrir</h2>
                <Link href="/recherche?type=talents" className="group/all inline-flex items-center gap-1 text-[11px] lg:text-xs text-text-tertiary hover:text-lime transition-colors duration-300">
                  Tout voir
                  <span className="transition-transform duration-300 group-hover/all:translate-x-0.5">→</span>
                </Link>
              </div>
              <div className="flex gap-3 lg:gap-4 overflow-x-auto no-scrollbar -mx-5 px-5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 xl:-mx-16 xl:px-16 pt-2 -mt-2 pb-6 -mb-5">
                {talents.map((talent) => (
                  <AnimatedCard key={talent.id}>
                    <Link
                      href={`/profil/${talent.slug}`}
                      className="flex-shrink-0 w-48 lg:w-56 group block"
                    >
                      <GlassCard className="h-full p-3.5 lg:p-4 transition-colors duration-base group-hover:border-white/20">
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <Avatar url={talent.avatar_url} name={talent.full_name} size={40} shape="rounded" style={{ borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-semibold text-text-primary group-hover:text-lime transition-colors duration-300 truncate">
                              {talent.full_name}
                            </span>
                            {talent.is_available && <span className="w-1.5 h-1.5 rounded-full bg-teal flex-shrink-0" />}
                          </div>
                          {talent.location && (
                            <p className="text-[10px] text-text-tertiary truncate">{talent.location}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {talent.roles.slice(0, 2).map((role) => (
                          <span key={role} className="px-2 py-0.5 rounded-pill border border-lime/20 bg-lime/10 text-lime text-[9px] font-semibold">
                            {role}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-text-tertiary mt-2">
                        {talent.project_count} projet{talent.project_count > 1 ? "s" : ""}
                      </p>
                      </GlassCard>
                    </Link>
                  </AnimatedCard>
                ))}
              </div>
            </section>
          </Section>
        )}
      </div>
      </div>

      <ConversionBanner />
    </div>
  );
}
