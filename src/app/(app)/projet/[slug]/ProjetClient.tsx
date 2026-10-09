"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import type { ManagerRequestKind, ManagerRequestStatus, Profile, ProfileRole, Project, ProjectCredit, ProjectCategory } from "@/types/database";
import VideoEmbed, { VIDEO_COOKIE_NOTICE } from "@/components/VideoEmbed";
import FilmMeta from "@/components/FilmMeta";
import Avatar from "@/components/Avatar";
import { EnterItem, ModalBackdrop } from "@/components/motion";
import FilmLink, { FilmPlayerFrame } from "@/components/FilmLink";
import FilmPoster from "@/components/FilmPoster";
import { backWithTransition } from "@/lib/film-transition";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";
import ReportModal from "@/components/ReportModal";
import RoleSelector from "@/components/RoleSelector";
import { useUserStatus } from "@/hooks/useUserStatus";
import { isDirectorRole } from "@/lib/credits";
import ClaimModal from "./ClaimModal";

type CreditWithProfile = ProjectCredit & {
  profile: (Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "location"> & { roles: ProfileRole[]; project_count: number }) | null;
};

type ProjectFull = Project & {
  credits: CreditWithProfile[];
};

type RelatedProject = Project & { director_name: string; common_collaborators: number };

// Réponse de GET /api/credits/status. isOwner = Responsable ; isManager =
// Responsable ou co-gestionnaire.
type FilmStatus = {
  isCredited: boolean;
  hasPendingRequest: boolean;
  isOwner: boolean;
  isManager: boolean;
  managerRequest: { id?: string; status: ManagerRequestStatus; kind: ManagerRequestKind } | null;
  claimPending: boolean;
};

const NO_STATUS: FilmStatus = {
  isCredited: false, hasPendingRequest: false, isOwner: false,
  isManager: false, managerRequest: null, claimPending: false,
};

interface Props {
  project: ProjectFull;
  relatedProjects: RelatedProject[];
  // Visiteur non connecté (décidé côté serveur) : l'équipe reçue est déjà masquée
  // (initiales), sauf les crédits de réalisation.
  isVisitor: boolean;
  categoryLabels: Record<ProjectCategory, string>;
  categoryColors: Record<ProjectCategory, string>;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const SECTION_TITLE = "text-[22px] font-bold tracking-tight text-text-primary";
const PLAY_ICON = "M8 5v14l11-7z";
const PLAYER_LOOK = "rounded-[22px] shadow-[0_60px_140px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.16)]";

// Le texte entre après l'agrandissement de la vignette (transition partagée) : le
// titre arrive en dernier.
const textStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } },
};

