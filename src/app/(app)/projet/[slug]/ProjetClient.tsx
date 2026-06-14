"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Profile, ProfileRole, Project, ProjectCredit, ProjectCategory } from "@/types/database";
import VideoEmbed from "@/components/VideoEmbed";
import Avatar from "@/components/Avatar";
import { ModalBackdrop } from "@/components/motion";
import ReportModal from "@/components/ReportModal";
import RoleSelector from "@/components/RoleSelector";
import { useUserStatus } from "@/hooks/useUserStatus";

type CreditWithProfile = ProjectCredit & {
  profile: (Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "location"> & { roles: ProfileRole[]; project_count: number }) | null;
};

type ProjectFull = Project & {
  credits: CreditWithProfile[];
  owner: Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "location" | "is_available"> & { roles: ProfileRole[] };
};

type RelatedProject = Project & { owner_name: string; owner_slug: string; common_collaborators: number };

interface Props {
  project: ProjectFull;
  relatedProjects: RelatedProject[];
  categoryLabels: Record<ProjectCategory, string>;
  categoryColors: Record<ProjectCategory, string>;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function ProjetClient({ project, relatedProjects, categoryLabels, categoryColors }: Props) {
  const router = useRouter();
  const [showVideo, setShowVideo] = useState(false);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  // User status for visibility tiers
  const userStatus = useUserStatus();

  // Credit request state
  const [creditStatus, setCreditStatus] = useState({ isCredited: false, hasPendingRequest: false, isOwner: false });
  const [creditStatusLoaded, setCreditStatusLoaded] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditRole, setCreditRole] = useState("");
  const [creditMessage, setCreditMessage] = useState("");
  const [creditSending, setCreditSending] = useState(false);
  const [creditToast, setCreditToast] = useState("");

  // Video modal touch swipe
  const videoTouchY = useRef<number | null>(null);

  useEffect(() => {
    fetch(`/api/credits/status?project_id=${project.id}`)
      .then((r) => r.json())
      .then((data) => { setCreditStatus(data); setCreditStatusLoaded(true); })
      .catch(() => setCreditStatusLoaded(true));
  }, [project.id]);


  // Lock body scroll when video modal open
  useEffect(() => {
    if (showVideo) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [showVideo]);

  // Close options on outside click
  useEffect(() => {
    if (!showOptions) return;
    const handler = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) setShowOptions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showOptions]);

  const showCreditButton = userStatus === "free" && creditStatusLoaded && !creditStatus.isCredited && !creditStatus.hasPendingRequest && !creditStatus.isOwner;
  const showConversionCTA = userStatus === "anonymous";

  function toast(msg: string) { setCreditToast(msg); setTimeout(() => setCreditToast(""), 4000); }

  async function submitCreditRequest() {
    if (!creditRole) return;
    setCreditSending(true);
    try {
      const res = await fetch("/api/credits/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id, role: creditRole, message: creditMessage || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreditModal(false); setCreditRole(""); setCreditMessage("");
        setCreditStatus({ ...creditStatus, hasPendingRequest: true });
        toast("Demande envoyée ! Le réalisateur sera notifié.");
      } else toast(data.error || "Erreur");
    } catch { toast("Erreur réseau"); }
    finally { setCreditSending(false); }
  }

  const catColor = categoryColors[project.category];
  const ownerCredit = project.credits.find((c) => c.profile_id === project.owner.id);
  const ownerRole = ownerCredit?.role_on_project || (project.owner.roles[0]?.role_name ?? "Réalisateur");
  const desc = project.description || "";
  const descLong = desc.length > 120;

