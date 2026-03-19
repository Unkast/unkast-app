"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";

type Tab = "all" | "talents" | "projets";
type Sort = "pertinence" | "date" | "projets";
type ViewMode = "grid" | "list";

interface TalentResult {
  id: string;
  full_name: string;
  slug: string;
  avatar_url: string | null;
  location: string | null;
  is_available: boolean;
  bio: string | null;
  roles: string[];
  project_count: number;
}

interface ProjectResult {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: ProjectCategory;
  year: number;
  video_url: string;
  owner_name: string;
  owner_slug: string;
}

interface SearchResults {
  talents: TalentResult[];
  projects: ProjectResult[];
  counts: { talents: number; projects: number; total: number };
}

const ROLES_SUGGESTIONS = [
  "Realisateur",
  "Chef operateur",
  "Monteur",
  "Directeur artistique",
  "Comedien",
  "Ingenieur son",
  "Producteur",
  "Scenariste",
  "Cascadeur",
];

export default function RechercheClient() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("pertinence");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("type", tab === "all" ? "all" : tab);
    params.set("sort", sort);
    if (roleFilter) params.set("role", roleFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (locationFilter) params.set("location", locationFilter);

    try {
      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      setResults(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [query, tab, sort, roleFilter, categoryFilter, locationFilter]);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(search, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const hasFilters = roleFilter || categoryFilter || locationFilter;

  return (
    <div className="pb-16 lg:pb-0">
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6">
        {/* Search bar */}
        <div className="mb-5">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un talent, un projet, un metier..."
              className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-xl text-text-primary text-base placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
            />
          </div>
        </div>

        {/* Tabs + controls row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
            {(
              [
                { key: "all", label: "Tout" },
                { key: "talents", label: "Talents" },
                { key: "projets", label: "Projets" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                  tab === key
                    ? "bg-white/10 text-text-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {label}
                {results && (
                  <span className="ml-1.5 text-xs opacity-60">
                    (
                    {key === "all"
                      ? results.counts.total
                      : key === "talents"
                        ? results.counts.talents
                        : results.counts.projects}
                    )
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Filters toggle */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition ${
                filtersOpen || hasFilters
                  ? "border-lime/30 text-lime bg-lime/5"
                  : "border-border text-text-secondary hover:border-border-hover"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtres
              {hasFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-lime" />
              )}
            </button>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="px-3 py-2 rounded-lg text-sm border border-border bg-card text-text-secondary focus:outline-none focus:border-lime/50 transition"
            >
              <option value="pertinence">Pertinence</option>
              <option value="date">Date</option>
              <option value="projets">Nb projets</option>
            </select>

            {/* View mode toggle */}
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition ${viewMode === "grid" ? "bg-white/10 text-text-primary" : "text-text-tertiary hover:text-text-secondary"}`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <rect x="1" y="1" width="6" height="6" rx="1" />
                  <rect x="9" y="1" width="6" height="6" rx="1" />
                  <rect x="1" y="9" width="6" height="6" rx="1" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition ${viewMode === "list" ? "bg-white/10 text-text-primary" : "text-text-tertiary hover:text-text-secondary"}`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <rect x="1" y="1" width="14" height="3" rx="1" />
                  <rect x="1" y="6" width="14" height="3" rx="1" />
                  <rect x="1" y="11" width="14" height="3" rx="1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Filters panel */}
        {filtersOpen && (
          <div className="bg-card border border-border rounded-xl p-5 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Role filter */}
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                Metier
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-lime/50 transition"
              >
                <option value="">Tous les metiers</option>
                {ROLES_SUGGESTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Category filter */}
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                Categorie de projet
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-lime/50 transition"
              >
                <option value="">Toutes les categories</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Location filter */}
            <div>
              <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                Localisation
              </label>
              <input
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Paris, Lyon..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
              />
            </div>

            {hasFilters && (
              <div className="sm:col-span-3">
                <button
                  onClick={() => {
                    setRoleFilter("");
                    setCategoryFilter("");
                    setLocationFilter("");
                  }}
                  className="text-xs text-text-tertiary hover:text-lime transition"
                >
                  Reinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-lime/30 border-t-lime rounded-full animate-spin" />
          </div>
        )}

        {/* Results */}
        {!loading && results && (
          <>
            {results.counts.total === 0 ? (
              /* Empty state */
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-text-secondary font-semibold mb-1">Aucun resultat</p>
                <p className="text-sm text-text-tertiary">
                  Essayez avec d&apos;autres termes ou ajustez les filtres.
                </p>
              </div>
            ) : (
              <div>
                {/* Talents */}
                {results.talents.length > 0 && (tab === "all" || tab === "talents") && (
                  <section className="mb-10">
                    {tab === "all" && (
                      <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">
                        Talents ({results.counts.talents})
                      </h2>
                    )}
                    <div
                      className={
                        viewMode === "grid"
                          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                          : "space-y-3"
                      }
                    >
                      {results.talents.map((talent) => (
                        <TalentCard key={talent.id} talent={talent} viewMode={viewMode} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Projects */}
                {results.projects.length > 0 && (tab === "all" || tab === "projets") && (
                  <section>
                    {tab === "all" && (
                      <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">
                        Projets ({results.counts.projects})
                      </h2>
                    )}
                    <div
                      className={
                        viewMode === "grid"
                          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                          : "space-y-3"
                      }
                    >
                      {results.projects.map((project) => (
                        <ProjectCard key={project.id} project={project} viewMode={viewMode} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ---- Sub-components ---- */

function TalentCard({ talent, viewMode }: { talent: TalentResult; viewMode: ViewMode }) {
  if (viewMode === "list") {
    return (
      <Link
        href={`/profil/${talent.slug}`}
        className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-border-hover transition"
      >
        <div className="w-11 h-11 rounded-xl bg-background border border-border overflow-hidden flex-shrink-0">
          {talent.avatar_url ? (
            <img src={talent.avatar_url} alt={talent.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-text-tertiary">
              {talent.full_name.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary truncate">{talent.full_name}</span>
            {talent.is_available && (
              <span className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-text-tertiary truncate">
            {talent.roles.join(", ")}
            {talent.location ? ` — ${talent.location}` : ""}
          </p>
        </div>
        <span className="text-xs text-text-tertiary flex-shrink-0">
          {talent.project_count} projet{talent.project_count > 1 ? "s" : ""}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/profil/${talent.slug}`}
      className="bg-card border border-border rounded-xl p-5 hover:border-border-hover transition group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-background border border-border overflow-hidden flex-shrink-0">
          {talent.avatar_url ? (
            <img src={talent.avatar_url} alt={talent.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-text-tertiary">
              {talent.full_name.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-text-primary group-hover:text-lime transition truncate">
              {talent.full_name}
            </span>
            {talent.is_available && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal/10 border border-teal/30 text-teal text-[10px] font-semibold">
                <span className="w-1 h-1 rounded-full bg-teal" />
                Dispo
              </span>
            )}
          </div>
          {talent.location && (
            <p className="text-xs text-text-tertiary">{talent.location}</p>
          )}
        </div>
      </div>

      {talent.roles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {talent.roles.slice(0, 3).map((role) => (
            <span
              key={role}
              className="px-2 py-0.5 rounded-full bg-lime/10 border border-lime/30 text-lime text-[10px] font-semibold"
            >
              {role}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-text-tertiary">
        {talent.project_count} projet{talent.project_count > 1 ? "s" : ""}
      </p>
    </Link>
  );
}

function ProjectCard({ project, viewMode }: { project: ProjectResult; viewMode: ViewMode }) {
  const catColor = CATEGORY_COLORS[project.category];

  if (viewMode === "list") {
    return (
      <Link
        href={`/projet/${project.slug}`}
        className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-border-hover transition"
      >
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
          style={{
            backgroundColor: catColor + "15",
            color: catColor,
            border: `1px solid ${catColor}30`,
          }}
        >
          {CATEGORY_LABELS[project.category]}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-text-primary truncate block">{project.title}</span>
          <span className="text-xs text-text-tertiary">
            par {project.owner_name} — {project.year}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/projet/${project.slug}`}
      className="bg-card border border-border rounded-xl p-5 hover:border-border-hover transition group"
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            backgroundColor: catColor + "15",
            color: catColor,
            border: `1px solid ${catColor}30`,
          }}
        >
          {CATEGORY_LABELS[project.category]}
        </span>
        <span className="text-xs font-mono text-text-tertiary">{project.year}</span>
      </div>

      <h3 className="text-sm font-bold text-text-primary group-hover:text-lime transition mb-1.5 truncate">
        {project.title}
      </h3>

      {project.description && (
        <p className="text-xs text-text-secondary line-clamp-2 mb-3">
          {project.description}
        </p>
      )}

      <p className="text-xs text-text-tertiary">
        par <span className="text-text-secondary">{project.owner_name}</span>
      </p>
    </Link>
  );
}
