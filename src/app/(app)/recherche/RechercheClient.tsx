"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";
import Avatar from "@/components/Avatar";

type Mode = "browse" | "search";
type SearchFilter = "all" | "talents" | "projets";

interface TalentResult {
  id: string;
  full_name: string;
  slug: string;
  avatar_url: string | null;
  location: string | null;
  is_available: boolean;
  roles: string[];
}

interface ProjectResult {
  id: string;
  title: string;
  slug: string;
  category: ProjectCategory;
  year: number;
  owner_name: string;
  poster_url?: string | null;
  preview_url?: string | null;
}

const CATEGORIES: {
  key: ProjectCategory;
  label: string;
  gradient: string;
  accent: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "court-metrage",
    label: "Court-métrage",
    gradient: "linear-gradient(135deg, #1a0d2e, #2d1b4e)",
    accent: "#a855f7",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4V2m0 2v2m0-2H5m2 0h2M3 20h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v10a2 2 0 002 2zM15 12l-4 2.5v-5l4 2.5z" />,
  },
  {
    key: "moyen-metrage",
    label: "Moyen métrage",
    gradient: "linear-gradient(135deg, #0d1f2e, #1b3a4e)",
    accent: "#38BDF8",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4V2m0 2v2m0-2H5m2 0h2M3 20h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v10a2 2 0 002 2zM15 12l-4 2.5v-5l4 2.5z" />,
  },
  {
    key: "long-metrage",
    label: "Long métrage",
    gradient: "linear-gradient(135deg, #2e0d2a, #4e1b45)",
    accent: "#E879F9",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4V2m0 2v2m0-2H5m2 0h2M3 20h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v10a2 2 0 002 2zM15 12l-4 2.5v-5l4 2.5z" />,
  },
  {
    key: "documentaire",
    label: "Documentaire",
    gradient: "linear-gradient(135deg, #0d2e1a, #1b4e2d)",
    accent: "#22c55e",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />,
  },
  {
    key: "clip",
    label: "Clip",
    gradient: "linear-gradient(135deg, #2e1a0d, #4e2d1b)",
    accent: "#f97316",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />,
  },
  {
    key: "publicite",
    label: "Publicité",
    gradient: "linear-gradient(135deg, #2e0d1a, #4e1b2d)",
    accent: "#ec4899",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />,
  },
  {
    key: "bande-demo",
    label: "Bande démo",
    gradient: "linear-gradient(135deg, #2e2a0d, #4e451b)",
    accent: "#eab308",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
  {
    key: "scene-extrait",
    label: "Scène / Extrait",
    gradient: "linear-gradient(135deg, #0d1a2e, #1b2d4e)",
    accent: "#3b82f6",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />,
  },
];

const ROLES_PILLS = [
  "Réalisateur", "Comédien", "Directeur photo", "Monteur",
  "Producteur", "Scénariste", "Chef opérateur", "Costumier",
  "Compositeur", "Ingénieur son", "Motion designer",
];

// Version des images de catégories. À incrémenter quand tu remplaces une image
// (cache-bust navigateur/CDN sans changer le nom de fichier).
const CATEGORY_IMG_VERSION = "2";

// Nom de fichier image par catégorie. Par défaut = <id>.webp. On peut surcharger
// si besoin de repartir sur un nom neuf (ex. publicite : ancien nom "empoisonné"
// dans des caches navigateur/SW -> fichier renommé publicite-bg.webp).
const CATEGORY_IMG_FILE: Record<string, string> = {
  publicite: "publicite-bg",
};

// Fond image d'une carte de catégorie : public/categories/<id>.webp.
// Fallback : si l'image manque (onError), on ne rend RIEN -> le dégradé de la
// carte (background du <Link>) réapparaît, identique à l'existant. L'overlay
// sombre n'apparaît qu'une fois l'image chargée, pour ne pas assombrir le
// dégradé de fallback.
function CategoryBg({ categoryKey }: { categoryKey: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Garde-fou anti-race : si l'image est servie depuis le CACHE, l'événement
  // `load` peut se déclencher AVANT que React n'attache onLoad -> l'image reste
  // à opacity 0 (invisible). Au montage, on inspecte donc directement l'état réel
  // de l'<img> (complete + naturalWidth) pour rattraper ce cas.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth === 0) setFailed(true);
    else setLoaded(true);
  }, []);

  if (failed) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={`/categories/${CATEGORY_IMG_FILE[categoryKey] ?? categoryKey}.webp?v=${CATEGORY_IMG_VERSION}`}
        alt=""
        aria-hidden
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: loaded ? 1 : 0 }}
      />
      {loaded && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            // Plus dense en bas/bas-gauche pour la lisibilité du titre + compteur.
            background: "linear-gradient(to top right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 42%, rgba(0,0,0,0.08) 78%)",
          }}
        />
      )}
    </>
  );
}

interface Props {
  categoryCounts: Record<string, number>;
  recruitingProfiles: any[];
}