  return (
    <>
      <div style={{ paddingBottom: 120 }}>
        {/* Banner for pending/refused */}
        {project.status && project.status !== "approved" && (
          <div style={{ padding: "12px 20px 0" }}>
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#1a1a1a", fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#f97316", borderLeft: "3px solid #f97316" }}>
              {project.status === "pending" ? "Aperçu — Ce film est en attente de validation." : "Ce film a été refusé."}
            </div>
          </div>
        )}

        {/* ===== ZONE 1 — IMAGE HERO (bannière) ===== */}
        <div className="relative w-full overflow-hidden bg-[#1a1a1a] h-[260px] lg:h-[440px]">
          {project.preview_url ? (
            <Image src={project.preview_url} alt={project.title} fill priority sizes="100vw" style={{ objectFit: "cover" }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="#C8FF00" style={{ opacity: 0.15 }}><path d="M8 5v14l11-7z" /></svg>
            </div>
          )}

          {/* Gradient overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, rgba(13,13,13,0.4) 60%, #0d0d0d 100%)", pointerEvents: "none" }} />

          {/* Back button */}
          <button onClick={() => router.back()} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, zIndex: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f0f0f0" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
          </button>

          {/* Options button */}
          <div ref={optionsRef} style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
            <button onClick={() => setShowOptions(!showOptions)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#f0f0f0"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
            </button>
            {showOptions && (
              <div style={{ position: "absolute", top: 42, right: 0, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 4, width: 180, zIndex: 20 }}>
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); setShowOptions(false); toast("Lien copié !"); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", fontSize: 13, color: "#e0e0e0", background: "none", border: "none", borderRadius: 6, cursor: "pointer" }}>Partager ce film</button>
                <button onClick={() => { setShowOptions(false); setReportOpen(true); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", fontSize: 13, color: "#888", background: "none", border: "none", borderRadius: 6, cursor: "pointer" }}>Signaler un probleme</button>
              </div>
            )}
          </div>

          {/* Play button */}
          <button onClick={() => setShowVideo(true)} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 60, height: 60, borderRadius: "50%", background: "rgba(0,0,0,0.65)", border: "2px solid rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 3 }}><path d="M8 5v14l11-7z" /></svg>
          </button>

          {/* Titre en surimpression — desktop uniquement */}
          <div className="hidden lg:flex absolute inset-0 flex-col justify-end pointer-events-none">
            <div className="mx-auto w-full max-w-[1280px] px-12 pb-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary mb-2">
                {project.year} &middot; {categoryLabels[project.category].toUpperCase()}
              </p>
              <h1 className="text-4xl xl:text-5xl font-bold tracking-tight text-text-primary leading-[1.05]">{project.title}</h1>
            </div>
          </div>
        </div>

        {/* ===== ZONE 2 — CONTENT ===== */}
        <div className="mx-auto w-full max-w-[1280px] px-5 lg:px-12" style={{ marginTop: -2 }}>
          <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 lg:items-start lg:pt-8">
          {/* ========= COLONNE PRINCIPALE ========= */}
          <div className="min-w-0">

          {/* Date + Titre + Pills + Regarder — mobile (sur desktop : bannière + sidebar) */}
          <div className="lg:hidden">
          {/* Date + category */}
          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.1em", color: "#555", textTransform: "uppercase", marginTop: 16, marginBottom: 8 }}>
            {project.year} &middot; {categoryLabels[project.category].toUpperCase()}
          </p>

          {/* Title */}
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8, color: "#f0f0f0", lineHeight: 1.1, margin: "0 0 14px" }}>{project.title}</h1>

          {/* Pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            <span style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "5px 12px", fontSize: 12, color: "#777" }}>{categoryLabels[project.category]}</span>
            <span style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "5px 12px", fontSize: 12, color: "#777" }}>{project.year}</span>
            <span style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "5px 12px", fontSize: 12, color: "#777" }}>{project.credits.length} talent{project.credits.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Regarder button */}
          <button onClick={() => setShowVideo(true)} style={{ width: "100%", background: "#C8FF00", color: "#0d0d0d", fontSize: 15, fontWeight: 600, borderRadius: 12, padding: 15, border: "none", cursor: "pointer", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Regarder
          </button>

          {/* Separator */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 24 }} />
          </div>

          {/* Synopsis + Équipe + Du même réalisateur (partagés mobile/desktop) */}
          <div className="lg:pt-2">

          {/* Synopsis */}
          {desc && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 10 }}>Synopsis</h2>
              <p style={{ fontSize: 14, color: "#777", lineHeight: 1.75, margin: 0, whiteSpace: "pre-line", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: synopsisOpen ? 9999 : 3, WebkitBoxOrient: "vertical" as const }}>{desc}</p>
              {descLong && (
                <button onClick={() => setSynopsisOpen(!synopsisOpen)} style={{ background: "none", border: "none", color: "#C8FF00", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0, marginTop: 6 }}>
                  {synopsisOpen ? "Réduire" : "Lire la suite"}
                </button>
              )}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "20px 0" }} />
            </>
          )}

          {/* Team */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>Équipe</h2>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#555" }}>({project.credits.length} talent{project.credits.length !== 1 ? "s" : ""})</span>
          </div>

          <div style={{ position: "relative" }}>
            <div className="no-scrollbar" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
              {project.credits.map((c) => {
                const fullName = c.profile?.full_name ?? c.ghost_name ?? "Inconnu";
                const isAnon = userStatus === "anonymous";
                // Anonymous: show "L. M." style initials only
                const maskedName = isAnon
                  ? fullName.split(" ").map((w) => w[0] + ".").join(" ")
                  : fullName;
                const displayName = isAnon ? maskedName : fullName;

                const card = (
                  <div style={{ width: 80, flexShrink: 0, textAlign: "center" }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: isAnon ? "rgba(255,255,255,0.06)" : "rgba(200,255,0,0.08)", border: isAnon ? "1.5px solid rgba(255,255,255,0.1)" : "1.5px solid rgba(200,255,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", overflow: "hidden" }}>
                      {!isAnon && c.profile?.avatar_url ? (
                        <img src={c.profile.avatar_url} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: isAnon ? 16 : 14, fontWeight: 600, color: isAnon ? "#555" : "#C8FF00" }}>{isAnon ? "?" : initials(fullName)}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 500, color: isAnon ? "#555" : "#f0f0f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{displayName}</p>
                    <p style={{ fontSize: 10, color: "#555", fontFamily: "JetBrains Mono, monospace", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.role_on_project}</p>
                  </div>
                );

                if (!isAnon && c.profile?.slug) {
                  return <Link key={c.id} href={`/profil/${c.profile.slug}`} style={{ textDecoration: "none", flexShrink: 0 }}>{card}</Link>;
                }
                return <div key={c.id} style={{ flexShrink: 0 }}>{card}</div>;
              })}
            </div>

            {/* Gradient overlay for anonymous */}
            {userStatus === "anonymous" && project.credits.length > 3 && (
              <div style={{ position: "relative", marginTop: -80, height: 80, background: "linear-gradient(rgba(13,13,13,0), rgba(13,13,13,0.95))", pointerEvents: "none" }} />
            )}
          </div>

          {/* Anonymous: conversion CTA */}
          {showConversionCTA && (
            <div style={{ background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.12)", borderRadius: 14, padding: 20, marginTop: 16, textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", marginBottom: 6 }}>Voir l&apos;équipe complète</p>
              <p style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>Crée un compte gratuit en 2 minutes</p>
              <button onClick={() => router.push("/rejoindre")} style={{ width: "100%", background: "#C8FF00", color: "#0d0d0d", fontSize: 14, fontWeight: 600, borderRadius: 10, padding: 12, border: "none", cursor: "pointer" }}>Créer mon compte gratuit</button>
            </div>
          )}

          <div className="lg:hidden">
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "20px 0" }} />

          {/* Director */}
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 12 }}>Réalisé par</h2>
          <Link href={`/profil/${project.owner.slug}`} style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
              <Avatar url={project.owner.avatar_url} name={project.owner.full_name} size={48} style={{ background: "rgba(200,255,0,0.08)", border: "1.5px solid rgba(200,255,0,0.2)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: "#f0f0f0", margin: 0 }}>{project.owner.full_name}</p>
                <p style={{ fontSize: 12, color: "#555", margin: "2px 0 0" }}>{ownerRole}</p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
          </div>

          {/* Related projects */}
          {relatedProjects.length > 0 && (
            <>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "20px 0" }} />
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 14 }}>Du même réalisateur</h2>
              <div className="flex gap-3 lg:gap-4 overflow-x-auto no-scrollbar pb-1">
                {relatedProjects.map((rp) => {
                  const rpColor = categoryColors[rp.category];
                  return (
                    <Link key={rp.id} href={`/projet/${rp.slug}`} className="flex-shrink-0 w-60 sm:w-72 group block">
                      <div
                        className="relative w-full bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden group-hover:border-white/10 group-hover:shadow-2xl group-hover:shadow-black/50 transition-all duration-300"
                        style={{ aspectRatio: "16/9" }}
                      >
                        {rp.preview_url || rp.poster_url ? (
                          <img src={(rp.preview_url || rp.poster_url) as string} alt={rp.title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="#C8FF00" style={{ opacity: 0.12 }}><path d="M8 5v14l11-7z" /></svg>
                          </div>
                        )}
                        <span
                          className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                          style={{ backgroundColor: rpColor + "20", color: rpColor }}
                        >
                          {categoryLabels[rp.category]}
                        </span>
                      </div>
                      <div className="mt-2.5 px-0.5">
                        <h3 className="text-[13px] font-semibold text-text-primary group-hover:text-lime transition-colors truncate">{rp.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-text-tertiary truncate">{rp.owner_name}</span>
                          <span className="text-[11px] text-text-tertiary/50 font-mono">{rp.year}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Crédit + statut — mobile (desktop : sidebar) */}
          <div className="lg:hidden">
          {showCreditButton && (
            <>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "20px 0" }} />
              <button onClick={() => setShowCreditModal(true)} style={{ width: "100%", border: "1px dashed rgba(200,255,0,0.25)", background: "transparent", borderRadius: 10, padding: 12, color: "#C8FF00", fontSize: 13, fontFamily: "JetBrains Mono, monospace", textAlign: "center", cursor: "pointer" }}>
                + J&apos;ai participe a ce projet
              </button>
            </>
          )}

          {creditStatus.hasPendingRequest && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 8, background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.2)", color: "#facc15", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>Demande en attente</span>
            </div>
          )}
          </div>

          </div>{/* fin wrapper partagé */}
          </div>{/* fin colonne principale */}

          {/* ========= SIDEBAR (desktop uniquement) ========= */}
          <aside className="hidden lg:block lg:sticky lg:top-8 space-y-4">
            {/* Fiche technique */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary mb-3">Fiche technique</p>
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3"><dt className="text-text-tertiary">Catégorie</dt><dd className="font-medium" style={{ color: catColor }}>{categoryLabels[project.category]}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="text-text-tertiary">Année</dt><dd className="font-medium font-mono text-text-primary">{project.year}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="text-text-tertiary">Talents</dt><dd className="font-medium text-text-primary">{project.credits.length}</dd></div>
              </dl>
            </div>

            {/* Regarder */}
            <button onClick={() => setShowVideo(true)} className="w-full inline-flex items-center justify-center gap-2 bg-lime text-[#0d0d0d] font-semibold text-sm rounded-xl px-6 py-3 hover:brightness-110 transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Regarder
            </button>

            {/* Réalisé par */}
            <Link href={`/profil/${project.owner.slug}`} className="block">
              <div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-white/10 transition">
                <Avatar url={project.owner.avatar_url} name={project.owner.full_name} size={48} style={{ background: "rgba(200,255,0,0.08)", border: "1.5px solid rgba(200,255,0,0.2)" }} />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary mb-0.5">Réalisé par</p>
                  <p className="text-sm font-medium text-text-primary truncate">{project.owner.full_name}</p>
                  <p className="text-xs text-text-tertiary truncate">{ownerRole}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M9 5l7 7-7 7" /></svg>
              </div>
            </Link>

            {/* Crédit + statut */}
            {showCreditButton && (
              <button onClick={() => setShowCreditModal(true)} className="w-full border border-dashed rounded-xl px-4 py-3 text-[13px] text-center transition" style={{ borderColor: "rgba(200,255,0,0.25)", color: "#C8FF00", background: "transparent", fontFamily: "JetBrains Mono, monospace" }}>
                + J&apos;ai participé à ce projet
              </button>
            )}
            {creditStatus.hasPendingRequest && (
              <div className="text-center">
                <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 8, background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.2)", color: "#facc15", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>Demande en attente</span>
              </div>
            )}
          </aside>

          </div>{/* fin grille */}
        </div>
      </div>

      {/* ===== VIDEO MODAL ===== */}
      <AnimatePresence>
        {showVideo && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onTouchStart={(e) => { videoTouchY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => {
              if (videoTouchY.current !== null && e.changedTouches[0].clientY - videoTouchY.current > 80) setShowVideo(false);
              videoTouchY.current = null;
            }}
            style={{ position: "fixed", inset: 0, zIndex: 9998, background: "black", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <button onClick={() => setShowVideo(false)} style={{ position: "absolute", top: 20, right: 20, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 9999 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0f0f0" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
            </button>
            <div style={{ width: "100%", maxWidth: 900, aspectRatio: "16/9" }}>
              <VideoEmbed url={project.video_url} title={project.title} autoplay />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {creditToast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ position: "fixed", top: 16, right: 16, zIndex: 50, padding: "10px 16px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 13, color: "#f0f0f0", maxWidth: 280 }}>
            {creditToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credit request modal */}
      <AnimatePresence>
        {showCreditModal && (
          <ModalBackdrop open={showCreditModal} onClose={() => setShowCreditModal(false)}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-text-primary mb-1">Demander à être crédité</h3>
              <p className="text-sm text-text-secondary mb-5">{project.title}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Ton rôle *</label>
                  <RoleSelector
                    selectedRoles={creditRole ? [creditRole] : []}
                    onChange={(roles) => setCreditRole(roles[0] || "")}
                    maxSelection={1}
                    singleSelect
                    placeholder="Ton rôle dans ce projet..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Message <span className="text-text-tertiary">({creditMessage.length}/300)</span></label>
                  <textarea rows={3} maxLength={300} value={creditMessage} onChange={(e) => setCreditMessage(e.target.value)} className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-base placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition resize-none" placeholder="Dis-lui comment tu as contribue..." />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={submitCreditRequest} disabled={!creditRole || creditSending} className="flex-1 py-3 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition disabled:opacity-40">
                  {creditSending ? "Envoi..." : "Envoyer la demande"}
                </button>
                <button onClick={() => setShowCreditModal(false)} className="px-5 py-3 border border-white/10 text-text-secondary text-sm rounded-lg hover:text-text-primary transition">Annuler</button>
              </div>
            </div>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="project"
        targetId={project.id}
      />
    </>
  );
}
