"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Profile, ProfileRole, Project, ProjectCredit, ProjectCategory } from "@/types/database";
import VideoEmbed from "@/components/VideoEmbed";
import Avatar from "@/components/Avatar";
import { EnterItem, EnterList, ModalBackdrop } from "@/components/motion";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
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

const SEPARATOR = "h-px bg-white/[0.06] my-5";
const SECTION_TITLE = "text-base font-semibold text-text-primary";
const INFO_PILL = "glass rounded-pill px-3 py-1 text-xs text-text-secondary";
const PENDING_BADGE = "inline-block rounded-pill border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 font-mono text-[11px] text-yellow-400";
const PLAY_ICON = "M8 5v14l11-7z";

export default function ProjetClient({ project, relatedProjects, categoryLabels, categoryColors }: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
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
      <EnterList className="pb-tabbar">
        <div className="mx-auto w-full max-w-[1280px] px-5 lg:px-12 pt-3 lg:pt-6">
        {/* Banner for pending/refused */}
        {project.status && project.status !== "approved" && (
          <GlassCard className="mb-3 border-l-[3px] border-l-[#f97316] px-3.5 py-2.5 font-mono text-[11px] text-[#f97316]">
            {project.status === "pending" ? "Aperçu — Ce film est en attente de validation." : "Ce film a été refusé."}
          </GlassCard>
        )}

        {/* ===== ZONE 1 — IMAGE HERO (bannière) ===== */}
        {/* Hors EnterItem : l'image est prioritaire (LCP), elle ne doit pas attendre l'hydratation. */}
        <div className="relative w-full overflow-hidden rounded-panel border border-white/10 bg-white/[0.04] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] h-[260px] lg:h-[440px]">
          {project.preview_url ? (
            <Image src={project.preview_url} alt={project.title} fill priority sizes="100vw" style={{ objectFit: "cover" }} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="#C8FF00" style={{ opacity: 0.15 }}><path d={PLAY_ICON} /></svg>
            </div>
          )}

          {/* Gradient overlay (lisibilité du titre et des boutons) */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(10,10,12,0.25) 0%, transparent 30%, transparent 50%, rgba(10,10,12,0.8) 100%)" }} />

          {/* Back button */}
          <Button variant="icon" aria-label="Retour" onClick={() => router.back()} className="absolute top-4 left-4 z-10 bg-black/35">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
          </Button>

          {/* Options button */}
          <div ref={optionsRef} className="absolute top-4 right-4 z-10">
            <Button variant="icon" aria-label="Options" onClick={() => setShowOptions(!showOptions)} className="bg-black/35">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
            </Button>
            {showOptions && (
              <GlassCard strong className="absolute top-12 right-0 z-20 w-[180px] bg-black/50 p-1">
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); setShowOptions(false); toast("Lien copié !"); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-[13px] text-text-primary hover:bg-white/[0.06]">Partager ce film</button>
                <button onClick={() => { setShowOptions(false); setReportOpen(true); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-[13px] text-text-secondary hover:bg-white/[0.06]">Signaler un probleme</button>
              </GlassCard>
            )}
          </div>

          {/* Play button */}
          <Button variant="icon" aria-label="Regarder" onClick={() => setShowVideo(true)} className="absolute top-1/2 left-1/2 size-16 -translate-x-1/2 -translate-y-1/2 bg-black/35">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 3 }}><path d={PLAY_ICON} /></svg>
          </Button>

          {/* Titre en surimpression — desktop uniquement */}
          <div className="hidden lg:flex absolute inset-0 flex-col justify-end pointer-events-none">
            <div className="w-full px-10 pb-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary mb-2">
                {project.year} &middot; {categoryLabels[project.category].toUpperCase()}
              </p>
              <h1 className="text-sheen text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1] pb-1">{project.title}</h1>
            </div>
          </div>
        </div>

        {/* ===== ZONE 2 — CONTENT ===== */}
          <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 lg:items-start lg:pt-8 pb-6 lg:pb-12">
          {/* ========= COLONNE PRINCIPALE ========= */}
          <div className="min-w-0">

          {/* Date + Titre + Pills + Regarder — mobile (sur desktop : bannière + sidebar) */}
          <EnterItem className="lg:hidden">
          {/* Date + category */}
          <p className="mt-5 mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
            {project.year} &middot; {categoryLabels[project.category].toUpperCase()}
          </p>

          {/* Title */}
          <h1 className="text-sheen mb-3.5 pb-0.5 text-[28px] font-bold leading-[1.15]">{project.title}</h1>

          {/* Pills */}
          <div className="mb-5 flex flex-wrap gap-2">
            <span className={INFO_PILL}>{categoryLabels[project.category]}</span>
            <span className={INFO_PILL}>{project.year}</span>
            <span className={INFO_PILL}>{project.credits.length} talent{project.credits.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Regarder button */}
          <Button onClick={() => setShowVideo(true)} className="mb-6 min-h-12! w-full text-[15px]!">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={PLAY_ICON} /></svg>
            Regarder
          </Button>

          {/* Separator */}
          <div className="h-px bg-white/[0.06] mb-6" />
          </EnterItem>

          {/* Synopsis + Équipe + Du même réalisateur (partagés mobile/desktop) */}
          <div className="lg:pt-2">

          {/* Synopsis */}
          {desc && (
            <EnterItem>
              <h2 className={`${SECTION_TITLE} mb-2.5`}>Synopsis</h2>
              <p className="text-sm text-text-secondary" style={{ lineHeight: 1.75, margin: 0, whiteSpace: "pre-line", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: synopsisOpen ? 9999 : 3, WebkitBoxOrient: "vertical" as const }}>{desc}</p>
              {descLong && (
                <button onClick={() => setSynopsisOpen(!synopsisOpen)} className="mt-1.5 text-[13px] font-medium text-lime">
                  {synopsisOpen ? "Réduire" : "Lire la suite"}
                </button>
              )}
              <div className={SEPARATOR} />
            </EnterItem>
          )}

          {/* Team */}
          <EnterItem>
          <div className="mb-4 flex items-center justify-between">
            <h2 className={SECTION_TITLE}>Équipe</h2>
            <span className="font-mono text-[11px] text-text-tertiary">({project.credits.length} talent{project.credits.length !== 1 ? "s" : ""})</span>
          </div>

          <div style={{ position: "relative" }}>
            {/* Gradient overlay for anonymous : fondu par masque (plus de dégradé opaque vers le fond) */}
            <div
              className="no-scrollbar flex gap-3 overflow-x-auto pb-1"
              style={userStatus === "anonymous" && project.credits.length > 3 ? { maskImage: "linear-gradient(#000 15%, rgba(0,0,0,0.05))", WebkitMaskImage: "linear-gradient(#000 15%, rgba(0,0,0,0.05))" } : undefined}
            >
              {project.credits.map((c) => {
                const fullName = c.profile?.full_name ?? c.ghost_name ?? "Inconnu";
                const isAnon = userStatus === "anonymous";
                // Anonymous: show "L. M." style initials only
                const maskedName = isAnon
                  ? fullName.split(" ").map((w) => w[0] + ".").join(" ")
                  : fullName;
                const displayName = isAnon ? maskedName : fullName;

                const card = (
                  <GlassCard className="w-[104px] px-2.5 py-3 text-center transition-colors duration-fast group-hover:border-white/20">
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: isAnon ? "rgba(255,255,255,0.06)" : "rgba(200,255,0,0.08)", border: isAnon ? "1.5px solid rgba(255,255,255,0.1)" : "1.5px solid rgba(200,255,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", overflow: "hidden" }}>
                      {!isAnon && c.profile?.avatar_url ? (
                        <img src={c.profile.avatar_url} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: isAnon ? 16 : 14, fontWeight: 600, color: isAnon ? "#555" : "#C8FF00" }}>{isAnon ? "?" : initials(fullName)}</span>
                      )}
                    </div>
                    <p className="truncate text-[11px] font-medium" style={{ color: isAnon ? "#555" : "#f0f0f0", margin: 0 }}>{displayName}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-text-tertiary">{c.role_on_project}</p>
                  </GlassCard>
                );

                if (!isAnon && c.profile?.slug) {
                  return <Link key={c.id} href={`/profil/${c.profile.slug}`} className="group" style={{ textDecoration: "none", flexShrink: 0 }}>{card}</Link>;
                }
                return <div key={c.id} style={{ flexShrink: 0 }}>{card}</div>;
              })}
            </div>
          </div>

          {/* Anonymous: conversion CTA */}
          {showConversionCTA && (
            <GlassCard className="mt-4 border-lime/20 p-5 text-center">
              <p className="mb-1.5 text-sm font-semibold text-text-primary">Voir l&apos;équipe complète</p>
              <p className="mb-3.5 text-xs text-text-secondary">Crée un compte gratuit en 2 minutes</p>
              <Button onClick={() => router.push("/rejoindre")} className="w-full">Créer mon compte gratuit</Button>
            </GlassCard>
          )}
          </EnterItem>

          <EnterItem className="lg:hidden">
          <div className={SEPARATOR} />

          {/* Director */}
          <h2 className={`${SECTION_TITLE} mb-3`}>Réalisé par</h2>
          <Link href={`/profil/${project.owner.slug}`} style={{ textDecoration: "none" }}>
            <GlassCard className="flex items-center gap-3.5 px-4 py-3.5">
              <Avatar url={project.owner.avatar_url} name={project.owner.full_name} size={48} style={{ background: "rgba(200,255,0,0.08)", border: "1.5px solid rgba(200,255,0,0.2)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="text-[15px] font-medium text-text-primary" style={{ margin: 0 }}>{project.owner.full_name}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{ownerRole}</p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 5l7 7-7 7" /></svg>
            </GlassCard>
          </Link>
          </EnterItem>

          {/* Related projects */}
          {relatedProjects.length > 0 && (
            <EnterItem>
              <div className={SEPARATOR} />
              <h2 className={`${SECTION_TITLE} mb-2.5`}>Du même réalisateur</h2>
              {/* pt-2 : place pour l'élévation au survol (overflow-x-auto rogne aussi en vertical) */}
              <div className="flex gap-3 lg:gap-4 overflow-x-auto no-scrollbar pt-2 pb-1">
                {relatedProjects.map((rp) => {
                  const rpColor = categoryColors[rp.category];
                  return (
                    <Link key={rp.id} href={`/projet/${rp.slug}`} className="flex-shrink-0 w-60 sm:w-72 group block">
                      <div
                        className="relative w-full bg-white/[0.04] border border-white/10 rounded-media overflow-hidden shadow-[0_18px_40px_-12px_rgba(0,0,0,0.75)] transition-[translate,box-shadow,border-color] duration-base ease-glass group-hover:border-white/20 group-hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.9)] motion-safe:group-hover:-translate-y-1"
                        style={{ aspectRatio: "16/9" }}
                      >
                        {rp.preview_url || rp.poster_url ? (
                          <img src={(rp.preview_url || rp.poster_url) as string} alt={rp.title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="#C8FF00" style={{ opacity: 0.12 }}><path d={PLAY_ICON} /></svg>
                          </div>
                        )}
                        {/* Bouton lecture en verre (décoratif : toute la carte est le lien) */}
                        <span aria-hidden="true" className="glass absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill bg-black/35">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 2 }}><path d={PLAY_ICON} /></svg>
                        </span>
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
            </EnterItem>
          )}

          {/* Crédit + statut — mobile (desktop : sidebar) */}
          <EnterItem className="lg:hidden">
          {showCreditButton && (
            <>
              <div className={SEPARATOR} />
              <Button variant="glass" onClick={() => setShowCreditModal(true)} className="w-full border-dashed border-lime/30 font-mono text-[13px]! font-normal! text-lime!">
                + J&apos;ai participe a ce projet
              </Button>
            </>
          )}

          {creditStatus.hasPendingRequest && (
            <div className="mt-4 text-center">
              <span className={PENDING_BADGE}>Demande en attente</span>
            </div>
          )}
          </EnterItem>

          </div>{/* fin wrapper partagé */}
          </div>{/* fin colonne principale */}

          {/* ========= SIDEBAR (desktop uniquement) ========= */}
          <aside className="hidden lg:block lg:sticky lg:top-8 space-y-4">
            {/* Fiche technique */}
            <EnterItem>
            <GlassCard className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary mb-3">Fiche technique</p>
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3"><dt className="text-text-secondary">Catégorie</dt><dd className="font-medium" style={{ color: catColor }}>{categoryLabels[project.category]}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="text-text-secondary">Année</dt><dd className="font-medium font-mono text-text-primary">{project.year}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="text-text-secondary">Talents</dt><dd className="font-medium text-text-primary">{project.credits.length}</dd></div>
              </dl>
            </GlassCard>
            </EnterItem>

            {/* Regarder */}
            <EnterItem>
            <Button onClick={() => setShowVideo(true)} className="min-h-12! w-full">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d={PLAY_ICON} /></svg>
              Regarder
            </Button>
            </EnterItem>

            {/* Réalisé par */}
            <EnterItem>
            <Link href={`/profil/${project.owner.slug}`} className="block">
              <GlassCard className="flex items-center gap-3 p-4 transition-colors duration-fast hover:border-white/20">
                <Avatar url={project.owner.avatar_url} name={project.owner.full_name} size={48} style={{ background: "rgba(200,255,0,0.08)", border: "1.5px solid rgba(200,255,0,0.2)" }} />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary mb-0.5">Réalisé par</p>
                  <p className="text-sm font-medium text-text-primary truncate">{project.owner.full_name}</p>
                  <p className="text-xs text-text-secondary truncate">{ownerRole}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M9 5l7 7-7 7" /></svg>
              </GlassCard>
            </Link>
            </EnterItem>

            {/* Crédit + statut */}
            {showCreditButton && (
              <Button variant="glass" onClick={() => setShowCreditModal(true)} className="w-full border-dashed border-lime/30 font-mono text-[13px]! font-normal! text-lime!">
                + J&apos;ai participé à ce projet
              </Button>
            )}
            {creditStatus.hasPendingRequest && (
              <div className="text-center">
                <span className={PENDING_BADGE}>Demande en attente</span>
              </div>
            )}
          </aside>

          </div>{/* fin grille */}
        </div>
      </EnterList>

      {/* ===== VIDEO MODAL ===== */}
      <AnimatePresence>
        {showVideo && (
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : "100%" }}
            transition={{ duration: reduced ? 0.15 : 0.3, ease: "easeOut" }}
            onTouchStart={(e) => { videoTouchY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => {
              if (videoTouchY.current !== null && e.changedTouches[0].clientY - videoTouchY.current > 80) setShowVideo(false);
              videoTouchY.current = null;
            }}
            style={{ position: "fixed", inset: 0, zIndex: 9998, background: "black", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Button variant="icon" aria-label="Fermer" onClick={() => setShowVideo(false)} className="absolute top-5 right-5" style={{ zIndex: 9999 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
            </Button>
            {/* Panneau arrondi à partir de lg seulement : en mobile la vidéo est bord à bord,
                l'arrondi rognerait les contrôles du lecteur. */}
            <div className="lg:overflow-hidden lg:rounded-panel lg:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]" style={{ width: "100%", maxWidth: 900, aspectRatio: "16/9" }}>
              <VideoEmbed url={project.video_url} title={project.title} autoplay />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {creditToast && (
          <motion.div initial={{ opacity: 0, y: reduced ? 0 : -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -20 }} className="glass-strong rounded-card fixed top-4 right-4 z-50 max-w-[280px] px-4 py-2.5 text-[13px] text-text-primary">
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
                  <textarea rows={3} maxLength={300} value={creditMessage} onChange={(e) => setCreditMessage(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-card text-text-primary text-base placeholder:text-text-tertiary focus:outline-none focus:ring-3 focus:ring-lime/30 transition resize-none" placeholder="Dis-lui comment tu as contribue..." />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <Button onClick={submitCreditRequest} disabled={!creditRole || creditSending} className="flex-1">
                  {creditSending ? "Envoi..." : "Envoyer la demande"}
                </Button>
                <Button variant="glass" onClick={() => setShowCreditModal(false)}>Annuler</Button>
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
