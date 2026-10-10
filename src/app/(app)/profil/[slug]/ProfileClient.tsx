"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { EnterList, EnterItem, enterUp, enterFade, cardSpring } from "@/components/motion";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Badge from "@/components/ui/Badge";
import Field from "@/components/ui/Field";
import type { CareerEntry, Profile, ProfileRole, Project, ProjectCredit } from "@/types/database";
import FilmLink, { RestoreFilmScroll } from "@/components/FilmLink";
import FilmPoster from "@/components/FilmPoster";
import Avatar from "@/components/Avatar";
import LockedFilmCard, { type LockedFilm } from "@/components/LockedFilmCard";
import FilmMeta from "@/components/FilmMeta";
import ReportModal, { ReportButton } from "@/components/ReportModal";
import RoleSelector from "@/components/RoleSelector";
import { useUserStatus } from "@/hooks/useUserStatus";
import { directorNames } from "@/lib/credits";
import { CAREER_KINDS, baseRole, creditRoles, roleFamily } from "@/lib/constants";
import CastingSummary from "@/components/CastingSummary";
import ShareButton from "@/components/ShareButton";

type CreditWithProfile = ProjectCredit & {
  profile: Pick<Profile, "full_name" | "slug" | "avatar_url"> | null;
};

type ProjectWithCredits = Project & {
  credits: CreditWithProfile[];
};

// `full_name` contient le nom affiché, calculé par page.tsx : le client ne reçoit
// ni prénom, ni nom, ni nom de scène bruts.
type ProfileData = Omit<Profile, "first_name" | "last_name" | "stage_name" | "display_name_preference"> & {
  roles: ProfileRole[];
  // Badge « recruteur verifie » deja arbitre cote serveur (recruiter_verified ET
  // plan='pro') — voir page.tsx. Le client n'a pas le plan et ne rejoue pas la
  // regle : il affiche ce booleen tel quel.
  show_verified_badge: boolean;
  projects: ProjectWithCredits[];
  career: CareerEntry[];
  // Films « membres seulement » vus par un visiteur non connecté : de quoi
  // afficher une carte verrouillée, rien d'autre. Vide pour un membre connecté.
  locked_films: LockedFilm[];
};

// Filtre de la liste « Films » : "all", "published" (films dont la personne est
// Responsable) ou "role:<métier>" (films où elle a tenu ce rôle).
interface Props {
  profile: ProfileData;
}

