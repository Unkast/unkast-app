"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FadeInView, cardHover, staggerContainer, fadeUp } from "@/components/motion";
import type { Profile, ProfileRole, Project, ProjectCredit, ProjectCategory } from "@/types/database";
import VideoFacade from "@/components/VideoFacade";
import ContactModal from "@/components/ContactModal";
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
  const [contactOpen, setContactOpen] = useState(false);
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="pb-16 lg:pb-0">
      <style>{`@keyframes recruiting-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }`}</style>
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex flex-col lg:flex-row lg:gap-12 lg:items-start">
        {/* Left column — profile info */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="lg:w-80 lg:flex-shrink-0 lg:sticky lg:top-6 mb-8 lg:mb-0">
          {/* Avatar */}
          <div className="w-[88px] h-[88px] rounded-full bg-white/[0.03] border-2 border-[rgba(200,255,0,0.2)] overflow-hidden flex-shrink-0 mb-5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[28px] font-semibold text-[#C8FF00]">
                {profile.full_name.charAt(0)}
              </div>
            )}
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
              {/* Free: Pro upsell */}
              {userStatus === "free" && (
                <div style={{ maxWidth: 240, background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.15)", borderRadius: 12, padding: 16 }}>
                  <svg style={{ marginBottom: 8, opacity: 0.7 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", marginBottom: 4 }}>Contacter {profile.full_name.split(" ")[0]}</p>
                  <p style={{ fontSize: 12, color: "#555", marginBottom: 14, lineHeight: 1.5 }}>La messagerie directe est disponible avec Unkast Pro.</p>
                  <button onClick={() => router.push("/pro")} style={{ width: "100%", background: "#C8FF00", color: "#0d0d0d", fontSize: 14, fontWeight: 600, borderRadius: 10, padding: 11, border: "none", cursor: "pointer" }}>Découvrir Pro</button>
                </div>
              )}
              {/* Pro: full contact */}
              {userStatus === "pro" && (
                <button
                  onClick={() => setContactOpen(true)}
                  className="px-6 py-3 max-w-[240px] bg-lime text-[#0d0d0d] font-bold text-sm rounded-[10px] hover:brightness-110 transition"
                >
                  Contacter {profile.full_name.split(" ")[0]}
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
              <div className="space-y-8">
                {filteredProjects.map((project) => {
                  const ownerCredit = project.credits.find(
                    (c) => c.profile_id === profile.id
                  );
                  const isExpanded = expandedCredits.has(project.id);

                  return (
                    <motion.article
                      key={project.id}
                      {...cardHover}
                      className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition"
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
                                    <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                                      {credit.profile?.avatar_url ? (
                                        <img
                                          src={credit.profile.avatar_url}
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-text-tertiary">
                                          {(
                                            credit.profile?.full_name ??
                                            credit.ghost_name ??
                                            "?"
                                          ).charAt(0)}
                                        </div>
                                      )}
                                    </div>

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

      {/* Contact Modal */}
      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        profileId={profile.id}
        profileName={profile.full_name}
      />

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
