"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FadeInView, cardHover, staggerContainer, fadeUp } from "@/components/motion";
import type { Profile, ProfileRole, Project, ProjectCredit, ProjectCategory } from "@/types/database";
import VideoFacade from "@/components/VideoFacade";
import Avatar from "@/components/Avatar";
import ReportModal, { ReportButton } from "@/components/ReportModal";
import RoleSelector from "@/components/RoleSelector";
import { useUserStatus } from "@/hooks/useUserStatus";
import { getDisplayName } from "@/lib/profile";

type CreditWithProfile = ProjectCredit & {
  profile: Pick<Profile, "full_name" | "slug" | "avatar_url"> | null;
};

type ProjectWithCredits = Project & {
  credits: CreditWithProfile[];
};

type ProfileData = Profile & {
  roles: ProfileRole[];
  // Badge « recruteur verifie » deja arbitre cote serveur (recruiter_verified ET
  // plan='pro') — voir page.tsx. Le client n'a pas le plan et ne rejoue pas la
  // regle : il affiche ce booleen tel quel.
  show_verified_badge: boolean;
  projects: ProjectWithCredits[];
};

interface Props {
  profile: ProfileData;
  categories: ProjectCategory[];
  categoryLabels: Record<ProjectCategory, string>;
  categoryColors: Record<ProjectCategory, string>;
}

