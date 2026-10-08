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

  // Une seule requête avec join sur le propriétaire (au lieu d'un N+1 :
  // 1 requête profiles par projet) + limite (la liste n'était pas bornée).
  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id, title, slug, category, year, description, video_url, profile_id, poster_url, preview_url,
      profiles!projects_profile_id_fkey ( full_name, slug )
    `)
    .eq("status", "approved")
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const enrichedProjects = (projects ?? []).map((p) => {
    const owner = p.profiles as unknown as { full_name: string; slug: string } | null;
    return {
      ...p,
      profiles: undefined,
      owner_name: owner?.full_name ?? "",
      owner_slug: owner?.slug ?? "",
    };
  });

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
              <Link
                href={`/projet/${featured.slug}`}
                className="glass group relative mb-4 block aspect-video overflow-hidden rounded-panel shadow-[0_18px_40px_rgba(0,0,0,0.55)] transition-[border-color] duration-base ease-glass hover:border-white/20 lg:mb-6 lg:aspect-[21/9]"
              >
                {featured.preview_url ? (
                  <img
                    src={featured.preview_url}
                    alt={featured.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="glass-strong flex size-14 items-center justify-center rounded-pill" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-text-primary translate-x-px"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 lg:p-6">
                  <p className="truncate text-lg lg:text-2xl font-semibold text-white group-hover:text-lime transition-colors duration-base" style={{ letterSpacing: "-0.3px" }}>
                    {featured.title}
                  </p>
                  <p className="truncate text-xs lg:text-sm text-white/70">{featured.owner_name} · {featured.year}</p>
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
                    <div className="relative aspect-video w-full overflow-hidden rounded-media bg-white/5 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
                      {p.poster_url ? (
                        <img
                          src={p.poster_url}
                          alt={p.title}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="glass-strong flex size-11 items-center justify-center rounded-pill" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-text-primary translate-x-px"><path d="M8 5v14l11-7z" /></svg>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2.5 px-1 pb-0.5">
                      <p className="text-[13px] font-semibold text-text-primary group-hover:text-lime transition-colors truncate leading-tight">
                        {p.title}
                      </p>
                      <p className="mt-1 text-[11px] text-text-secondary truncate">{p.owner_name} · {p.year}</p>
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
