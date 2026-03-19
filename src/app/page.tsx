import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";
import HeroPlayer from "./HeroPlayer";
import { HeroContent, Section, AnimatedCard } from "./HomeAnimations";

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

  async function enrichProject(p: {
    id: string; title: string; slug: string; category: string;
    year: number; description: string | null; video_url: string; profile_id: string;
  }): Promise<ProjectCard> {
    const { data: owner } = await supabase
      .from("profiles").select("full_name, slug").eq("id", p.profile_id).single();
    const { count } = await supabase
      .from("project_credits").select("*", { count: "exact", head: true }).eq("project_id", p.id);
    return {
      id: p.id, title: p.title, slug: p.slug,
      category: p.category as ProjectCategory, year: p.year,
      description: p.description, video_url: p.video_url,
      owner_name: owner?.full_name ?? "", owner_slug: owner?.slug ?? "",
      team_size: count ?? 0,
    };
  }

  const { data: featuredRaw } = await supabase
    .from("projects")
    .select("id, title, slug, category, year, description, video_url, profile_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const featured = featuredRaw ? await enrichProject(featuredRaw) : null;

  const { data: recentRaw } = await supabase
    .from("projects")
    .select("id, title, slug, category, year, description, video_url, profile_id")
    .order("created_at", { ascending: false })
    .limit(13);

  const recentAll = await Promise.all((recentRaw ?? []).map(enrichProject));
  const recent = featured
    ? recentAll.filter((p) => p.id !== featured.id).slice(0, 12)
    : recentAll.slice(0, 12);

  const categoryRows: ContentRow[] = [];
  const categoriesToShow: ProjectCategory[] = ["court-metrage", "publicite", "clip", "documentaire"];
  for (const cat of categoriesToShow) {
    const { data: catRaw } = await supabase
      .from("projects")
      .select("id, title, slug, category, year, description, video_url, profile_id")
      .eq("category", cat).order("created_at", { ascending: false }).limit(10);
    if (catRaw && catRaw.length > 0) {
      const items = await Promise.all(catRaw.map(enrichProject));
      categoryRows.push({ title: CATEGORY_LABELS[cat], href: `/recherche?category=${cat}`, items });
    }
  }

  const { data: rawTalents } = await supabase
    .from("profiles")
    .select("id, full_name, slug, avatar_url, location, is_available")
    .eq("status", "approved").order("created_at", { ascending: false }).limit(12);

  const talents: TalentCard[] = await Promise.all(
    (rawTalents ?? []).map(async (t) => {
      const { data: roles } = await supabase
        .from("profile_roles").select("role_name").eq("profile_id", t.id);
      const { count } = await supabase
        .from("projects").select("*", { count: "exact", head: true }).eq("profile_id", t.id);
      return { ...t, roles: (roles ?? []).map((r) => r.role_name), project_count: count ?? 0 };
    })
  );

  return { featured, recent, categoryRows, talents };
}

export default async function Home() {
  const { featured, recent, categoryRows, talents } = await getHomeData();

  return (
    <div className="pb-16 lg:pb-0">
      {/* HERO */}
      {featured && (
        <section className="relative w-full" style={{ aspectRatio: "21/9", minHeight: 280, maxHeight: 560 }}>
          <div className="absolute inset-0">
            <HeroPlayer url={featured.video_url} />
          </div>

          {/* Cinematic gradient — 60% height from bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-background from-10% via-background/70 via-50% to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />

          <HeroContent>
            <span
              className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase mb-3"
              style={{
                backgroundColor: CATEGORY_COLORS[featured.category] + "20",
                color: CATEGORY_COLORS[featured.category],
              }}
            >
              {CATEGORY_LABELS[featured.category]}
            </span>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.05] max-w-2xl tracking-tight">
              {featured.title}
            </h1>

            {featured.description && (
              <p className="mt-3 text-sm sm:text-base text-white/60 max-w-xl line-clamp-2 leading-relaxed">
                {featured.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-5">
              <Link
                href={`/projet/${featured.slug}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#0d0d0d] font-bold text-sm rounded-xl hover:bg-white/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Regarder
              </Link>
              <Link
                href={`/profil/${featured.owner_slug}`}
                className="px-5 py-3 bg-white/8 backdrop-blur-md text-white/90 text-sm font-medium rounded-xl border border-white/10 hover:bg-white/15 hover:border-white/20 transition-all duration-300"
              >
                {featured.owner_name}
              </Link>
            </div>
          </HeroContent>
        </section>
      )}

      {/* CONTENT ROWS */}
      <div className="space-y-8 py-6">
        {recent.length > 0 && (
          <Section delay={0}>
            <ProjectRow title="Projets recents" href="/recherche?type=projets" items={recent} />
          </Section>
        )}

        {categoryRows.map((row, i) => (
          <Section key={row.title} delay={(i + 1) * 0.1}>
            <ProjectRow {...row} />
          </Section>
        ))}

        {talents.length > 0 && (
          <Section delay={(categoryRows.length + 1) * 0.1}>
            <section className="glow-lime px-5 sm:px-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-bold text-text-primary">Talents a decouvrir</h2>
                <Link href="/recherche?type=talents" className="text-[11px] text-text-tertiary hover:text-lime transition-colors duration-300">
                  Tout voir
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 sm:-mx-8 sm:px-8 pb-1">
                {talents.map((talent) => (
                  <AnimatedCard key={talent.id}>
                    <Link
                      href={`/profil/${talent.slug}`}
                      className="flex-shrink-0 w-48 bg-white/[0.03] border border-white/5 rounded-xl p-3.5 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 group block"
                    >
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 overflow-hidden flex-shrink-0">
                          {talent.avatar_url ? (
                            <img src={talent.avatar_url} alt={talent.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-text-tertiary">
                              {talent.full_name.charAt(0)}
                            </div>
                          )}
                        </div>
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
  );
}

/* PROJECT ROW */
function ProjectRow({ title, href, items }: ContentRow) {
  return (
    <section className="px-5 sm:px-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-text-primary">{title}</h2>
        <Link href={href} className="text-[11px] text-text-tertiary hover:text-lime transition-colors duration-300">
          Tout voir
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 sm:-mx-8 sm:px-8 pb-1">
        {items.map((project) => {
          const catColor = CATEGORY_COLORS[project.category];
          return (
            <AnimatedCard key={project.id}>
              <Link href={`/projet/${project.slug}`} className="flex-shrink-0 w-60 sm:w-72 group block">
                <div
                  className="relative w-full bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden group-hover:border-white/10 group-hover:bg-white/[0.05] transition-all duration-300"
                  style={{ aspectRatio: "16/9" }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white/[0.08]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
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
