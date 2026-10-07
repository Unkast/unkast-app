import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";

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
    <div>
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-[22px] font-semibold text-text-primary" style={{ letterSpacing: "-0.5px" }}>
            {label}
          </h1>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
            style={{ background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}30` }}
          >
            {enrichedProjects.length} film{enrichedProjects.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {enrichedProjects.length === 0 ? (
        /* Empty state */
        <div className="text-center px-8 py-20">
          <svg className="w-12 h-12 mx-auto mb-4" style={{ color: catColor, opacity: 0.3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4V2m0 2v2m0-2H5m2 0h2M3 20h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v10a2 2 0 002 2zM15 12l-4 2.5v-5l4 2.5z" />
          </svg>
          <p className="text-sm font-medium text-text-primary mb-1">Aucun film dans cette catégorie</p>
          <p className="text-xs text-[#555] mb-6">Sois le premier à publier</p>
          <Link
            href="/rejoindre"
            className="inline-block px-5 py-3 bg-[#C8FF00] text-[#0d0d0d] font-semibold text-sm rounded-lg"
          >
            Publier un film
          </Link>
        </div>
      ) : (
        <div className="px-4">
          {/* Featured project */}
          {featured && (
            <Link
              href={`/projet/${featured.slug}`}
              className="block relative rounded-xl overflow-hidden mb-4 group"
              style={{ aspectRatio: "16/9" }}
            >
              <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center">
                {featured.preview_url ? (
                  <img
                    src={featured.preview_url}
                    alt={featured.title}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <svg className="w-10 h-10" style={{ color: "#C8FF00", opacity: 0.15 }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 p-4">
                <p className="text-lg font-semibold text-[#f0f0f0] group-hover:text-[#C8FF00] transition" style={{ letterSpacing: "-0.3px" }}>
                  {featured.title}
                </p>
                <p className="text-xs text-[#888]">{featured.owner_name} · {featured.year}</p>
              </div>
            </Link>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pb-6">
              {rest.map((p) => (
                <Link
                  key={p.id}
                  href={`/projet/${p.slug}`}
                  className="group"
                >
                  <div
                    className="w-full rounded-lg overflow-hidden mb-2 flex items-center justify-center"
                    style={{ aspectRatio: "16/9", background: "#1a1a1a", position: "relative" }}
                  >
                    {p.poster_url ? (
                      <img
                        src={p.poster_url}
                        alt={p.title}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <svg className="w-6 h-6" style={{ color: "#C8FF00", opacity: 0.15 }} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-[13px] font-medium text-text-primary group-hover:text-[#C8FF00] transition truncate leading-tight">
                    {p.title}
                  </p>
                  <p className="text-[11px] text-[#555] truncate">{p.owner_name} · {p.year}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
