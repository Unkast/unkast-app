import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";
import { Section, AnimatedCard } from "./HomeAnimations";
import Avatar from "@/components/Avatar";
import HeroCarousel from "./HeroCarousel";
import ConversionBanner from "./ConversionBanner";

export const revalidate = 300; // Cache 5 minutes

interface ProjectCard {
  id: string;
  title: string;
  slug: string;
  category: ProjectCategory;
  year: number;
  description: string | null;
  video_url: string;
  owner_name: string;
  owner_slug: string;
  team_size: number;
  poster_url?: string | null;
  preview_url?: string | null;
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

async function getHomeData() {
  const supabase = await createClient();

  // Single query with joins for all recent projects
  const { data: recentRaw } = await supabase
    .from("projects")
    .select(`
      id, title, slug, category, year, description, video_url, poster_url, preview_url,
      profiles!projects_profile_id_fkey ( full_name, slug, is_suspended ),
      project_credits ( id )
    `)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(12);

  const recentAll: ProjectCard[] = (recentRaw ?? [])
    // Retire les films dont le proprietaire est suspendu (chantier 3).
    .filter((p: Record<string, unknown>) => !((p.profiles as { is_suspended?: boolean } | null)?.is_suspended))
    .map((p: Record<string, unknown>) => {
    const owner = p.profiles as { full_name: string; slug: string } | null;
    const credits = p.project_credits as { id: string }[] | null;
    return {
      id: p.id as string,
      title: p.title as string,
      slug: p.slug as string,
      category: p.category as ProjectCategory,
      year: p.year as number,
      description: p.description as string | null,
      video_url: p.video_url as string,
      owner_name: owner?.full_name ?? "",
      owner_slug: owner?.slug ?? "",
      team_size: credits?.length ?? 0,
      poster_url: (p.poster_url as string | null) ?? null,
      preview_url: (p.preview_url as string | null) ?? null,
    };
  });

  // Projects with poster images first (for the carousel)
  const recent = [
    ...recentAll.filter((p) => p.poster_url),
    ...recentAll.filter((p) => !p.poster_url),
  ];

  // Category rows — single query per category with joins
  const categoryRows: ContentRow[] = [];
  const categoriesToShow: ProjectCategory[] = ["court-metrage", "publicite", "clip", "documentaire"];

  const categoryResults = await Promise.all(
    categoriesToShow.map((cat) =>
      supabase
        .from("projects")
        .select(`
          id, title, slug, category, year, description, video_url, poster_url, preview_url,
          profiles!projects_profile_id_fkey ( full_name, slug, is_suspended ),
          project_credits ( id )
        `)
        .eq("category", cat)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(10)
    )
  );

  for (let i = 0; i < categoriesToShow.length; i++) {
    const cat = categoriesToShow[i];
    const catRaw = categoryResults[i].data;
    if (catRaw && catRaw.length > 0) {
      const items: ProjectCard[] = catRaw
        .filter((p: Record<string, unknown>) => !((p.profiles as { is_suspended?: boolean } | null)?.is_suspended))
        .map((p: Record<string, unknown>) => {
        const owner = p.profiles as { full_name: string; slug: string } | null;
        const credits = p.project_credits as { id: string }[] | null;
        return {
          id: p.id as string,
          title: p.title as string,
          slug: p.slug as string,
          category: p.category as ProjectCategory,
          year: p.year as number,
          description: p.description as string | null,
          video_url: p.video_url as string,
          owner_name: owner?.full_name ?? "",
          owner_slug: owner?.slug ?? "",
          team_size: credits?.length ?? 0,
          poster_url: (p.poster_url as string | null) ?? null,
          preview_url: (p.preview_url as string | null) ?? null,
        };
      });
      categoryRows.push({ title: CATEGORY_LABELS[cat], href: `/recherche?category=${cat}`, items });
    }
  }

  // Talents — single query with join for roles
  const { data: rawTalents } = await supabase
    .from("profiles")
    .select(`
      id, full_name, slug, avatar_url, location, is_available,
      profile_roles ( role_name ),
      projects ( id )
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
      full_name: t.full_name as string,
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
    <div className="pb-tabbar">
      <div className="mx-auto w-full max-w-[1600px]">
      {/* HERO CAROUSEL */}
      {recent.length > 0 && (
        <HeroCarousel projects={recent.slice(0, 5)} />
      )}

      {/* CONTENT ROWS */}
      <div className="space-y-8 lg:space-y-12 py-6 lg:py-10">
        {recent.length > 5 && (
          <Section delay={0}>
            <ProjectRow title="Projets récents" href="/recherche?type=projets" items={recent.slice(5)} />
          </Section>
        )}

        {categoryRows.map((row, i) => (
          <Section key={row.title} delay={(i + 1) * 0.1}>
            <ProjectRow {...row} />
          </Section>
        ))}

        {talents.length > 0 && (
          <Section delay={(categoryRows.length + 1) * 0.1}>
            <section className="glow-lime px-5 sm:px-8 lg:px-12 xl:px-16">
              <div className="flex items-end justify-between mb-3 lg:mb-4">
                <h2 className="text-[15px] lg:text-xl font-bold text-text-primary tracking-tight">Talents à découvrir</h2>
                <Link href="/recherche?type=talents" className="group/all inline-flex items-center gap-1 text-[11px] lg:text-xs text-text-tertiary hover:text-lime transition-colors duration-300">
                  Tout voir
                  <span className="transition-transform duration-300 group-hover/all:translate-x-0.5">→</span>
                </Link>
              </div>
              <div className="flex gap-3 lg:gap-4 overflow-x-auto no-scrollbar -mx-5 px-5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 xl:-mx-16 xl:px-16 pb-1">
                {talents.map((talent) => (
                  <AnimatedCard key={talent.id}>
                    <Link
                      href={`/profil/${talent.slug}`}
                      className="flex-shrink-0 w-48 lg:w-56 bg-white/[0.03] border border-white/5 rounded-xl p-3.5 lg:p-4 hover:bg-white/[0.06] hover:border-white/10 hover:shadow-xl hover:shadow-black/30 transition-all duration-300 group block"
                    >
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
                          <span key={role} className="px-2 py-0.5 rounded-full bg-lime/8 text-lime text-[9px] font-semibold">
                            {role}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-text-tertiary mt-2">
                        {talent.project_count} projet{talent.project_count > 1 ? "s" : ""}
                      </p>
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

/* PROJECT ROW */
function ProjectRow({ title, href, items }: ContentRow) {
  return (
    <section className="px-5 sm:px-8 lg:px-12 xl:px-16">
      <div className="flex items-end justify-between mb-3 lg:mb-4">
        <h2 className="text-[15px] lg:text-xl font-bold text-text-primary tracking-tight">{title}</h2>
        <Link href={href} className="group/all inline-flex items-center gap-1 text-[11px] lg:text-xs text-text-tertiary hover:text-lime transition-colors duration-300">
          Tout voir
          <span className="transition-transform duration-300 group-hover/all:translate-x-0.5">→</span>
        </Link>
      </div>
      <div className="flex gap-3 lg:gap-4 overflow-x-auto no-scrollbar -mx-5 px-5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 xl:-mx-16 xl:px-16 pb-1">
        {items.map((project) => {
          const catColor = CATEGORY_COLORS[project.category];
          return (
            <AnimatedCard key={project.id}>
              <Link href={`/projet/${project.slug}`} className="flex-shrink-0 w-60 sm:w-72 lg:w-80 group block">
                <div
                  className="relative w-full bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden group-hover:border-white/10 group-hover:bg-white/[0.05] group-hover:shadow-2xl group-hover:shadow-black/50 transition-all duration-300"
                  style={{ aspectRatio: "16/9" }}
                >
                  {project.preview_url ? (
                    <Image
                      src={project.preview_url}
                      alt={project.title}
                      fill
                      loading="lazy"
                      sizes="(max-width: 768px) 240px, 288px"
                      style={{ objectFit: "cover" }}
                    />
                  ) : project.poster_url ? (
                    <Image
                      src={project.poster_url}
                      alt={project.title}
                      fill
                      loading="lazy"
                      sizes="(max-width: 768px) 240px, 288px"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white/[0.08]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-lg shadow-black/30">
                      <svg className="w-4 h-4 text-[#0d0d0d] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <span
                    className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase"
                    style={{ backgroundColor: catColor + "20", color: catColor }}
                  >
                    {CATEGORY_LABELS[project.category]}
                  </span>
                </div>
                <div className="mt-2.5 px-0.5">
                  <h3 className="text-[13px] font-semibold text-text-primary group-hover:text-lime transition-colors duration-300 truncate leading-tight">
                    {project.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-text-tertiary truncate">{project.owner_name}</span>
                    <span className="text-[11px] text-text-tertiary/50 font-mono">{project.year}</span>
                    {project.team_size > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-text-tertiary/50">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {project.team_size}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </AnimatedCard>
          );
        })}
      </div>
    </section>
  );
}
