import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";
import { EnterItem, EnterList } from "@/components/motion";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import { TEAM_SELECT, loadFilmTeams } from "@/lib/film-team";
import FilmPoster from "@/components/FilmPoster";

export const revalidate = 300; // Cache 5 minutes (était absent → aucun cache)

const VALID_CATEGORIES: ProjectCategory[] = [
  "court-metrage", "moyen-metrage", "long-metrage", "publicite", "clip", "documentaire", "bande-demo", "scene-extrait",
];

const PAGE_SIZE = 30;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const label = CATEGORY_LABELS[slug as ProjectCategory];
  if (!label) return { title: "Catégorie — Unkast" };
  return { title: `${label} — Unkast` };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  if (!VALID_CATEGORIES.includes(slug as ProjectCategory)) {
    notFound();
  }

  const category = slug as ProjectCategory;
  const label = CATEGORY_LABELS[category];
  const catColor = CATEGORY_COLORS[category];

  const supabase = await createClient();
  // Visiteur non connecté : son équipe passe par public_project_credits.
  const { data: { user } } = await supabase.auth.getUser();

  // Une seule requête, bornée. Client utilisateur : la visibilité (public /
  // membres seulement / dépublié) est appliquée par la RLS. Le réalisateur vient
  // des crédits de réalisation, plus du Responsable (profile_id, qui peut être null).
  const { data } = await supabase
    .from("projects")
    .select(`
      id, title, slug, category, year, description, video_url, profile_id, poster_url, preview_url,
      ${TEAM_SELECT}
    `)
    .eq("status", "approved")
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const projects = (data ?? []) as unknown as {
    id: string; title: string; slug: string; year: number;
    poster_url: string | null; preview_url: string | null; project_credits?: unknown;
  }[];
  const teamOf = await loadFilmTeams(supabase, !user, projects);

  const enrichedProjects = projects.map((p) => ({
    ...p,
    project_credits: undefined,
    director_name: teamOf(p.id).director_name,
  }));

  const featured = enrichedProjects[0] ?? null;
  const rest = enrichedProjects.slice(1);

  return (
    <EnterList className="mx-auto w-full max-w-[1600px] pb-8 lg:px-12 lg:pb-12 xl:px-16">
      {/* Header */}
      <EnterItem className="px-5 pt-5 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-sheen text-[30px] lg:text-[40px] font-semibold" style={{ letterSpacing: "-0.5px" }}>
            {label}
          </h1>
          <Badge variant="neutral" className="font-mono">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: catColor }} aria-hidden="true" />
            {enrichedProjects.length} film{enrichedProjects.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </EnterItem>

      {enrichedProjects.length === 0 ? (
        /* Empty state */
        <EnterItem className="px-4 lg:px-1">
          <GlassCard radius="panel" className="mx-auto max-w-md px-6 py-12 text-center">
            <span className="glass mx-auto mb-5 flex size-16 items-center justify-center rounded-pill" aria-hidden="true">
              <svg className="w-7 h-7" style={{ color: catColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4V2m0 2v2m0-2H5m2 0h2M3 20h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v10a2 2 0 002 2zM15 12l-4 2.5v-5l4 2.5z" />
              </svg>
            </span>
            <p className="text-base font-semibold text-text-primary mb-1">Aucun film dans cette catégorie</p>
            <p className="text-sm text-text-secondary mb-6">Sois le premier à publier</p>
            <Button href="/rejoindre">Publier un film</Button>
          </GlassCard>
        </EnterItem>
      ) : (
        <>
          {/* Featured project */}
          {featured && (
            <EnterItem className="px-4 lg:px-1">
              {/* Film en tête : affiche entière dans son cadre 16:9, titre et infos à côté
                  (dessous sur mobile). Jamais de texte sur l'affiche, jamais d'image rognée. */}
              <Link
                href={`/projet/${featured.slug}`}
                className="group mb-4 grid gap-3 lg:mb-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-center lg:gap-8"
              >
                <FilmPoster
                  src={featured.preview_url || featured.poster_url}
                  alt={featured.title}
                  sizes="(max-width: 1024px) 100vw, 700px"
                  framed
                  priority
                  className="rounded-panel border border-white/[0.11] shadow-[0_18px_40px_rgba(0,0,0,0.55)] transition-[border-color] duration-base ease-glass group-hover:border-white/20"
                />
                <div className="min-w-0 px-1">
                  <p className="truncate text-lg font-semibold text-text-primary transition-colors duration-base group-hover:text-lime lg:text-3xl lg:whitespace-normal" style={{ letterSpacing: "-0.3px" }}>
                    {featured.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-text-secondary lg:text-sm">{featured.director_name && `${featured.director_name} · `}{featured.year}</p>
                </div>
              </Link>
            </EnterItem>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <EnterItem className="grid grid-cols-2 gap-2.5 px-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-4 lg:px-1">
              {rest.map((p) => (
                <Link
                  key={p.id}
                  href={`/projet/${p.slug}`}
                  className="group block"
                >
                  <GlassCard className="h-full p-2.5 transition-[translate,border-color,box-shadow] duration-base ease-glass group-hover:border-white/20 motion-safe:group-hover:-translate-y-1">
                    <FilmPoster src={p.poster_url} alt={p.title} sizes="(max-width: 768px) 50vw, 320px" framed className="rounded-media shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
                      {!p.poster_url && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="glass-strong flex size-11 items-center justify-center rounded-pill" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-text-primary translate-x-px"><path d="M8 5v14l11-7z" /></svg>
                          </span>
                        </div>
                      )}
                    </FilmPoster>
                    <div className="mt-2.5 px-1 pb-0.5">
                      <p className="text-[13px] font-semibold text-text-primary group-hover:text-lime transition-colors truncate leading-tight">
                        {p.title}
                      </p>
                      <p className="mt-1 text-[11px] text-text-secondary truncate">{p.director_name && `${p.director_name} · `}{p.year}</p>
                    </div>
                  </GlassCard>
                </Link>
              ))}
            </EnterItem>
          )}
        </>
      )}
    </EnterList>
  );
}