export default function ProjetClient({ project, relatedProjects, isVisitor, categoryLabels, categoryColors }: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [showVideo, setShowVideo] = useState(false);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  // Lecture dans le cadre (desktop) ; en mobile, modale plein écran (showVideo).
  const [playingInline, setPlayingInline] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  // Le lecteur ne se monte qu'après ce clic (règle cookies).
  function play() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setPlayingInline(true);
      playerRef.current?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    } else setShowVideo(true);
  }

  // User status for visibility tiers
  const userStatus = useUserStatus();

  // Credit request state
  const [creditStatus, setCreditStatus] = useState<FilmStatus>(NO_STATUS);
  const [creditStatusLoaded, setCreditStatusLoaded] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditRole, setCreditRole] = useState("");
  const [creditMessage, setCreditMessage] = useState("");
  const [creditSending, setCreditSending] = useState(false);
  const [creditToast, setCreditToast] = useState("");

  // Co-gestion et signalement de droits / revendication
  const [managerBusy, setManagerBusy] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  // Bouton « Signaler » unique : un membre qui peut revendiquer choisit entre un
  // problème (ReportModal) et ses droits (ClaimModal). Les autres (visiteur,
  // gestionnaire, revendication déjà en cours) vont droit au signalement.
  const openSignal = () => {
    if (!isVisitor && creditStatusLoaded && !creditStatus.isManager && !creditStatus.claimPending) setClaimOpen(true);
    else setReportOpen(true);
  };

  // Video modal touch swipe
  const videoTouchY = useRef<number | null>(null);

  useEffect(() => {
    fetch(`/api/credits/status?project_id=${project.id}`)
      .then((r) => r.json())
      .then((data) => { setCreditStatus({ ...NO_STATUS, ...data }); setCreditStatusLoaded(true); })
      .catch(() => setCreditStatusLoaded(true));
  }, [project.id]);


  // Lock body scroll when video modal open
  useEffect(() => {
    if (showVideo) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [showVideo]);

  const showCreditButton = userStatus === "free" && creditStatusLoaded && !creditStatus.isCredited && !creditStatus.hasPendingRequest && !creditStatus.isManager;
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
        toast("Demande envoyée ! Les gestionnaires du film seront notifiés.");
      } else toast(data.error || "Erreur");
    } catch { toast("Erreur réseau"); }
    finally { setCreditSending(false); }
  }

  // Co-gestion : POST = demander à co-gérer, DELETE = annuler sa demande,
  // PATCH = répondre à une invitation (accept requis).
  async function managerAction(method: "POST" | "DELETE" | "PATCH", accept = false) {
    const base = `/api/projects/${project.id}/managers`;
    const requestId = creditStatus.managerRequest?.id;
    setManagerBusy(true);
    try {
      const res = await fetch(method === "DELETE" ? `${base}?request_id=${requestId}` : base, {
        method,
        ...(method === "PATCH" && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: requestId, accept }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || "Erreur"); return; }
      if (method === "POST") {
        setCreditStatus((s) => ({ ...s, managerRequest: { id: data.request_id, status: "pending", kind: data.kind } }));
        toast("Demande envoyée au Responsable du film.");
      } else if (method === "DELETE") {
        setCreditStatus((s) => ({ ...s, managerRequest: null }));
        toast("Demande annulée.");
      } else {
        setCreditStatus((s) => ({ ...s, isManager: accept || s.isManager, managerRequest: null }));
        toast(accept ? "Tu co-gères maintenant ce film." : "Invitation refusée.");
      }
    } catch { toast("Erreur réseau"); }
    finally { setManagerBusy(false); }
  }

  const catColor = categoryColors[project.category];
  // Réalisateurs : crédits de réalisation du film (jamais son Responsable).
  // Aucun crédit de réalisation = aucun nom, le bloc « Réalisé par » disparaît.
  const directors = project.credits
    .filter((c) => isDirectorRole(c.role_on_project) && (c.profile?.full_name ?? c.ghost_name))
    .map((c) => ({
      id: c.id,
      name: (c.profile?.full_name ?? c.ghost_name) as string,
      slug: c.profile?.slug ?? null,
      avatar_url: c.profile?.avatar_url ?? null,
      role: c.role_on_project,
      location: c.profile?.location ?? null,
    }));

  // Actions d'un membre connecté sur le film (rendues en mobile et dans la sidebar).
  const pendingManagerRequest = creditStatus.managerRequest?.status === "pending" ? creditStatus.managerRequest : null;
  const canAskToManage = creditStatus.isCredited && !creditStatus.isManager && !pendingManagerRequest && Boolean(project.profile_id);
  const memberActions = !isVisitor && creditStatusLoaded && !creditStatus.isManager && (
    <div className="space-y-3">
      {pendingManagerRequest?.kind === "invite" && (
        <GlassCard className="p-4">
          <p className="mb-3 text-sm text-text-primary">Tu es invité à devenir co-gestionnaire de ce film.</p>
          {pendingManagerRequest.id && (
            <div className="flex gap-2">
              <Button size="sm" disabled={managerBusy} onClick={() => managerAction("PATCH", true)} className="flex-1">Accepter</Button>
              <Button size="sm" variant="glass" disabled={managerBusy} onClick={() => managerAction("PATCH", false)} className="flex-1">Refuser</Button>
            </div>
          )}
        </GlassCard>
      )}
      {pendingManagerRequest?.kind === "request" && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          <Badge variant="pending">Demande de co-gestion en attente</Badge>
          {pendingManagerRequest.id && (
            <button type="button" disabled={managerBusy} onClick={() => managerAction("DELETE")} className="text-xs text-text-secondary underline underline-offset-2 hover:text-text-primary disabled:opacity-50">
              Annuler
            </button>
          )}
        </div>
      )}
      {canAskToManage && (
        <Button variant="glass" size="sm" disabled={managerBusy} onClick={() => managerAction("POST")} className="w-full">
          Demander à co-gérer ce film
        </Button>
      )}
      {creditStatus.claimPending && (
        <p className="text-center text-xs text-text-tertiary">Ta demande est en cours de traitement par l&apos;équipe.</p>
      )}
    </div>
  );

  const desc = project.description || "";
  const descLong = desc.length > 280;
  const poster = project.preview_url || project.poster_url || null;
  const talents = `${project.credits.length} talent${project.credits.length !== 1 ? "s" : ""}`;

  return (
    <>
      <div className="mx-auto w-full max-w-[1160px] px-4 pb-10 pt-5 lg:px-10 lg:pb-16 lg:pt-9">
        {/* Banner for pending/refused */}
        {project.status && project.status !== "approved" && (
          <GlassCard className="mb-3 border-l-[3px] border-l-[#f97316] px-3.5 py-2.5 font-mono text-[11px] text-[#f97316]">
            {project.status === "pending" ? "Aperçu — Ce film est en attente de validation." : "Ce film a été refusé."}
          </GlassCard>
        )}

        {project.status === "approved" && project.visibility === "unpublished" && (
          <GlassCard className="mb-3 border-l-[3px] border-l-[#f97316] px-3.5 py-2.5 font-mono text-[11px] text-[#f97316]">
            Film dépublié : seuls ses gestionnaires le voient.
          </GlassCard>
        )}

        {/* ===== LECTEUR ===== */}
        {/* Hors animation d'entrée : l'affiche est prioritaire (LCP) et c'est elle que la
            vignette cliquée rejoint. Aucun texte dessus, seulement le bouton lecture. */}
        <section className="relative isolate">
          {/* Lumière : la même affiche, très floutée, derrière le lecteur */}
          {poster && (
            <div aria-hidden="true" className="film-ambient pointer-events-none absolute -top-[10%] left-[5%] -z-10 h-[105%] w-[90%] overflow-hidden rounded-full opacity-50">
              <Image src={poster} alt="" fill sizes="64px" className="object-cover" />
            </div>
          )}

          <button type="button" onClick={() => backWithTransition(playerRef.current?.querySelector<HTMLElement>("[data-film-player]") ?? null, () => router.back())} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm max-lg:hidden text-text-secondary transition-colors duration-fast hover:text-text-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            Retour
          </button>

          {/* Cadre fixe en 16:9 : l'affiche y tient à son format réel, la vidéo le remplit */}
          <div ref={playerRef}>
            {playingInline ? (
              <FilmPlayerFrame>
                <div data-film-player="" className={`overflow-hidden ${PLAYER_LOOK}`}>
                  <VideoEmbed url={project.video_url} title={project.title} autoplay />
                </div>
              </FilmPlayerFrame>
            ) : (
              <button type="button" onClick={play} aria-label={`Lancer ${project.title}`} className="press-spring group block w-full">
                <FilmPoster src={poster} alt={project.title} sizes="(max-width: 1160px) 100vw, 1080px" priority framed player className={PLAYER_LOOK}>
                  <span aria-hidden="true" className="glass-strong absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill bg-black/35 transition-transform duration-base ease-glass group-hover:scale-105 lg:size-[76px]">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 3 }}><path d={PLAY_ICON} /></svg>
                  </span>
                </FilmPoster>
              </button>
            )}
          </div>

          {/* Mention cookies : le lecteur ne se charge qu'au clic */}
          <p className="mt-3 text-center text-xs leading-snug text-text-tertiary">{VIDEO_COOKIE_NOTICE}</p>
        </section>

        {/* ===== CONTENU : deux colonnes ===== */}
        <motion.div variants={textStagger} initial="hidden" animate="show" className="mt-8 grid gap-7 lg:mt-11 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          {/* ========= COLONNE PRINCIPALE ========= */}
          <div className="min-w-0">
            <EnterItem>
              <FilmMeta size="md" category={project.category} year={project.year} />
            </EnterItem>

            <EnterItem>
              <h1 className="text-sheen mt-3 pb-1.5 text-[38px] font-extrabold leading-none tracking-[-0.035em] lg:text-[56px]">{project.title}</h1>

              {desc && (
                <>
                  <p className="mt-[18px] max-w-[620px] text-[17px] text-text-primary/85" style={{ lineHeight: 1.6, whiteSpace: "pre-line", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: synopsisOpen || !descLong ? 9999 : 4, WebkitBoxOrient: "vertical" as const }}>{desc}</p>
                  {descLong && (
                    <button onClick={() => setSynopsisOpen(!synopsisOpen)} className="mt-1.5 text-[13px] font-medium text-lime">
                      {synopsisOpen ? "Réduire" : "Lire la suite"}
                    </button>
                  )}
                </>
              )}

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Button onClick={play}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={PLAY_ICON} /></svg>
                  Lancer le film
                </Button>
                <Button variant="glass" onClick={() => { navigator.clipboard.writeText(window.location.href); toast("Lien copié !"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" /></svg>
                  Partager
                </Button>
              </div>
            </EnterItem>

            {/* Équipe en générique : rôle, avatar, nom */}
            <EnterItem>
              <div id="equipe" className="mb-4 mt-12 flex scroll-mt-6 items-baseline lg:scroll-mt-20 justify-between">
                <h2 className={SECTION_TITLE}>Équipe</h2>
                <span className="text-sm text-text-secondary">{talents}</span>
              </div>

              <div className="grid gap-x-7 sm:grid-cols-2">
                {project.credits.map((c) => {
                  // Chaque ligne est un conteneur (@container) : assez large, le rôle est à
                  // gauche ; sinon il passe en petit au-dessus du nom. Le nom n'est jamais coupé.
                  const fullName = c.profile?.full_name ?? c.ghost_name ?? "Inconnu";
                  // Visiteur : le serveur n'envoie que des initiales (« L. M. »), sauf pour
                  // les crédits de réalisation (nom complet, profil cliquable s'il existe).
                  const isAnon = isVisitor && !isDirectorRole(c.role_on_project);

                  const row = (
                    <div className="@container border-b border-white/[0.07]">
                    <div className="flex min-h-16 items-center gap-3.5 py-2.5">
                      <span className="hidden w-[110px] shrink-0 text-[13px] leading-tight text-text-tertiary @[300px]:block">{c.role_on_project}</span>
                      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ background: isAnon ? "rgba(255,255,255,0.06)" : "rgba(200,255,0,0.08)", border: isAnon ? "1.5px solid rgba(255,255,255,0.1)" : "1.5px solid rgba(200,255,0,0.2)" }}>
                        {!isAnon && c.profile?.avatar_url ? (
                          <img src={c.profile.avatar_url} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold" style={{ color: isAnon ? "#555" : "#C8FF00" }}>{isAnon ? "?" : initials(fullName)}</span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs leading-tight text-text-tertiary @[300px]:hidden">{c.role_on_project}</span>
                        <span className={`block break-words leading-snug ${isAnon ? "font-medium text-text-secondary" : "font-semibold text-text-primary group-hover:text-lime"} transition-colors duration-fast`}>{fullName}</span>
                      </span>
                    </div>
                    </div>
                  );

                  if (!isAnon && c.profile?.slug) {
                    return <Link key={c.id} href={`/profil/${c.profile.slug}`} className="group block">{row}</Link>;
                  }
                  return <div key={c.id}>{row}</div>;
                })}
              </div>

              {/* Visiteur : encart « Rejoindre » */}
              {showConversionCTA && (
                <GlassCard className="mt-5 flex flex-wrap items-center gap-4 px-5 py-[18px]">
                  <div className="flex-[1_1_300px]">
                    <p className="font-semibold text-text-primary">Découvre toute l&apos;équipe</p>
                    <p className="text-sm text-text-secondary">Crée ton profil gratuit pour voir les noms et ouvrir les profils.</p>
                  </div>
                  <Button href="/rejoindre">Rejoindre</Button>
                </GlassCard>
              )}
            </EnterItem>
          </div>

          {/* ========= COLONNE COLLANTE (sous le contenu en mobile) ========= */}
          <aside className="flex flex-col gap-3.5 lg:sticky lg:top-[88px] lg:self-start">
            {/* Réalisé par */}
            {directors.length > 0 && (
              <EnterItem>
                <GlassCard className="flex flex-col gap-3.5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-tertiary">Réalisé par</p>
                  {directors.map((d) => (
                    <div key={d.id} className="flex flex-col gap-3.5">
                      <div className="flex items-center gap-3.5">
                        <Avatar url={d.avatar_url} name={d.name} size={52} style={{ background: "rgba(200,255,0,0.08)", border: "1.5px solid rgba(200,255,0,0.2)" }} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-text-primary">{d.name}</p>
                          <p className="truncate text-[13px] text-text-secondary">{[d.role, d.location].filter(Boolean).join(" · ")}</p>
                        </div>
                      </div>
                      {d.slug && <Button variant="glass" href={`/profil/${d.slug}`}>Voir le profil</Button>}
                    </div>
                  ))}
                </GlassCard>
              </EnterItem>
            )}

            {/* Fiche technique */}
            <EnterItem>
              <GlassCard className="px-5 py-2">
                <dl className="text-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] py-2.5"><dt className="text-text-secondary">Catégorie</dt><dd className="font-medium" style={{ color: catColor }}>{categoryLabels[project.category]}</dd></div>
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] py-2.5"><dt className="text-text-secondary">Année</dt><dd className="font-mono font-medium text-text-primary">{project.year}</dd></div>
                  <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-text-secondary">Équipe</dt><dd className="font-medium text-text-primary">{talents}</dd></div>
                </dl>
              </GlassCard>
            </EnterItem>

            {/* Crédit + statut */}
            {showCreditButton && (
              <Button variant="dashed" size="sm" onClick={() => setShowCreditModal(true)} className="w-full font-mono">
                + J&apos;ai participé à ce projet
              </Button>
            )}
            {creditStatus.hasPendingRequest && (
              <div className="text-center">
                <Badge variant="pending">Demande en attente</Badge>
              </div>
            )}
            {memberActions}

            {!creditStatus.claimPending && (
              <button type="button" onClick={openSignal} className="inline-flex min-h-11 items-center gap-2 self-start text-[13px] text-text-tertiary transition-colors duration-fast hover:text-text-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4h11l-2 4 2 4H5" /></svg>
                Signaler ce film
              </button>
            )}
          </aside>
        </motion.div>

        {/* ===== FILMS LIÉS ===== */}
        {relatedProjects.length > 0 && (
          <section className="mt-12 lg:mt-16">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className={SECTION_TITLE}>Films liés</h2>
              <span className="text-sm text-text-secondary">Mêmes talents</span>
            </div>
            {/* Même hauteur pour toutes les affiches, largeur au format réel de l'image */}
            <div className="flex flex-wrap gap-4">
              {relatedProjects.slice(0, 4).map((rp) => (
                <FilmLink key={rp.id} slug={rp.slug} className="group flex w-fit max-w-full flex-col items-start gap-2.5">
                  <FilmPoster
                    src={rp.preview_url || rp.poster_url}
                    alt={rp.title}
                    sizes="(max-width: 1024px) 50vw, 260px"
                    className="h-[92px] rounded-media border sm:h-[120px] lg:h-[142px] border-white/[0.11] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.75)] transition-[translate,box-shadow,border-color] duration-base ease-glass group-hover:border-white/20 group-hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.9)] motion-safe:group-hover:-translate-y-1"
                  />
                  <div className="w-0 min-w-full px-0.5">
                    <h3 className="truncate text-[15px] font-semibold text-text-primary transition-colors group-hover:text-lime">{rp.title}</h3>
                    <FilmMeta category={rp.category} author={rp.director_name} year={rp.year} className="mt-1" />
                  </div>
                </FilmLink>
              ))}
            </div>
          </section>
        )}
      </div>

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
                <Field multiline rows={3} maxLength={300} label={<>Message <span className="text-text-tertiary">({creditMessage.length}/300)</span></>} value={creditMessage} onChange={(e) => setCreditMessage(e.target.value)} placeholder="Dis-lui comment tu as contribue..." />
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

      {/* Signalement de droits / revendication (traité par l'équipe) */}
      <AnimatePresence>
        {claimOpen && (
          <ClaimModal
            open={claimOpen}
            onClose={() => setClaimOpen(false)}
            projectId={project.id}
            projectTitle={project.title}
            onReport={() => { setClaimOpen(false); setReportOpen(true); }}
            onSent={() => {
              setClaimOpen(false);
              setCreditStatus((s) => ({ ...s, claimPending: true }));
              toast("Demande envoyée. L'équipe Unkast la traite.");
            }}
          />
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