export default function RechercheClient({ categoryCounts, recruitingProfiles }: Props) {
  const [mode, setMode] = useState<Mode>("browse");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [talents, setTalents] = useState<TalentResult[]>([]);
  const [projects, setProjects] = useState<ProjectResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mode === "search") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "search" || query.length < 2) {
      if (query.length < 2) { setTalents([]); setProjects([]); setSearched(false); }
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${filter === "all" ? "all" : filter}`);
        const data = await res.json();
        setTalents(data.talents || []);
        setProjects(data.projects || []);
        setSearched(true);
      } catch {
        setTalents([]);
        setProjects([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, filter, mode]);

  function switchToSearchWithRole(role: string) {
    setMode("search");
    setQuery(role);
    setFilter("talents");
  }

  return (
    <div className="pb-tabbar">
      <div className="mx-auto w-full max-w-[1600px] lg:px-12 xl:px-16">
      {/* Header */}
      <div className="px-5 pt-5">
        <h1 className="text-[24px] font-semibold text-text-primary" style={{ letterSpacing: "-0.5px" }}>
          Explorer
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-5 py-4">
        {(["browse", "search"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-5 py-2 rounded-[20px] text-sm font-medium transition-all duration-200"
            style={mode === m
              ? { background: "#C8FF00", color: "#0d0d0d", fontWeight: 600 }
              : { background: "rgba(255,255,255,0.06)", color: "#666", border: "1px solid rgba(255,255,255,0.08)" }
            }
          >
            {m === "browse" ? "Parcourir" : "Rechercher"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ===== BROWSE ===== */}
        {mode === "browse" && (
          <motion.div
            key="browse"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {recruitingProfiles.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", padding: "0 20px", marginBottom: 12 }}>En recrutement</h2>
                <div className="no-scrollbar" style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 4px" }}>
                  {recruitingProfiles.map((p: any) => (
                    <Link key={p.id} href={`/profil/${p.slug}`} style={{ flexShrink: 0, width: 140, background: "#141414", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 12, padding: 14, textAlign: "center", textDecoration: "none" }}>
                      <Avatar url={p.avatar_url} name={p.full_name || ""} size={48} style={{ background: "rgba(200,255,0,0.08)", border: "1.5px solid rgba(200,255,0,0.2)", margin: "0 auto 8px" }} />
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#f0f0f0", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.full_name}</p>
                      <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#555", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.main_role}</p>
                      {p.recruiting_roles?.length > 0 && (
                        <p style={{ fontSize: 11, color: "#22c55e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>cherche {p.recruiting_roles[0]}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 lg:gap-4 px-4 lg:px-1 pb-6">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.key}
                  href={`/categories/${cat.key}`}
                  className="relative overflow-hidden block active:scale-[0.97] transition-transform duration-100"
                  style={{ height: 140, borderRadius: 12, background: cat.gradient, border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {/* Fond image (si présent) + overlay ; sinon le dégradé ci-dessus reste visible */}
                  <CategoryBg categoryKey={cat.key} />
                  <svg className="absolute" style={{ top: -20, right: -20, opacity: 0.08 }} width="80" height="80" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="38" stroke={cat.accent} strokeWidth="2" fill="none" />
                  </svg>
                  <div className="absolute bottom-0 left-0 p-3.5">
                    <svg className="w-5 h-5 mb-1.5" style={{ color: cat.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {cat.icon}
                    </svg>
                    <p className="text-[15px] font-semibold text-[#f0f0f0]" style={{ letterSpacing: "-0.3px" }}>{cat.label}</p>
                    <p className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {categoryCounts[cat.key] || 0} film{(categoryCounts[cat.key] || 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="px-5 pt-2 pb-6">
              <h2 className="text-[15px] font-semibold text-text-primary mb-3">Métiers</h2>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
                {ROLES_PILLS.map((role) => (
                  <button
                    key={role}
                    onClick={() => switchToSearchWithRole(role)}
                    className="flex-shrink-0 px-4 py-2 rounded-[20px] text-[13px] transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#888" }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== SEARCH ===== */}
        {mode === "search" && (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="px-4"
          >
            <div
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl mb-3 transition-colors lg:max-w-2xl"
              style={{ background: "#1a1a1a", border: query ? "1px solid #C8FF00" : "1px solid rgba(255,255,255,0.1)" }}
            >
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: "#555" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, métier, ville..."
                className="flex-1 bg-transparent text-base text-[#f0f0f0] placeholder:text-[#444] outline-none"
              />
              {query && (
                <button onClick={() => { setQuery(""); setSearched(false); }} className="text-[#555] hover:text-[#f0f0f0] transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex gap-2 mb-4 lg:max-w-2xl">
              {([["all", "Tous"], ["talents", "Talents"], ["projets", "Films"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className="px-4 py-2 rounded-[20px] text-[13px] font-medium transition-all duration-150"
                  style={filter === key
                    ? { background: "#C8FF00", color: "#0d0d0d" }
                    : { background: "rgba(255,255,255,0.04)", color: "#888", border: "1px solid rgba(255,255,255,0.08)" }
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Loading skeletons */}
            {searching && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#1a1a1a" }}>
                    <div className="w-11 h-11 rounded-full animate-pulse" style={{ background: "#222" }} />
                    <div className="flex-1">
                      <div className="h-3.5 w-32 rounded animate-pulse" style={{ background: "#222" }} />
                      <div className="h-3 w-20 rounded mt-1.5 animate-pulse" style={{ background: "#1f1f1f" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty — not searched */}
            {!searching && !searched && query.length < 2 && (
              <div className="text-center py-12">
                <p className="text-sm text-[#444]">Tape un nom, un métier ou une ville</p>
              </div>
            )}

            {/* No results */}
            {!searching && searched && talents.length === 0 && projects.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-text-secondary mb-1">Aucun résultat pour &quot;{query}&quot;</p>
                <p className="text-xs text-[#444]">Essaie un autre nom ou métier</p>
              </div>
            )}

            {/* Talent results */}
            {!searching && talents.length > 0 && (filter === "all" || filter === "talents") && (
              <div className="mb-6">
                {filter === "all" && <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-2">Talents</p>}
                {/* Mobile : liste compacte */}
                <div className="space-y-1.5 lg:hidden">
                  {talents.map((t) => (
                    <Link key={t.id} href={`/profil/${t.slug}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition group">
                      <Avatar url={t.avatar_url} name={t.full_name} size={44} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary group-hover:text-[#C8FF00] transition truncate">{t.full_name}</p>
                        <p className="text-xs text-[#555] truncate">{t.roles[0] || ""}{t.location && ` · ${t.location}`}</p>
                      </div>
                      {t.is_available && <span className="w-2 h-2 rounded-full bg-[#00D4AA] flex-shrink-0" />}
                      <svg className="w-4 h-4 text-[#333] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
                {/* Desktop : grille cartes talent (langage Feed) */}
                <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {talents.map((t) => (
                    <Link key={t.id} href={`/profil/${t.slug}`} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:bg-white/[0.06] hover:border-white/10 hover:shadow-xl hover:shadow-black/30 transition-all duration-300 group block">
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <Avatar url={t.avatar_url} name={t.full_name} size={40} shape="rounded" style={{ borderRadius: 12 }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-semibold text-text-primary group-hover:text-lime transition truncate">{t.full_name}</span>
                            {t.is_available && <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] flex-shrink-0" />}
                          </div>
                          {t.location && <p className="text-[10px] text-text-tertiary truncate">{t.location}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {t.roles.slice(0, 2).map((role) => (
                          <span key={role} className="px-2 py-0.5 rounded-full bg-lime/8 text-lime text-[9px] font-semibold">{role}</span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Project results */}
            {!searching && projects.length > 0 && (filter === "all" || filter === "projets") && (
              <div className="mb-6">
                {filter === "all" && <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-2">Films</p>}
                {/* Mobile : liste compacte */}
                <div className="space-y-1.5 lg:hidden">
                  {projects.map((p) => {
                    const catColor = CATEGORY_COLORS[p.category];
                    return (
                      <Link key={p.id} href={`/projet/${p.slug}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition group">
                        <div className="w-[60px] h-[44px] rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "#1a1a1a", position: "relative" }}>
                          {(p.preview_url || p.poster_url) ? (
                            <img
                              src={(p.preview_url || p.poster_url) as string}
                              alt={p.title}
                              className="rounded-md"
                              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <svg className="w-4 h-4" style={{ color: "#C8FF00", opacity: 0.3 }} fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-text-primary group-hover:text-[#C8FF00] transition truncate">{p.title}</p>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold flex-shrink-0" style={{ background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}25`, letterSpacing: "0.08em" }}>
                              {CATEGORY_LABELS[p.category]}
                            </span>
                          </div>
                          <p className="text-xs text-[#555] truncate">{p.owner_name} · {p.year}</p>
                        </div>
                        <svg className="w-4 h-4 text-[#333] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    );
                  })}
                </div>
                {/* Desktop : grille cartes Feed (films) */}
                <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {projects.map((p) => {
                    const catColor = CATEGORY_COLORS[p.category];
                    return (
                      <Link key={p.id} href={`/projet/${p.slug}`} className="group block">
                        <div className="relative w-full bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden group-hover:border-white/10 group-hover:shadow-2xl group-hover:shadow-black/50 transition-all duration-300" style={{ aspectRatio: "16/9" }}>
                          {(p.preview_url || p.poster_url) ? (
                            <img src={(p.preview_url || p.poster_url) as string} alt={p.title} className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="#C8FF00" style={{ opacity: 0.12 }}><path d="M8 5v14l11-7z" /></svg>
                            </div>
                          )}
                          <span className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: catColor + "20", color: catColor }}>
                            {CATEGORY_LABELS[p.category]}
                          </span>
                        </div>
                        <div className="mt-2.5 px-0.5">
                          <h3 className="text-[13px] font-semibold text-text-primary group-hover:text-lime transition-colors truncate">{p.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-text-tertiary truncate">{p.owner_name}</span>
                            <span className="text-[11px] text-text-tertiary/50 font-mono">{p.year}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