export default function ProfileClient({
  profile,
}: Props) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("all");
  const [contacting, setContacting] = useState(false);
  // Cible du signalement : le profil, ou une entrée de son Parcours.
  const [reportTarget, setReportTarget] = useState<{ type: "profile" | "career_entry"; id: string } | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteProjects, setInviteProjects] = useState<any[]>([]);
  const [inviteSelectedProject, setInviteSelectedProject] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [viewerIsCreator, setViewerIsCreator] = useState(false);
  // Recrutement — signaux "Disponible" du visiteur vers ce recruteur (chantier 2).
  const [availSignals, setAvailSignals] = useState<{ role: string; expires_at: string }[]>([]);
  const [availBusy, setAvailBusy] = useState<string | null>(null);
  const userStatus = useUserStatus();
  const reduced = useReducedMotion();

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

  // Liste complète : les films lisibles et, pour un visiteur non connecté, les
  // cartes verrouillées des films « membres seulement », à leur place selon
  // l'année. `published` : la personne est Responsable du film ; sinon elle y
  // est créditée.
  const allFilmItems: (
    | { locked: false; published: boolean; year: number | null; project: ProjectWithCredits }
    | { locked: true; published: boolean; year: number | null; film: LockedFilm }
  )[] = [
    ...profile.projects.map((project) => ({
      locked: false as const,
      published: project.profile_id === profile.id,
      year: project.year,
      project,
    })),
    ...profile.locked_films.map((film) => ({ locked: true as const, published: film.published, year: film.year, film })),
  ].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  // Rôles tenus, calculés depuis ses crédits : un film à plusieurs rôles compte dans
  // chacun. Les deux formes d'un métier (Comédien, Comédienne) ne font qu'un rôle,
  // affiché sous la forme la plus créditée. Triés par nombre de films.
  const ownRolesOf = (project: ProjectWithCredits) => [
    ...new Set(project.credits.filter((c) => c.profile_id === profile.id).flatMap((c) => creditRoles(c.role_on_project))),
  ];
  const roleStats = [
    ...profile.projects
      .reduce((stats, project) => {
        const roles = ownRolesOf(project);
        for (const role of new Set(roles.map(baseRole))) {
          const stat = stats.get(role) ?? { key: role, count: 0, forms: new Map<string, number>() };
          stat.count += 1;
          for (const form of roles.filter((r) => baseRole(r) === role)) stat.forms.set(form, (stat.forms.get(form) ?? 0) + 1);
          stats.set(role, stat);
        }
        return stats;
      }, new Map<string, { key: string; count: number; forms: Map<string, number> }>())
      .values(),
  ]
    .map((s) => ({ key: s.key, count: s.count, label: [...s.forms].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.count - a.count);
  const hasPublished = allFilmItems.some((i) => i.published);
  const filmItems = allFilmItems.filter((item) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "published") return item.published;
    return !item.locked && ownRolesOf(item.project).some((r) => `role:${baseRole(r)}` === activeFilter);
  });
  const showFilmFilter = roleStats.length > 0 || hasPublished;

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
    setInviteError("");
    setShowInviteModal(true);
  }

  // Echap ferme la fenetre d'invitation, sauf si la feuille des roles est ouverte
  // par-dessus : elle se ferme alors seule.
  useEffect(() => {
    if (!showInviteModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="dialog"]:not([data-invite-modal])')) return;
      setShowInviteModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showInviteModal]);

  async function sendInvitation() {
    if (!inviteSelectedProject || !inviteRole) return;
    setInviteSending(true);
    setInviteError("");
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
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowInviteModal(false);
        setInviteSelectedProject(null);
        setInviteRole("");
        setInviteMessage("");
      } else {
        setInviteError(data.error || "L'invitation n'a pas pu être envoyée. Réessaie.");
      }
    } catch { setInviteError("Erreur réseau. L'invitation n'a pas été envoyée."); }
    finally { setInviteSending(false); }
  }

  // --- Recrutement : disponibilité (côté talent) ---
  const isRecruiting = Boolean(profile.is_recruiting);
  const recruitingRoles = (profile.recruiting_roles ?? []) as string[];

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <style>{`@keyframes recruiting-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }`}</style>
      <main className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-16 py-4 sm:py-6 lg:py-10">
        <EnterList className="flex flex-col lg:flex-row lg:gap-12 lg:items-start">
        {/* Left column — profile info (panneau verre ; le verre est porté par
            l'EnterItem lui-même pour que son flou voie les halos du fond) */}
        <EnterItem className="glass rounded-panel p-5 sm:p-6 lg:w-80 lg:flex-shrink-0 lg:sticky lg:top-20 mb-8 lg:mb-0">
          {/* Avatar + halo */}
          <div className="mb-5">
            <Avatar url={profile.avatar_url} name={profile.full_name} size={112} style={{ background: "rgba(255,255,255,0.03)", border: "2px solid rgba(200,255,0,0.35)", boxShadow: "0 0 0 6px rgba(200,255,0,0.06), 0 0 56px rgba(200,255,0,0.3)" }} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-[28px] font-semibold text-sheen" style={{ letterSpacing: "-0.5px" }}>
                {profile.full_name}
              </h1>
              {profile.is_available && <Badge variant="available" />}
            </div>

            {/* Résumé des rôles tenus dans ses films (3 au plus) */}
            {roleStats.length > 0 && (
              <p className="mb-3 text-sm text-text-secondary">
                {roleStats.slice(0, 3).map((r) => `${r.label} · ${r.count} ${r.count > 1 ? "films" : "film"}`).join(", ")}
              </p>
            )}

            {/* Roles */}
            <div className="flex flex-wrap gap-2 mb-4">
              {profile.roles.map((role) => (
                <Chip key={role.id} variant="static">
                  {role.role_name}
                </Chip>
              ))}
            </div>

            {/* Badge "recruteur vérifié" — double condition (vérification admin +
                Pro actif), arbitrée côté serveur dans page.tsx. */}
            {profile.show_verified_badge && (
              <div className="mb-2.5">
                <Badge variant="verified">Recruteur vérifié</Badge>
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
                      Connecte-toi pour indiquer à {profile.full_name} que tu es disponible pour un poste.
                    </p>
                    <Button onClick={() => router.push("/rejoindre")} className="w-full">
                      Rejoindre Unkast
                    </Button>
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

            {/* Âge de jeu, type de rôles, langues : seulement s'ils sont remplis */}
            <CastingSummary playingAges={profile.playing_ages} roleType={profile.role_type} languages={profile.languages} className="mb-3" />

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
                  <p style={{ fontSize: 15, fontWeight: 500, color: "#f0f0f0", marginBottom: 6 }}>Envoyer un message</p>
                  <p style={{ fontSize: 12, color: "#868686", marginBottom: 14, lineHeight: 1.5 }}>Crée un compte gratuit pour entrer en contact avec les talents.</p>
                  <Button onClick={() => router.push("/rejoindre")} className="w-full">Rejoindre Unkast</Button>
                </div>
              )}
              {/* Free ET Pro : même bouton de contact depuis le 2026-08-10. Un
                  compte gratuit peut contacter 2 personnes ; le quota est
                  arbitré CÔTÉ SERVEUR au premier message. Volontairement aucun
                  compteur ici : la page profil est publique et rendue serveur
                  (revalidate 60), l'afficher imposerait un aller-retour client
                  supplémentaire. Le compteur vit sur /messages. */}
              {(userStatus === "free" || userStatus === "pro") && (
                <Button onClick={openConversation} disabled={contacting} className="max-w-[240px]">
                  {contacting ? "…" : "Envoyer un message"}
                </Button>
              )}
              <ShareButton title={profile.full_name} label="Partager le profil" className="max-w-[240px]" />
              {viewerIsCreator && !isOwnProfile && userStatus !== "anonymous" && (
                <Button variant="glass" onClick={openInviteModal}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                  Inviter dans un projet
                </Button>
              )}
            </div>
            )}
            {isOwnProfile && (
              <div className="mt-6">
                <Button variant="glass" onClick={() => router.push("/dashboard")}>
                  Modifier mon profil
                </Button>
              </div>
            )}
          </div>
        </EnterItem>

        {/* Right column — projects */}
        <div className="flex-1 min-w-0">
          {/* Au retour d'un film, la fiche retrouve sa position de défilement */}
          <RestoreFilmScroll />
          <section>
            <EnterItem>
            <h2 className="text-xl font-bold text-text-primary mb-4">
              Films
              <span className="text-text-tertiary font-normal ml-2 text-base">
                ({allFilmItems.length})
              </span>
            </h2>

            {/* Filtres : tous, un par rôle tenu (avec le nombre de films), puis publiés */}
            {showFilmFilter && (
              <div className="flex flex-wrap gap-2 mb-5">
                <Chip selected={activeFilter === "all"} onClick={() => setActiveFilter("all")}>Tous</Chip>
                {roleStats.map((r) => (
                  <Chip key={r.key} selected={activeFilter === `role:${r.key}`} onClick={() => setActiveFilter(`role:${r.key}`)}>
                    {r.label} <span className="opacity-60">{r.count}</span>
                  </Chip>
                ))}
                {hasPublished && (
                  <Chip selected={activeFilter === "published"} onClick={() => setActiveFilter("published")}>Publiés</Chip>
                )}
              </div>
            )}
            </EnterItem>

            {/* Project cards */}
            {filmItems.length === 0 ? (
              <div className="border border-dashed border-white/[0.08] rounded-card h-[120px] flex items-center justify-center">
                <p className="text-[13px] text-text-tertiary">Aucun film pour le moment</p>
              </div>
            ) : (
              // Même carte que les rangées du feed : affiche en cadre 16:9, taille
              // identique pour toutes, grille qui passe à la ligne. Toute la carte mène
              // à la page du film (transition partagée). Ni lecteur, ni description, ni équipe.
              <EnterList className="flex flex-wrap gap-x-4 gap-y-7">
                {filmItems.map((item) => {
                  // Film « membres seulement », visiteur non connecté : carte
                  // verrouillée, sans lecteur ni équipe. Le titre mène à la page du film.
                  if (item.locked) {
                    return (
                      <motion.div key={item.film.id} variants={reduced ? enterFade : enterUp} className="w-60 sm:w-72 lg:w-80">
                        <LockedFilmCard film={item.film} href={`/projet/${item.film.slug}`} />
                      </motion.div>
                    );
                  }
                  const project = item.project;
                  // Rôle(s) de la personne sur ce film, publié par elle ou non.
                  const ownRoles = ownRolesOf(project);
                  // Réalisateur : crédits de réalisation du film, pas son Responsable.
                  const directors = directorNames(
                    project.credits.map((c) => ({ role_on_project: c.role_on_project, name: c.profile?.full_name ?? c.ghost_name }))
                  );
                  const shareKey = `fiche:${project.id}`;

                  return (
                    <motion.div
                      key={project.id}
                      variants={reduced ? enterFade : enterUp}
                      whileHover={reduced ? undefined : { y: -4 }}
                      whileTap={reduced ? undefined : { scale: 0.96 }}
                      transition={cardSpring}
                      className="max-w-full"
                    >
                      <FilmLink slug={project.slug} shareKey={shareKey} className="press-spring group flex w-fit max-w-full flex-col items-start">
                        <FilmPoster
                          src={project.preview_url || project.poster_url}
                          alt={project.title}
                          shareKey={shareKey}
                          sizes="(max-width: 640px) 240px, (max-width: 1024px) 288px, 320px"
                          className="h-[135px] rounded-media border border-white/[0.11] shadow-xl shadow-black/50 transition-[border-color,box-shadow] duration-base ease-glass group-hover:border-white/20 group-hover:shadow-2xl group-hover:shadow-black/70 sm:h-[162px] lg:h-[180px]"
                        />
                        {/* w-0 min-w-full : le texte ne fixe pas la largeur de la carte, c'est l'affiche */}
                        <div className="mt-2.5 w-0 min-w-full px-0.5">
                          {/* Rôle(s) de la personne sur ce film : sous l'affiche, jamais dessus */}
                          {ownRoles.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {ownRoles.map((role) => {
                                // Fond lime, point de la couleur de la famille du métier
                                const family = roleFamily(role);
                                return (
                                  <span key={role} title={family?.label} className="inline-flex items-center gap-1.5 rounded-pill border border-lime/30 bg-lime/[0.12] px-2.5 py-1 text-xs font-semibold leading-none text-lime">
                                    {family && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: family.color }} />}
                                    {role}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <h3 className="truncate text-[13px] font-semibold leading-tight text-text-primary transition-colors duration-300 group-hover:text-lime lg:text-[15px]">
                            {project.title}
                          </h3>
                          <FilmMeta category={project.category} author={directors} year={project.year} className="mt-1" />
                        </div>
                      </FilmLink>
                    </motion.div>
                  );
                })}
              </EnterList>
            )}
          </section>

          {/* Parcours : entrées déclaratives, texte uniquement. Section masquée si vide. */}
          {profile.career.length > 0 && (
            <EnterItem>
              <section className="mt-10">
                <h2 className="text-xl font-bold text-text-primary mb-4">
                  Parcours
                  <span className="text-text-tertiary font-normal ml-2 text-base">({profile.career.length})</span>
                </h2>
                <ul className="glass rounded-panel divide-y divide-white/[0.06]">
                  {profile.career.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                      <span className="w-10 flex-shrink-0 pt-0.5 font-mono text-xs text-text-tertiary">{entry.year}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary break-words">{entry.title}</p>
                        <p className="mt-0.5 text-[13px] text-text-secondary break-words">
                          {entry.role} · {CAREER_KINDS.find((k) => k.value === entry.kind)?.label ?? entry.kind}
                        </p>
                        {entry.production && (
                          <p className="mt-0.5 text-xs text-text-tertiary break-words">{entry.production}</p>
                        )}
                      </div>
                      {userStatus && userStatus !== "anonymous" && !isOwnProfile && (
                        <button
                          type="button"
                          aria-label={`Signaler l'entrée ${entry.title}`}
                          title="Signaler"
                          onClick={() => setReportTarget({ type: "career_entry", id: entry.id })}
                          className="-mr-2 -mt-1.5 flex size-9 flex-shrink-0 items-center justify-center rounded-pill text-text-tertiary transition-colors hover:text-text-secondary"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                            <line x1="4" y1="22" x2="4" y2="15" />
                          </svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </EnterItem>
          )}
        </div>
        </EnterList>

        {/* Report button */}
        {userStatus && userStatus !== "anonymous" && (
          <div className="mt-8 flex justify-center">
            <ReportButton onClick={() => setReportTarget({ type: "profile", id: profile.id })} />
          </div>
        )}
      </main>

      {/* Report Modal */}
      <ReportModal
        open={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type ?? "profile"}
        targetId={reportTarget?.id ?? profile.id}
      />

      {/* Invitation Modal */}
      {showInviteModal && (
        <div onClick={() => setShowInviteModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(20px)", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Inviter ${profile.full_name}`} data-invite-modal className="glass rounded-panel" style={{ width: "100%", maxWidth: 420, maxHeight: "80vh", overflowY: "auto", padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0", marginBottom: 20 }}>Inviter {profile.full_name}</h3>

            {inviteProjects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <p style={{ fontSize: 13, color: "#868686", marginBottom: 12 }}>Tu n&apos;as pas encore de film publié.</p>
                <Button onClick={() => { setShowInviteModal(false); router.push("/moi"); }}>Ajouter un film →</Button>
                <Button variant="glass" onClick={() => setShowInviteModal(false)} className="mt-2 w-full">Annuler</Button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#868686", marginBottom: 10 }}>Dans quel projet ?</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {inviteProjects.map((p: any) => (
                    <button key={p.id} onClick={() => setInviteSelectedProject(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: inviteSelectedProject === p.id ? "rgba(200,255,0,0.06)" : "rgba(255,255,255,0.04)", border: inviteSelectedProject === p.id ? "1px solid rgba(200,255,0,0.3)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}><p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0", margin: 0 }}>{p.title}</p><p style={{ fontSize: 11, color: "#868686", margin: 0 }}>{p.year}</p></div>
                    </button>
                  ))}
                </div>

                <p style={{ fontSize: 13, color: "#868686", marginBottom: 10 }}>Quel rôle ?</p>
                <div style={{ marginBottom: 20 }}>
                  <RoleSelector
                    selectedRoles={inviteRole ? [inviteRole] : []}
                    onChange={(roles) => setInviteRole(roles[0] || "")}
                    maxSelection={1}
                    singleSelect
                    placeholder="Quel rôle ?"
                  />
                </div>

                <Field multiline rows={2} aria-label="Message" value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} maxLength={200} placeholder="Ajoute un message..." className="mb-4" />

                <Button onClick={sendInvitation} disabled={!inviteSelectedProject || !inviteRole || inviteSending} className="w-full">
                  {inviteSending ? "Envoi..." : "Envoyer l'invitation"}
                </Button>
                {inviteError && (
                  <p role="alert" style={{ fontSize: 13, color: "#f87171", marginTop: 12 }}>{inviteError}</p>
                )}
                <Button variant="glass" onClick={() => setShowInviteModal(false)} className="mt-2 w-full">Annuler</Button>
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