export default function ProfileClient({
  profile,
  categories,
  categoryLabels,
  categoryColors,
}: Props) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<ProjectCategory | "all">("all");
  const [expandedCredits, setExpandedCredits] = useState<Set<string>>(new Set());
  const [contacting, setContacting] = useState(false);
  const [shareTooltip, setShareTooltip] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteProjects, setInviteProjects] = useState<any[]>([]);
  const [inviteSelectedProject, setInviteSelectedProject] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [viewerIsCreator, setViewerIsCreator] = useState(false);
  // Recrutement — signaux "Disponible" du visiteur vers ce recruteur (chantier 2).
  const [availSignals, setAvailSignals] = useState<{ role: string; expires_at: string }[]>([]);
  const [availBusy, setAvailBusy] = useState<string | null>(null);
  const userStatus = useUserStatus();

  useEffect(() => {
    async function checkOwn() {
      try {
        const { createBrowserClient } = await import("@supabase/ssr");
        const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { data: { user } } = await sb.auth.getUser();
        if (user && user.id === profile.id) setIsOwnProfile(true);
        if (user) {
          const { data: viewerProfile } = await sb.from("profiles").select("account_type").eq("id", user.id).single();
          if (viewerProfile?.account_type === "creator") setViewerIsCreator(true);
        }
      } catch {}
    }
    checkOwn();
  }, [profile.id]);

  const filteredProjects =
    activeFilter === "all"
      ? profile.projects
      : profile.projects.filter((p) => p.category === activeFilter);

  function toggleCredits(projectId: string) {
    setExpandedCredits((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setShareTooltip(true);
    setTimeout(() => setShareTooltip(false), 2000);
  }

  // Contact unifie : un Pro ouvre directement une conversation (messagerie),
  // sans re-saisir nom/email. Plus d'ancien formulaire contact_requests.
  async function openConversation() {
    setContacting(true);
    try {
      const res = await fetch("/api/messages/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: profile.id }),
      });
      const data = await res.json();
      if (res.ok && data.conversation_id) {
        router.push(`/messages/${data.conversation_id}`);
      } else if (data.error === "free_contact_limit_reached") {
        // Quota gratuit épuisé. Message explicite (distinct de l'ancien « passe
        // à Pro pour contacter ») avant de renvoyer vers l'offre.
        setContacting(false);
        alert(data.message || "Tu as utilisé tes contacts gratuits.");
        router.push("/pro");
      } else if (res.status === 403 || data.redirect) {
        router.push(data.redirect || "/pro");
      } else {
        alert(data.error || "Erreur");
        setContacting(false);
      }
    } catch {
      alert("Erreur réseau");
      setContacting(false);
    }
  }

  async function openInviteModal() {
    const res = await fetch("/api/dashboard/projects");
    if (res.ok) {
      const data = await res.json();
      setInviteProjects(data.projects || []);
    }
    setShowInviteModal(true);
  }

  async function sendInvitation() {
    if (!inviteSelectedProject || !inviteRole) return;
    setInviteSending(true);
    try {
      const res = await fetch("/api/invitations/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: inviteSelectedProject,
          invited_profile_id: profile.id,
          role: inviteRole,
          message: inviteMessage || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowInviteModal(false);
        setInviteSelectedProject(null);
        setInviteRole("");
        setInviteMessage("");
        // Show toast - use a simple alert or add toast state
      } else {
        alert(data.error || "Erreur");
      }
    } catch { alert("Erreur réseau"); }
    finally { setInviteSending(false); }
  }

  // --- Recrutement : disponibilité (côté talent) ---
  const isRecruiting = Boolean((profile as Profile).is_recruiting);
  const recruitingRoles = ((profile as Profile).recruiting_roles ?? []) as string[];

  // Hydrate l'état des signaux pour un visiteur connecté non-Pro (les Pro ne
  // voient pas le bloc : Pro ↔ Pro = contact direct).
  useEffect(() => {
    if (userStatus !== "free" || isOwnProfile || !isRecruiting) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/availability?recruiter=${profile.id}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setAvailSignals(data.signals || []);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [userStatus, isOwnProfile, isRecruiting, profile.id]);

  async function signalAvailable(role: string) {
    setAvailBusy(role);
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiter_id: profile.id, role }),
      });
      const data = await res.json();
      if (res.ok && data.signal) {
        setAvailSignals((prev) => [...prev.filter((s) => s.role !== role), data.signal]);
      } else {
        alert(data.error || "Erreur");
      }
    } catch { alert("Erreur réseau"); }
    finally { setAvailBusy(null); }
  }

  async function extendAvailable(role: string) {
    setAvailBusy(role);
    try {
      const res = await fetch("/api/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiter_id: profile.id, role }),
      });
      const data = await res.json();
      if (res.ok && data.signal) {
        setAvailSignals((prev) => prev.map((s) => (s.role === role ? data.signal : s)));
      } else {
        alert(data.error || "Erreur");
      }
    } catch { alert("Erreur réseau"); }
    finally { setAvailBusy(null); }
  }

  async function withdrawAvailable(role: string) {
    setAvailBusy(role);
    try {
      const res = await fetch("/api/availability", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiter_id: profile.id, role }),
      });
      if (res.ok) {
        setAvailSignals((prev) => prev.filter((s) => s.role !== role));
      } else {
        const data = await res.json();
        alert(data.error || "Erreur");
      }
    } catch { alert("Erreur réseau"); }
    finally { setAvailBusy(null); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="pb-tabbar">
      <style>{`@keyframes recruiting-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }`}</style>
      <main className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-16 py-4 sm:py-6 lg:py-10">
        <div className="flex flex-col lg:flex-row lg:gap-12 lg:items-start">
        {/* Left column — profile info */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="lg:w-80 lg:flex-shrink-0 lg:sticky lg:top-6 mb-8 lg:mb-0">
          {/* Avatar */}
          <div className="mb-5">
            <Avatar url={profile.avatar_url} name={profile.full_name} size={88} style={{ background: "rgba(255,255,255,0.03)", border: "2px solid rgba(200,255,0,0.2)" }} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-[24px] font-semibold text-text-primary" style={{ letterSpacing: "-0.5px" }}>
                {getDisplayName(profile as Parameters<typeof getDisplayName>[0])}
              </h1>
              {profile.is_available && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal/10 border border-teal/30 text-teal text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                  Disponible
                </span>
              )}
            </div>

            {/* Roles */}
            <div className="flex flex-wrap gap-2 mb-4">
              {profile.roles.map((role) => (
                <span
                  key={role.id}
                  className="px-3 py-1 rounded-[20px] bg-[rgba(200,255,0,0.1)] border border-[rgba(200,255,0,0.2)] text-[#C8FF00] text-xs font-medium"
                >
                  {role.role_name}
                </span>
              ))}
            </div>

            {/* Badge "recruteur vérifié" — double condition (vérification admin +
                Pro actif), arbitrée côté serveur dans page.tsx. */}
            {profile.show_verified_badge && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 20, padding: "5px 12px", marginBottom: 10 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#38bdf8" }}>Recruteur vérifié</span>
              </div>
            )}

            {/* Recruiting badge */}
            {(profile as any).is_recruiting && (profile as any).recruiting_roles?.length > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "6px 14px", marginTop: 2, marginBottom: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "recruiting-pulse 2s ease infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "#22c55e" }}>Je recrute</span>
                <span style={{ color: "rgba(34,197,94,0.4)", fontSize: 12 }}>·</span>
                <span style={{ fontSize: 12, color: "rgba(34,197,94,0.8)" }}>
                  {(() => {
                    const roles = (profile as any).recruiting_roles as string[];
                    if (roles.length === 1) return roles[0];
                    if (roles.length === 2) return roles.join(" · ");
                    return `${roles[0]} · ${roles[1]} +${roles.length - 2}`;
                  })()}
                </span>
              </div>
            )}

            {/* Disponibilité — signal côté talent (chantier 2). Masqué : sur son
                propre profil, pour les Pro (contact direct), et si pas de recrutement. */}
            {!isOwnProfile && isRecruiting && recruitingRoles.length > 0 && userStatus !== "pro" && userStatus !== null && (
              <div style={{ marginTop: 4, marginBottom: 14, padding: 14, background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.15)", borderRadius: 12, maxWidth: 280 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", margin: 0, marginBottom: 4 }}>Te signaler disponible</p>
                {userStatus === "anonymous" ? (
                  <>
                    <p style={{ fontSize: 12, color: "#777", margin: 0, marginBottom: 12, lineHeight: 1.5 }}>
                      Connecte-toi pour indiquer à {profile.full_name.split(" ")[0]} que tu es disponible pour un poste.
                    </p>
                    <button onClick={() => router.push("/rejoindre")} style={{ width: "100%", background: "#C8FF00", color: "#0d0d0d", fontSize: 13, fontWeight: 600, borderRadius: 10, padding: 11, border: "none", cursor: "pointer" }}>
                      Rejoindre Unkast
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 12, color: "#777", margin: 0, marginBottom: 12, lineHeight: 1.5 }}>
                      Sur quel poste es-tu disponible ?
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {recruitingRoles.map((role) => {
                        const signal = availSignals.find((s) => s.role === role);
                        const busy = availBusy === role;
                        if (signal) {
                          return (
                            <div key={role} style={{ padding: "10px 12px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#22c55e" }}>Disponible — {role}</span>
                              </div>
                              <p style={{ fontSize: 11, color: "#777", margin: 0, marginBottom: 8 }}>
                                Expire le {new Date(signal.expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                              </p>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => extendAvailable(role)} disabled={busy} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#f0f0f0", fontSize: 12, fontWeight: 500, borderRadius: 8, padding: "7px 0", cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}>Prolonger</button>
                                <button onClick={() => withdrawAvailable(role)} disabled={busy} style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#888", fontSize: 12, fontWeight: 500, borderRadius: 8, padding: "7px 0", cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}>Retirer</button>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <button key={role} onClick={() => signalAvailable(role)} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.25)", color: "#C8FF00", fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "10px 14px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, textAlign: "left" }}>
                            <span>Disponible — {role}</span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Location */}
            {profile.location && (
              <p className="text-sm text-text-secondary mb-3">
                <svg className="inline-block w-4 h-4 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {profile.location}
              </p>
            )}

            {/* Bio */}
            {profile.bio && (
              <p className="text-text-secondary text-sm leading-relaxed max-w-2xl">
                {profile.bio}
              </p>
            )}

            {/* Action buttons — hidden on own profile */}
            {!isOwnProfile && (
            <div className="flex flex-wrap gap-3 mt-6">
              {/* Anonymous: signup CTA */}
              {userStatus === "anonymous" && (
                <div style={{ maxWidth: 240 }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: "#f0f0f0", marginBottom: 6 }}>Contacter {profile.full_name.split(" ")[0]}</p>
                  <p style={{ fontSize: 12, color: "#555", marginBottom: 14, lineHeight: 1.5 }}>Crée un compte gratuit pour entrer en contact avec les talents.</p>
                  <button onClick={() => router.push("/rejoindre")} style={{ width: "100%", background: "#C8FF00", color: "#0d0d0d", fontSize: 14, fontWeight: 600, borderRadius: 10, padding: 13, border: "none", cursor: "pointer" }}>Rejoindre Unkast</button>
                </div>
              )}
              {/* Free ET Pro : même bouton de contact depuis le 2026-08-10. Un
                  compte gratuit peut contacter 2 personnes ; le quota est
                  arbitré CÔTÉ SERVEUR au premier message. Volontairement aucun
                  compteur ici : la page profil est publique et rendue serveur
                  (revalidate 60), l'afficher imposerait un aller-retour client
                  supplémentaire. Le compteur vit sur /messages. */}
              {(userStatus === "free" || userStatus === "pro") && (
                <button
                  onClick={openConversation}
                  disabled={contacting}
                  className="px-6 py-3 max-w-[240px] bg-lime text-[#0d0d0d] font-semibold text-sm rounded-xl hover:brightness-110 transition disabled:opacity-50"
                >
                  {contacting ? "…" : `Contacter ${profile.full_name.split(" ")[0]}`}
                </button>
              )}
              <div className="relative">
                <button
                  onClick={handleShare}
                  className="px-6 py-3 max-w-[240px] border border-white/[0.12] text-text-secondary text-sm rounded-[10px] hover:border-white/10 hover:text-text-primary transition"
                >
                  Partager le profil
                </button>
                {shareTooltip && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-white/[0.03] border border-white/5 rounded text-xs text-lime whitespace-nowrap">
                    Lien copié !
                  </span>
                )}
              </div>
              {viewerIsCreator && !isOwnProfile && userStatus !== "anonymous" && (
                <button
                  onClick={openInviteModal}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(200,255,0,0.25)", color: "#C8FF00", borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                  Inviter dans un projet
                </button>
              )}
            </div>
            )}
            {isOwnProfile && (
              <div className="mt-6">
                <button onClick={() => router.push("/dashboard")} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f0f0f0", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  Modifier mon profil
                </button>
              </div>
            )}
          </div>
        </motion.section>

        {/* Right column — projects */}
        <div className="flex-1 min-w-0">
        <FadeInView>
          <section>
            <h2 className="text-xl font-bold text-text-primary mb-4">
              Projets
              <span className="text-text-tertiary font-normal ml-2 text-base">
                ({profile.projects.length})
              </span>
            </h2>

            {/* Category filters */}
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-5">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                    activeFilter === "all"
                      ? "bg-white/10 text-text-primary border border-white/20"
                      : "border border-white/5 text-text-secondary hover:border-white/10"
                  }`}
                >
                  Tous
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveFilter(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                      activeFilter === cat
                        ? "border text-text-primary"
                        : "border border-white/5 text-text-secondary hover:border-white/10"
                    }`}
                    style={
                      activeFilter === cat
                        ? {
                            borderColor: categoryColors[cat] + "60",
                            backgroundColor: categoryColors[cat] + "15",
                            color: categoryColors[cat],
                          }
                        : undefined
                    }
                  >
                    {categoryLabels[cat]}
                  </button>
                ))}
              </div>
            )}

            {/* Project cards */}
            {filteredProjects.length === 0 ? (
              <div className="border border-dashed border-white/[0.08] rounded-[10px] h-[120px] flex items-center justify-center">
                <p className="text-[13px] text-[#444]">Aucun projet pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                {filteredProjects.map((project) => {
                  const ownerCredit = project.credits.find(
                    (c) => c.profile_id === profile.id
                  );
                  const isExpanded = expandedCredits.has(project.id);

                  return (
                    <motion.article
                      key={project.id}
                      {...cardHover}
                      className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 hover:shadow-2xl hover:shadow-black/40 transition"
                    >
                      {/* Façade vidéo : poster + play, lecteur monté au clic seulement */}
                      <VideoFacade
                        url={project.video_url}
                        title={project.title}
                        poster={project.poster_url || project.preview_url}
                      />

                      {/* Project info */}
                      <div className="p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <Link
                            href={`/projet/${project.slug}`}
                            className="text-lg font-bold text-text-primary hover:text-lime transition"
                          >
                            {project.title}
                          </Link>
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{
                              backgroundColor: categoryColors[project.category] + "15",
                              color: categoryColors[project.category],
                              border: `1px solid ${categoryColors[project.category]}30`,
                            }}
                          >
                            {categoryLabels[project.category]}
                          </span>
                          <span className="text-text-tertiary text-xs font-mono">
                            {project.year}
                          </span>
                        </div>

                        {/* Role on project */}
                        {ownerCredit && (
                          <p className="text-sm text-text-secondary mb-2">
                            <span className="text-text-tertiary">Rôle :</span>{" "}
                            {ownerCredit.role_on_project}
                          </p>
                        )}

                        {/* Description */}
                        {project.description && (
                          <p className="text-sm text-text-secondary leading-relaxed mb-4">
                            {project.description}
                          </p>
                        )}

                        {/* Credits toggle */}
                        {project.credits.length > 0 && (
                          <div>
                            <button
                              onClick={() => toggleCredits(project.id)}
                              className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition"
                            >
                              <svg
                                className={`w-3.5 h-3.5 transition-transform ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                              Équipe ({project.credits.length})
                            </button>

                            {isExpanded && (
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {project.credits.map((credit) => (
                                  <div
                                    key={credit.id}
                                    className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-white/5"
                                  >
                                    {/* Avatar */}
                                    <Avatar
                                      url={credit.profile?.avatar_url}
                                      name={credit.profile?.full_name ?? credit.ghost_name ?? "?"}
                                      size={32}
                                      shape="rounded"
                                      style={{ borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}
                                    />

                                    <div className="min-w-0">
                                      {credit.profile ? (
                                        <Link
                                          href={`/profil/${credit.profile.slug}`}
                                          className="text-sm font-semibold text-text-primary hover:text-lime transition truncate block"
                                        >
                                          {credit.profile.full_name}
                                        </Link>
                                      ) : (
                                        <span className="text-sm font-semibold text-text-secondary truncate block">
                                          {credit.ghost_name}
                                        </span>
                                      )}
                                      <span className="text-xs text-text-tertiary">
                                        {credit.role_on_project}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </section>
        </FadeInView>
        </div>
        </div>
      </main>

      {/* Report button */}
      {userStatus && userStatus !== "anonymous" && (
        <div style={{ padding: "0 20px 40px", display: "flex", justifyContent: "center" }}>
          <ReportButton onClick={() => setReportOpen(true)} />
        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="profile"
        targetId={profile.id}
      />

      {/* Invitation Modal */}
      {showInviteModal && (
        <div onClick={() => setShowInviteModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(20px)", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, width: "100%", maxWidth: 420, maxHeight: "80vh", overflowY: "auto", padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0", marginBottom: 20 }}>Inviter {profile.full_name.split(" ")[0]}</h3>

            {inviteProjects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>Tu n&apos;as pas encore de film publié.</p>
                <button onClick={() => { setShowInviteModal(false); router.push("/moi"); }} style={{ background: "#C8FF00", color: "#0d0d0d", fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "10px 20px", border: "none", cursor: "pointer" }}>Ajouter un film →</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>Dans quel projet ?</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {inviteProjects.map((p: any) => (
                    <button key={p.id} onClick={() => setInviteSelectedProject(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: inviteSelectedProject === p.id ? "rgba(200,255,0,0.06)" : "#1a1a1a", border: inviteSelectedProject === p.id ? "1px solid rgba(200,255,0,0.3)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "#222", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}><p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0", margin: 0 }}>{p.title}</p><p style={{ fontSize: 11, color: "#555", margin: 0 }}>{p.year}</p></div>
                    </button>
                  ))}
                </div>

                <p style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>Quel rôle ?</p>
                <div style={{ marginBottom: 20 }}>
                  <RoleSelector
                    selectedRoles={inviteRole ? [inviteRole] : []}
                    onChange={(roles) => setInviteRole(roles[0] || "")}
                    maxSelection={1}
                    singleSelect
                    placeholder="Quel rôle ?"
                  />
                </div>

                <textarea value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} maxLength={200} placeholder="Ajoute un message..." style={{ width: "100%", padding: 12, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#f0f0f0", resize: "none", minHeight: 60, outline: "none", marginBottom: 16 }} />

                <button onClick={sendInvitation} disabled={!inviteSelectedProject || !inviteRole || inviteSending} style={{ width: "100%", padding: 14, background: (inviteSelectedProject && inviteRole) ? "#C8FF00" : "rgba(255,255,255,0.06)", color: (inviteSelectedProject && inviteRole) ? "#0d0d0d" : "#555", fontSize: 14, fontWeight: 600, borderRadius: 10, border: "none", cursor: (inviteSelectedProject && inviteRole) ? "pointer" : "not-allowed" }}>
                  {inviteSending ? "Envoi..." : "Envoyer l'invitation"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
