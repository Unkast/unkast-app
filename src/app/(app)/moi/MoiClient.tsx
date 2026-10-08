"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LEGAL_LINKS } from "@/lib/legal";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MAX_PROJECTS_FREE } from "@/lib/constants";
import { PHONE_CODES } from "@/lib/phone-codes";
import type { Profile, ProfileRole, ProjectCredit, CreditRequest } from "@/types/database";
import AvatarUpload from "@/components/AvatarUpload";
import Avatar from "@/components/Avatar";
import { normalizeUrl, formatInstagram, getDisplayName as profileDisplayName } from "@/lib/profile";
import RoleSelector from "@/components/RoleSelector";
import RecruitmentSpace from "./RecruitmentSpace";
import { createClient } from "@/lib/supabase/client";
import { isGrantValid } from "@/lib/pro-plan";
import { EnterList, EnterItem, cardSpring } from "@/components/motion";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Badge from "@/components/ui/Badge";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";
import Select from "@/components/ui/Select";
import Toast from "@/components/ui/Toast";
import Toggle from "@/components/ui/Toggle";
import { SectionLabel, FilmThumb, MoiSkeleton, Note } from "./parts";
import type { FilmsData } from "./api";
import FilmsSection from "./FilmsSection";
import CareerSection from "./CareerSection";

/* ---------- types ---------- */

interface CreditRequestWithProject extends CreditRequest {
  project_title?: string;
  project_slug?: string;
  requester_name?: string;
}

/* ---------- style helpers ---------- */

const labelCls = "text-sm font-medium text-text-secondary";
const titleCls = "text-lg font-semibold text-text-primary";
const subCls = "mt-1 text-[13px] text-text-secondary";
const emptyCls = "text-[13px] text-text-secondary";
const rowTitleCls = "text-sm font-semibold text-text-primary";
const rowMetaCls = "mt-0.5 text-xs text-text-secondary";
const linkCls = "inline-flex min-h-11 items-center text-[13px] text-lime hover:underline";

/* ========================================================================== */

export default function MoiClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  /* --- profile --- */
  const [profile, setProfile] = useState<(Profile & { account_type?: string; plan?: string }) | null>(null);
  const [roles, setRoles] = useState<ProfileRole[]>([]);

  /* --- edit fields --- */
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editStageName, setEditStageName] = useState("");
  const [editDisplayPref, setEditDisplayPref] = useState<"real_name" | "stage_name">("real_name");
  const [editBio, setEditBio] = useState("");
  const [bioError, setBioError] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAvailable, setEditAvailable] = useState(false);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editPhonePrefix, setEditPhonePrefix] = useState("+33");
  const [editInstagram, setEditInstagram] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editShowEmail, setEditShowEmail] = useState("nobody");
  const [editShowPhone, setEditShowPhone] = useState("nobody");
  const [editShowRealName, setEditShowRealName] = useState("nobody");
  const [editIsRecruiting, setEditIsRecruiting] = useState(false);
  const [editRecruitingRoles, setEditRecruitingRoles] = useState<string[]>([]);

  /* --- films (GET /api/dashboard/projects) --- */
  const [films, setFilms] = useState<FilmsData>({ projects: [], owned_count: 0, limit: MAX_PROJECTS_FREE, manager_invites: [] });

  /* --- credits --- */
  const [creditRequests, setCreditRequests] = useState<CreditRequestWithProject[]>([]);
  const [myCredits, setMyCredits] = useState<(ProjectCredit & { project_title?: string; project_slug?: string })[]>([]);
  const [myCreditRequests, setMyCreditRequests] = useState<CreditRequestWithProject[]>([]);

  /* --- invitations --- */
  const [receivedInvitations, setReceivedInvitations] = useState<any[]>([]);
  const [sentInvitations, setSentInvitations] = useState<any[]>([]);

  /* --- pro upsell --- */
  const [showProModal, setShowProModal] = useState(false);
  const pressedOnBackdrop = useRef(false);
  const reduced = useReducedMotion();

  /* --- tabs --- */
  type MoiTab = "profil" | "content" | "activity" | "recrutement" | "compte";
  const [activeTab, setActiveTab] = useState<MoiTab>("profil");

  /* ---------- helpers ---------- */

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const isCreator = profile?.account_type === "creator";
  const isRecruiter = profile?.account_type === "recruiter";
  const plan = (profile as any)?.plan || "free";
  const isCreatorOrRecruiter = profile?.account_type === "creator" || profile?.account_type === "recruiter";
  const canRecruit = plan === "pro" && isCreatorOrRecruiter;

  // Origine/echeance du Pro, affichees sous le badge "Actif" — chantier grants
  // (2026-08-10). subscription_status/pro_grant_type/pro_grant_expires_at
  // viennent des PRIVILEGED_COLUMNS de GET /api/dashboard/profile.
  const proOrigin = (() => {
    if (!profile || plan !== "pro") return null;
    const p = profile as Profile;
    const stripeActive = p.subscription_status
      ? ["active", "trialing", "past_due"].includes(p.subscription_status)
      : false;
    const grantValid = isGrantValid(p.pro_grant_type ?? null, p.pro_grant_expires_at ?? null);
    const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    let grantLabel: string | null = null;
    if (grantValid && p.pro_grant_type === "vip") {
      grantLabel = p.pro_grant_expires_at ? `Pro offert (VIP) jusqu'au ${fmt(p.pro_grant_expires_at)}` : "Pro offert (VIP), sans échéance";
    } else if (grantValid && p.pro_grant_type === "launch") {
      grantLabel = p.pro_grant_expires_at ? `Pro offert (lancement) jusqu'au ${fmt(p.pro_grant_expires_at)}` : "Pro offert (lancement)";
    }

    if (stripeActive && grantLabel) return `Abonnement Stripe actif + ${grantLabel}`;
    if (stripeActive) return "Abonnement Stripe actif";
    if (grantLabel) return grantLabel;
    // plan='pro' sans signal Stripe/grant detectable ici : etat transitoire
    // (juste avant un recompute_plan) ou profil a examiner manuellement.
    return null;
  })();

  function getDisplayName(): string {
    return profile ? profileDisplayName(profile) : "Utilisateur";
  }

  function getInitials(): string {
    if (!profile) return "?";
    const name = getDisplayName();
    return name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  }

  /* ---------- data fetching ---------- */

  const fetchProfile = useCallback(async () => {
    const res = await fetch("/api/dashboard/profile");
    if (res.status === 401) {
      router.push("/rejoindre");
      return;
    }
    const data = await res.json();
    if (data.profile) {
      setProfile(data.profile);
      setRoles(data.roles);
    }
  }, [router]);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/dashboard/projects");
    if (res.ok) {
      const data = await res.json();
      setFilms({
        projects: data.projects ?? [],
        owned_count: data.owned_count ?? 0,
        limit: data.limit === undefined ? MAX_PROJECTS_FREE : data.limit,
        manager_invites: data.manager_invites ?? [],
      });
    }
  }, []);

  const fetchCreditRequests = useCallback(async () => {
    const res = await fetch("/api/dashboard/credits");
    if (res.ok) {
      const data = await res.json();
      setCreditRequests(data.received || []);
      setMyCredits(data.my_credits || []);
      setMyCreditRequests(data.my_requests || []);
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    const res = await fetch("/api/invitations/project");
    if (res.ok) {
      const data = await res.json();
      setReceivedInvitations(data.received || []);
      setSentInvitations(data.sent || []);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchProfile(), fetchProjects(), fetchCreditRequests(), fetchInvitations()]).finally(() =>
      setLoading(false)
    );
  }, [fetchProfile, fetchProjects, fetchCreditRequests, fetchInvitations]);

  /* ---------- edit helpers ---------- */

  function startEditProfile() {
    if (!profile) return;
    // Profil sans prenom ni nom separes (inscrit avant qu'ils soient enregistres) :
    // on les deduit du nom complet, pour ne pas ouvrir le formulaire avec un
    // prenom vide, que le serveur refuse.
    const names = profile as { full_name?: string | null; first_name?: string | null; last_name?: string | null };
    const nameParts = (names.full_name || "").trim().split(/\s+/).filter(Boolean);
    const hasSplitName = !!(names.first_name || names.last_name);
    setEditFirstName(hasSplitName ? names.first_name || "" : nameParts[0] || "");
    setEditLastName(hasSplitName ? names.last_name || "" : nameParts.slice(1).join(" "));
    setEditStageName((profile as any).stage_name || "");
    setEditDisplayPref((profile as any).display_name_preference || "real_name");
    setEditBio(profile.bio ?? "");
    setBioError("");
    setEditLocation(profile.location ?? "");
    setEditAvailable(profile.is_available ?? false);
    setEditRoles(roles.map((r) => r.role_name));
    setEditContactEmail((profile as any).contact_email || "");
    const rawPhone = (profile as any).contact_phone || "";
    const prefixMatch = rawPhone.match(/^(\+\d{1,3})\s?(.*)$/);
    if (prefixMatch) {
      setEditPhonePrefix(prefixMatch[1]);
      setEditContactPhone(prefixMatch[2]);
    } else {
      setEditPhonePrefix("+33");
      setEditContactPhone(rawPhone);
    }
    setEditInstagram((profile as any).instagram_url || "");
    setEditWebsite((profile as any).website_url || "");
    setEditShowEmail((profile as any).show_contact_email_to || "nobody");
    setEditShowPhone((profile as any).show_phone_to || "nobody");
    setEditShowRealName((profile as any).show_real_name_to || "nobody");
    setEditIsRecruiting((profile as any).is_recruiting || false);
    setEditRecruitingRoles((profile as any).recruiting_roles || []);
    setIsEditing(true);
  }

  async function saveProfile() {
    setSaving(true);
    const res = await fetch("/api/dashboard/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: editFirstName || null,
        last_name: editLastName || null,
        stage_name: editStageName || null,
        display_name_preference: editDisplayPref,
        bio: editBio || null,
        location: editLocation || null,
        is_available: editAvailable,
        roles: editRoles,
        contact_email: editContactEmail || null,
        contact_phone: editContactPhone ? `${editPhonePrefix} ${editContactPhone}` : null,
        instagram_url: editInstagram || null,
        website_url: editWebsite || null,
        show_contact_email_to: editShowEmail,
        show_phone_to: editShowPhone,
        show_real_name_to: editShowRealName,
        is_recruiting: editIsRecruiting,
        recruiting_roles: editRecruitingRoles,
      }),
    });
    const data = await res.json().catch(() => ({}));
    // Coordonnees dans la bio : rien n'est enregistre, on reste sur le formulaire.
    if (res.status === 400 && data?.code === "contact_refused") {
      setBioError(data.error || "");
      setSaving(false);
      return;
    }
    // Refus du serveur (prenom vide, metiers hors liste...) : on reste sur le
    // formulaire et on affiche son message, au lieu d'annoncer un succes.
    if (!res.ok) {
      showToast(data?.error || "Enregistrement impossible, réessaie.");
      setSaving(false);
      return;
    }
    await fetchProfile();
    setIsEditing(false);
    setSaving(false);
    // Recruteur : une modif de description part en validation admin.
    showToast(data?.pendingReview ? "Description envoyée pour validation" : "Profil mis à jour");
  }

  // Bascule de role talent <-> creator (le serveur refuse tout autre changement).
  async function switchAccountType(next: "talent" | "creator") {
    if (next === profile?.account_type) return;
    const res = await fetch("/api/dashboard/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_type: next }),
    });
    if (!res.ok) {
      showToast("Changement de rôle impossible");
      return;
    }
    await fetchProfile();
    showToast(next === "creator" ? "Tu es maintenant créateur" : "Tu es maintenant talent");
  }

  /* ---------- credit actions ---------- */

  async function handleCreditAction(id: string, status: "accepted" | "refused") {
    await fetch(`/api/credits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await Promise.all([fetchCreditRequests(), fetchProjects()]);
    showToast(status === "accepted" ? "Crédit accepté" : "Demande refusée");
  }

  async function cancelMyCreditRequest(id: string) {
    await fetch(`/api/credits/${id}`, { method: "DELETE" });
    await fetchCreditRequests();
    showToast("Demande annulée");
  }

  async function handleInvitationAction(id: string, status: "accepted" | "refused") {
    await fetch(`/api/invitations/project/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchInvitations();
    showToast(status === "accepted" ? "Invitation acceptée !" : "Invitation déclinée");
  }

  /* ---------- logout ---------- */

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch("/api/logout", { method: "POST" });
    sessionStorage.removeItem("unkast_has_explored");
    localStorage.removeItem("unkast_splash_time");
    router.replace("/");
    router.refresh();
  }

  /* ---------- pending credit requests on my projects ---------- */
  const pendingReceivedCredits = creditRequests.filter((cr) => cr.status === "pending");

  /* ============================== RENDER ============================== */

  if (loading) return <MoiSkeleton />;

  if (!profile) {
    return (
      <div className="flex items-center justify-center px-4 py-20">
        <GlassCard radius="panel" className="flex max-w-sm flex-col items-center gap-5 p-8 text-center">
          <p className="text-sm text-text-secondary">Tu dois être connecté pour accéder à cette page.</p>
          <Button href="/connexion">Se connecter</Button>
        </GlassCard>
      </div>
    );
  }

  /* ======================== EDITING MODE ======================== */

  if (isEditing) {
    return (
      <>
        <Toast message={toast} />

        <div className="mx-auto w-full max-w-2xl px-4 pb-10">
          {/* Barre d'actions (reste visible pendant le defilement du formulaire) */}
          <div className="glass-strong sticky top-3 z-30 my-3 flex items-center justify-between gap-2 rounded-pill bg-glass-solid/70 p-1.5">
            <Button variant="glass" size="sm" onClick={() => setIsEditing(false)}>
              Annuler
            </Button>
            <h1 className="truncate text-sm font-semibold text-text-primary">Modifier le profil</h1>
            <Button size="sm" onClick={saveProfile} disabled={saving}>
              {saving ? "..." : "Enregistrer"}
            </Button>
          </div>

          <EnterList className="flex flex-col gap-4">
            {/* PHOTO */}
            <EnterItem className="glass flex flex-col items-center gap-3 rounded-panel p-5">
              <SectionLabel className="self-start">Photo</SectionLabel>
              <AvatarUpload
                currentAvatarUrl={profile.avatar_url}
                onUploadComplete={(url) => setProfile({ ...profile, avatar_url: url || null })}
                initials={getInitials()}
                size={96}
              />
              <p className="text-center text-xs text-text-secondary">Appuie pour changer la photo</p>
            </EnterItem>

            {/* IDENTITE */}
            <EnterItem className="glass flex flex-col gap-4 rounded-panel p-5">
              <SectionLabel>Identité</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prénom" type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} placeholder="Prénom" />
                <Field label="Nom" type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} placeholder="Nom de famille" />
              </div>
              <div>
                <Field label="Nom de scène / Pseudonyme" type="text" value={editStageName} onChange={(e) => setEditStageName(e.target.value)} placeholder="Ex: J.M. Vision" />
                <p className="mt-2 text-xs text-text-secondary">Laisse vide si tu n&apos;en as pas</p>
              </div>
              <div>
                <p className={labelCls}>Afficher sur le profil public</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip selected={editDisplayPref === "real_name"} onClick={() => setEditDisplayPref("real_name")}>
                    Vrai nom
                  </Chip>
                  <Chip selected={editDisplayPref === "stage_name"} onClick={() => setEditDisplayPref("stage_name")}>
                    Nom de scène
                  </Chip>
                </div>
              </div>
            </EnterItem>

            {/* PROFIL PRO */}
            <EnterItem className="glass flex flex-col gap-4 rounded-panel p-5">
              <SectionLabel>Profil pro</SectionLabel>
              <div>
                <p className={`${labelCls} mb-2`}>Métiers</p>
                <RoleSelector
                  selectedRoles={editRoles}
                  onChange={setEditRoles}
                  maxSelection={5}
                  placeholder="Rechercher un métier..."
                  allowCustom={false}
                />
              </div>
              <Field label="Ville" type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Paris, Lyon..." />
              <div>
                <Field
                  multiline
                  rows={4}
                  label={
                    <>
                      {isRecruiter ? "Description professionnelle" : "Bio"}{" "}
                      <span className="font-normal text-text-tertiary">({editBio.length}/280)</span>
                    </>
                  }
                  value={editBio}
                  onChange={(e) => { if (e.target.value.length <= 280) { setEditBio(e.target.value); setBioError(""); } }}
                  placeholder={isRecruiter ? "Ton parcours, les films faits, les postes occupés..." : "Décris ton parcours, tes spécialités..."}
                />
                {bioError && <div className="mt-2"><Note>{bioError}</Note></div>}
                {isRecruiter && (
                  <p className="mt-2 text-xs leading-relaxed text-lime/80">
                    Toute modification de ta description est vérifiée par l&apos;équipe avant publication. Le public continue de voir ta version actuelle en attendant.
                  </p>
                )}
              </div>
            </EnterItem>

            {/* DISPONIBILITE */}
            <EnterItem className="glass flex flex-col gap-2 rounded-panel p-5">
              <SectionLabel>Disponibilité</SectionLabel>
              <Toggle checked={editAvailable} onChange={setEditAvailable} label="Disponible pour des projets" />
            </EnterItem>

            {/* RECRUTEMENT : reserve aux comptes Pro createur/recruteur */}
            {isCreatorOrRecruiter && (
              <EnterItem className="glass flex flex-col gap-3 rounded-panel p-5">
                <SectionLabel>Recrutement</SectionLabel>
                {canRecruit ? (
                  <>
                    <Toggle
                      checked={editIsRecruiting}
                      onChange={(checked) => { setEditIsRecruiting(checked); if (!checked) setEditRecruitingRoles([]); }}
                      label="Je recrute activement"
                    />
                    {editIsRecruiting && (
                      <>
                        <p className="text-[13px] text-text-secondary">Quel(s) métier(s) recherches-tu ?</p>
                        <RoleSelector
                          selectedRoles={editRecruitingRoles}
                          onChange={setEditRecruitingRoles}
                          maxSelection={5}
                          placeholder="Quel métier recherches-tu ?"
                        />
                        <p className="text-xs text-text-secondary">Ce badge sera visible sur ton profil public et dans les résultats de recherche.</p>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[13px] text-text-secondary">Le badge « Je recrute » est réservé aux comptes Pro.</span>
                    <Button variant="dashed" size="sm" href="/pro" className="shrink-0">
                      Passer à Pro →
                    </Button>
                  </div>
                )}
              </EnterItem>
            )}

            {/* CONTACT & VISIBILITE */}
            <EnterItem className="glass flex flex-col gap-4 rounded-panel p-5">
              <SectionLabel>Contact &amp; visibilité</SectionLabel>
              <p className="border-l-2 border-lime pl-3 text-xs leading-relaxed text-text-secondary">
                Ces informations permettent aux recruteurs de te contacter via Unkast. Elles ne sont pas affichées publiquement sur ton profil.
              </p>

              {/* contact_email */}
              <Field label="Email de contact" type="email" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} placeholder="contact@exemple.com" />

              {/* contact_phone */}
              <div>
                <label htmlFor="moi-phone" className={labelCls}>Telephone</label>
                <div className="mt-2 flex gap-2">
                  <Select
                    aria-label="Indicatif"
                    value={editPhonePrefix}
                    onChange={(e) => setEditPhonePrefix(e.target.value)}
                    className="w-[104px]! shrink-0"
                  >
                    {PHONE_CODES.map((c) => (
                      <option key={c.label} value={c.dial}>{c.label}</option>
                    ))}
                  </Select>
                  <Field
                    id="moi-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={editContactPhone}
                    onChange={(e) => setEditContactPhone(e.target.value)}
                    placeholder="6 12 34 56 78"
                    className="min-w-0 flex-1"
                  />
                </div>
              </div>

              {/* instagram */}
              <Field label="Instagram" type="url" value={editInstagram} onChange={(e) => setEditInstagram(e.target.value)} placeholder="https://instagram.com/tonpseudo" />

              {/* website */}
              <Field label="Site web / Portfolio" type="url" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="https://tonsite.com" />
            </EnterItem>
          </EnterList>
        </div>
      </>
    );
  }

  /* ======================== VIEW MODE ======================== */

  const reviewStatus = isRecruiter ? profile.recruiter_review_status : null;
  // Meme regle que le profil public (profil/[slug]/page.tsx) : verification admin ET Pro actif.
  const showVerifiedBadge = profile.recruiter_verified === true && plan === "pro";
  const recruitingRoles = profile.is_recruiting ? profile.recruiting_roles ?? [] : [];
  const instagram = formatInstagram(profile.instagram_url);
  const pendingSentRequests = myCreditRequests.filter((r) => r.status === "pending");

  // Demandes de credit recues sur les films geres (tous types de compte).
  const receivedCredits = (headCls: string) => (
    <>
      <EnterItem className={headCls}>
        <h2 className={titleCls}>Demandes de participation</h2>
        <p className={subCls}>Des membres veulent apparaître dans l&apos;équipe de tes films.</p>
      </EnterItem>
      {pendingReceivedCredits.length === 0 ? (
        <EnterItem className="px-1">
          <p className={emptyCls}>Aucune demande en attente.</p>
        </EnterItem>
      ) : (
        pendingReceivedCredits.map((cr) => (
          <EnterItem key={cr.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-card border-yellow-500/25 p-3 pl-4">
            <div className="min-w-40 flex-1">
              <p className={rowTitleCls}>{cr.requester_name || "Membre"}</p>
              <p className={rowMetaCls}>
                {cr.project_title && <span>{cr.project_title} &middot; </span>}
                {cr.role}
              </p>
              {cr.message && <p className="mt-1 text-xs italic text-text-secondary">&quot;{cr.message}&quot;</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => handleCreditAction(cr.id, "accepted")}>
                Accepter
              </Button>
              <Button variant="glass" size="sm" onClick={() => handleCreditAction(cr.id, "refused")}>
                Refuser
              </Button>
            </div>
          </EnterItem>
        ))
      )}
    </>
  );

  return (
    <>
      <Toast message={toast} />
      <style>{`@keyframes recruiting-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }`}</style>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-10 pt-4 lg:pt-8">
        <EnterList className="flex flex-col gap-4">
          {/* En-tete : avatar, nom, badges */}
          <EnterItem className="glass flex items-center gap-4 rounded-panel p-5 sm:p-6">
            <Avatar
              url={profile.avatar_url}
              name={getDisplayName()}
              size={80}
              style={{ background: "rgba(255,255,255,0.03)", border: "2px solid rgba(200,255,0,0.35)", boxShadow: "0 0 0 5px rgba(200,255,0,0.06), 0 0 40px rgba(200,255,0,0.25)" }}
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-sheen break-words text-[26px] font-semibold" style={{ letterSpacing: "-0.5px" }}>
                {getDisplayName()}
              </h1>
              {(plan === "pro" || showVerifiedBadge || profile.is_available || reviewStatus === "pending") && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {plan === "pro" && <Badge variant="pro" />}
                  {showVerifiedBadge && <Badge variant="verified">Recruteur vérifié</Badge>}
                  {profile.is_available && <Badge variant="available" />}
                  {reviewStatus === "pending" && <Badge variant="pending">Validation en attente</Badge>}
                </div>
              )}
            </div>
          </EnterItem>

          {/* Onglets */}
          <EnterItem className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
            {(([
              { key: "profil", label: "Profil" },
              { key: "content", label: "Mes films" },
              { key: "activity", label: "Activité" },
              // Espace pré-casting : visible des qu'on est Pro createur/recruteur
              // (independamment du badge "Je recrute", qui ne gere que la visibilite
              // cote talent). canRecruit = plan pro + role creator/recruteur.
              ...(canRecruit ? [{ key: "recrutement", label: "Recrutement" }] : []),
              { key: "compte", label: "Compte" },
            ] as { key: MoiTab; label: string }[])).map(({ key, label }) => (
              <Chip key={key} selected={activeTab === key} onClick={() => setActiveTab(key)}>
                {label}
              </Chip>
            ))}
          </EnterItem>
        </EnterList>

        {/* TAB: Profil */}
        {activeTab === "profil" && (
          <EnterList className="flex flex-col gap-4">
            {/* Recruteur : modification de description en attente de validation */}
            {reviewStatus === "pending" && (
              <EnterItem className="glass rounded-card border-lime/25 p-4">
                <p className="text-[13px] font-semibold text-lime">Modification en attente de validation</p>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                  Ta nouvelle description est en cours de vérification. Le public voit encore ta version actuelle en attendant.
                </p>
                {profile.bio_pending && (
                  <p className="mt-3 border-t border-white/10 pt-3 text-xs italic leading-relaxed text-text-primary/80">
                    « {profile.bio_pending} »
                  </p>
                )}
              </EnterItem>
            )}

            {/* Recruteur : derniere modification de description refusee */}
            {reviewStatus === "rejected" && (
              <EnterItem className="glass rounded-card border-red-500/30 p-4">
                <p className="text-[13px] font-semibold text-red-400">Modification refusée</p>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                  Ta nouvelle description n&apos;a pas été validée. Le public voit toujours ta version actuelle. Tu peux modifier ton profil pour soumettre une autre version.
                </p>
                {profile.recruiter_review_reason && (
                  <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-text-primary/80">
                    Motif : {profile.recruiter_review_reason}
                  </p>
                )}
              </EnterItem>
            )}

            {/* Rendu profil public */}
            <EnterItem className="glass flex flex-col items-start gap-4 rounded-panel p-5 sm:p-6">
              <Button variant="glass" size="sm" onClick={startEditProfile} className="text-lime!">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Modifier mon profil
              </Button>

              {/* Rôles */}
              {roles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => (
                    <Chip key={r.id} variant="static">
                      {r.role_name}
                    </Chip>
                  ))}
                </div>
              )}

              {/* Recruiting badge */}
              {recruitingRoles.length > 0 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "6px 14px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "recruiting-pulse 2s ease infinite", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#22c55e" }}>Je recrute</span>
                  <span style={{ color: "rgba(34,197,94,0.4)", fontSize: 12 }}>·</span>
                  <span style={{ fontSize: 12, color: "rgba(34,197,94,0.8)" }}>
                    {recruitingRoles.slice(0, 2).join(" · ")}{recruitingRoles.length > 2 ? ` +${recruitingRoles.length - 2}` : ""}
                  </span>
                </div>
              )}

              {/* Localisation */}
              {profile.location && (
                <p className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <svg className="size-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {profile.location}
                </p>
              )}

              {/* Bio */}
              {profile.bio && <p className="text-sm leading-relaxed text-text-secondary">{profile.bio}</p>}

              {/* Contact info */}
              {(profile.contact_email || profile.instagram_url || profile.website_url) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {profile.contact_email && (
                    <a href={`mailto:${profile.contact_email}`} className={linkCls}>{profile.contact_email}</a>
                  )}
                  {profile.instagram_url && (
                    <a href={instagram?.href || "#"} target="_blank" rel="noopener noreferrer" className={linkCls}>
                      {instagram?.display || profile.instagram_url}
                    </a>
                  )}
                  {profile.website_url && (
                    <a href={normalizeUrl(profile.website_url) || "#"} target="_blank" rel="noopener noreferrer" className={linkCls}>Site web</a>
                  )}
                </div>
              )}
            </EnterItem>

            {/* Parcours : experiences declarees, texte uniquement */}
            <EnterItem className="glass flex flex-col items-start gap-3 rounded-panel p-5 sm:p-6">
              <CareerSection showToast={showToast} />
            </EnterItem>
          </EnterList>
        )}

        {/* TAB: Content (films, puis participations) */}
        {activeTab === "content" && (
          <EnterList className="flex flex-col gap-3">
            {/* Films geres : ouvert a tous les types de compte */}
            <FilmsSection
              films={films}
              userId={profile.id}
              plan={plan}
              reload={fetchProjects}
              showToast={showToast}
              onUpsell={() => setShowProModal(true)}
            />

            {/* ----- Talent et recruteur : Mes participations ----- */}
            {!isCreator && (
              <>
                <EnterItem className="mt-4 border-t border-white/10 px-1 pt-6">
                  <h2 className={titleCls}>Mes participations</h2>
                  <p className={subCls}>Les films dans lesquels tu apparais.</p>
                </EnterItem>

                {/* Confirmed */}
                {myCredits.length === 0 ? (
                  <EnterItem className="px-1">
                    <p className={emptyCls}>Tu n&apos;apparais dans aucun film pour le moment.</p>
                  </EnterItem>
                ) : (
                  myCredits.map((credit) => (
                    <EnterItem key={credit.id} className="glass flex items-center justify-between gap-3 rounded-card p-3 pl-4">
                      <div className="min-w-0">
                        <p className={rowTitleCls}>{credit.project_title || "Projet"}</p>
                        <p className={rowMetaCls}>{credit.role_on_project}</p>
                      </div>
                      {credit.project_slug && (
                        <Button variant="glass" size="sm" href={`/projet/${credit.project_slug}`} className="shrink-0">
                          Voir
                        </Button>
                      )}
                    </EnterItem>
                  ))
                )}

                {/* Pending requests */}
                {pendingSentRequests.length > 0 && (
                  <>
                    <EnterItem className="px-1 pt-3">
                      <SectionLabel>Demandes de participation envoyees</SectionLabel>
                    </EnterItem>
                    {pendingSentRequests.map((req) => (
                      <EnterItem key={req.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-card p-3 pl-4">
                        <div className="min-w-40 flex-1">
                          <p className={rowTitleCls}>{req.project_title || "Projet"}</p>
                          <p className={rowMetaCls}>{req.role}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="pending">En attente</Badge>
                          <Button variant="glass" size="sm" onClick={() => cancelMyCreditRequest(req.id)}>
                            Annuler
                          </Button>
                        </div>
                      </EnterItem>
                    ))}
                  </>
                )}
              </>
            )}
          </EnterList>
        )}

        {/* TAB: Activity */}
        {activeTab === "activity" && (
          <EnterList className="flex flex-col gap-3">
            {!isCreator ? (
              /* ----- Talent activity ----- */
              <>
                {/* Mes demandes de participation */}
                <EnterItem className="px-1">
                  <h2 className={titleCls}>Mes demandes de participation</h2>
                  <p className={subCls}>Les projets que tu as demandé à rejoindre.</p>
                </EnterItem>
                {myCreditRequests.length === 0 ? (
                  <EnterItem className="flex flex-col items-start gap-3 px-1">
                    <p className={emptyCls}>Tu n&apos;as pas encore demandé à rejoindre un projet.</p>
                    <Button variant="dashed" href="/recherche">
                      Explorer les films →
                    </Button>
                  </EnterItem>
                ) : (
                  myCreditRequests.map((req) => {
                    const statusTone = req.status === "pending" ? "pending" : req.status === "accepted" ? "published" : "rejected";
                    const statusLabel = req.status === "pending" ? "En attente" : req.status === "accepted" ? "Accepté" : "Refusé";
                    return (
                      <EnterItem key={req.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-card p-3 pl-4">
                        <div className="min-w-40 flex-1">
                          <p className={`${rowTitleCls} truncate`}>{req.project_title || "Projet"}</p>
                          <p className={rowMetaCls}>{req.role}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={statusTone}>{statusLabel}</Badge>
                          {req.status === "pending" && (
                            <Button variant="glass" size="sm" onClick={() => cancelMyCreditRequest(req.id)}>
                              Annuler
                            </Button>
                          )}
                          {req.status === "accepted" && req.project_slug && (
                            <Button variant="glass" size="sm" href={`/projet/${req.project_slug}`}>
                              Voir le projet
                            </Button>
                          )}
                        </div>
                      </EnterItem>
                    );
                  })
                )}

                {/* Invitations reçues */}
                <EnterItem className="mt-4 border-t border-white/10 px-1 pt-6">
                  <h2 className={titleCls}>Invitations reçues</h2>
                  <p className={subCls}>Des créateurs t&apos;ont invité à rejoindre leur projet.</p>
                </EnterItem>
                {receivedInvitations.length === 0 ? (
                  <EnterItem className="px-1">
                    <p className={emptyCls}>Aucune invitation reçue.</p>
                  </EnterItem>
                ) : (
                  receivedInvitations.map((inv) => (
                    <EnterItem key={inv.id} className="glass rounded-card p-3">
                      <div className="flex items-center gap-3">
                        {/* Project thumbnail */}
                        <FilmThumb url={inv.project_poster_url} />
                        <div className="min-w-0 flex-1">
                          <p className={`${rowTitleCls} truncate`}>{inv.project_title || "Projet"}</p>
                          <p className={rowMetaCls}>
                            {inv.role_offered && <span>{inv.role_offered}</span>}
                            {inv.inviter_name && <span> · {inv.inviter_name}</span>}
                          </p>
                        </div>
                      </div>
                      {inv.message && (
                        <p className="mt-2.5 text-xs italic text-text-secondary">&quot;{inv.message}&quot;</p>
                      )}
                      {inv.status === "pending" && (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => handleInvitationAction(inv.id, "accepted")}>
                            Accepter
                          </Button>
                          <Button variant="glass" size="sm" onClick={() => handleInvitationAction(inv.id, "refused")}>
                            Refuser
                          </Button>
                        </div>
                      )}
                      {inv.status !== "pending" && (
                        <div className="mt-2.5">
                          <Badge variant={inv.status === "accepted" ? "published" : "rejected"}>
                            {inv.status === "accepted" ? "Acceptée" : "Déclinée"}
                          </Badge>
                        </div>
                      )}
                    </EnterItem>
                  ))
                )}

                {/* Demandes recues sur les films geres (un talent peut gerer un film) */}
                {pendingReceivedCredits.length > 0 && receivedCredits("mt-4 border-t border-white/10 px-1 pt-6")}
              </>
            ) : (
              /* ----- Creator activity ----- */
              <>
                {receivedCredits("px-1")}

                {/* Invitations envoyées */}
                <EnterItem className="mt-4 border-t border-white/10 px-1 pt-6">
                  <h2 className={titleCls}>Invitations envoyées</h2>
                  <p className={subCls}>Les membres que tu as invités à rejoindre tes projets.</p>
                </EnterItem>
                {sentInvitations.length === 0 ? (
                  <EnterItem className="px-1">
                    <p className={emptyCls}>Aucune invitation envoyée.</p>
                  </EnterItem>
                ) : (
                  sentInvitations.map((inv) => {
                    const statusTone = inv.status === "pending" ? "pending" : inv.status === "accepted" ? "published" : "rejected";
                    const statusLabel = inv.status === "pending" ? "En attente" : inv.status === "accepted" ? "Acceptée" : "Déclinée";
                    return (
                      <EnterItem key={inv.id} className="glass flex items-center gap-3 rounded-card p-3">
                        {/* Invited person avatar */}
                        <Avatar url={inv.invitee_avatar_url} name={inv.invitee_name || "?"} size={36} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }} />
                        <div className="min-w-0 flex-1">
                          <p className={rowTitleCls}>{inv.invitee_name || "Membre"}</p>
                          <p className={`${rowMetaCls} truncate`}>{inv.project_title || "Projet"}</p>
                        </div>
                        <div className="shrink-0">
                          <Badge variant={statusTone}>{statusLabel}</Badge>
                        </div>
                      </EnterItem>
                    );
                  })
                )}
              </>
            )}
          </EnterList>
        )}

        {/* TAB: Recrutement (espace pré-casting — Pro createur/recruteur) */}
        {activeTab === "recrutement" && canRecruit && (
          <RecruitmentSpace showToast={showToast} />
        )}

        {/* TAB: Compte */}
        {activeTab === "compte" && (
          <EnterList className="flex flex-col gap-4">
            {/* Mon forfait */}
            <EnterItem className="glass rounded-panel p-5 sm:p-6">
              <SectionLabel>Mon forfait</SectionLabel>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sheen text-2xl font-semibold">{plan === "pro" ? "Unkast Pro" : "Gratuit"}</p>
                {plan === "pro" ? <Badge variant="pro">Actif</Badge> : <Badge variant="neutral">Free</Badge>}
              </div>

              {proOrigin && <p className="mt-2 text-xs text-text-secondary">{proOrigin}</p>}

              <p className="mt-2 text-[13px] text-text-secondary">
                Type de compte : {profile.account_type === "creator" ? "Créateur" : profile.account_type === "recruiter" ? "Recruteur" : "Talent"}
              </p>

              {/* Bascule de role : uniquement talent <-> creator (recruteur masque) */}
              {(profile.account_type === "talent" || profile.account_type === "creator") && (
                <div className="mt-3 flex flex-col gap-2">
                  {(["talent", "creator"] as const).map((r) => {
                    const active = profile.account_type === r;
                    return (
                      <Chip
                        key={r}
                        selected={active}
                        onClick={() => switchAccountType(r)}
                        disabled={active}
                        className="h-11! w-full justify-center disabled:cursor-default"
                      >
                        {r === "creator" ? "Je publie des œuvres (Créateur)" : "J'ai participé à un projet (Talent)"}
                      </Chip>
                    );
                  })}
                </div>
              )}

              {plan === "free" && (
                <p className="mt-3 text-xs leading-relaxed text-text-secondary">
                  Compte gratuit : {MAX_PROJECTS_FREE} films dont tu es Responsable.
                </p>
              )}
            </EnterItem>

            {/* Pro upsell card */}
            {plan === "free" && (
              <EnterItem className="glass rounded-panel border-lime/25 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-media border border-lime/30 bg-lime/15 text-lime">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-text-primary">Passe a Unkast Pro</p>
                    <p className="text-xs text-text-secondary">A partir de 9,99 €/mois</p>
                  </div>
                </div>

                <div className="my-4 flex flex-col gap-2">
                  {["Jusqu'à 30 films", "Messagerie directe", "Contacter les talents", "Badge Pro vérifié", "Priorité dans les résultats"].map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-lime" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
                      <span className="text-[13px] text-text-primary">{f}</span>
                    </div>
                  ))}
                </div>

                <Button size="lg" href="/pro" fullWidth>
                  Découvrir Unkast Pro
                </Button>
              </EnterItem>
            )}

            {/* Pro active badge */}
            {plan === "pro" && (
              <EnterItem className="glass flex flex-col items-center rounded-panel border-lime/25 p-6 text-center">
                <svg className="mb-3 text-lime" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-[15px] font-semibold text-text-primary">Tu es Pro !</p>
                <p className="mt-1 text-xs text-text-secondary">Toutes les fonctionnalités sont déverrouillées.</p>
              </EnterItem>
            )}

            {/* Informations légales */}
            <EnterItem className="glass rounded-panel p-5 sm:p-6">
              <SectionLabel>Informations légales</SectionLabel>
              <div className="mt-2 flex flex-col divide-y divide-white/10">
                {LEGAL_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="flex min-h-11 items-center justify-between gap-3 text-sm text-text-primary hover:text-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
                  >
                    {l.label}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-tertiary" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
                  </Link>
                ))}
              </div>
            </EnterItem>

            {/* Disconnect — separate */}
            <EnterItem>
              <Button variant="glass" onClick={handleLogout} fullWidth className="border-red-500/25! text-red-400!">
                Se déconnecter
              </Button>
            </EnterItem>
          </EnterList>
        )}
      </div>

      {/* Pro upsell modal. Fermeture au clic sur le fond seulement si mousedown ET
          mouseup y ont lieu (un glisser-selectionner parti de la carte ne ferme pas). */}
      <AnimatePresence>
        {showProModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onMouseDown={(e) => { pressedOnBackdrop.current = e.target === e.currentTarget; }}
            onClick={(e) => { if (e.target === e.currentTarget && pressedOnBackdrop.current) setShowProModal(false); }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[20px]"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="moi-pro-modal-title"
              initial={{ opacity: 0, scale: reduced ? 1 : 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.95 }}
              transition={reduced ? { duration: 0.15 } : cardSpring}
              className="glass-strong w-full max-w-[360px] rounded-panel bg-glass-solid/80 p-6 text-center"
            >
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-media border border-orange-400/30 bg-orange-400/10 text-orange-400">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 id="moi-pro-modal-title" className="text-lg font-semibold text-text-primary">Tu as utilise tes {MAX_PROJECTS_FREE} films gratuits</h3>
              <p className="mb-6 mt-2 text-sm leading-relaxed text-text-secondary">Passe à Unkast Pro pour publier en illimité et booster ta visibilité.</p>
              <a
                href="mailto:pro@unkast.com?subject=Liste attente Pro"
                className="btn-accent flex min-h-11 w-full items-center justify-center px-5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
              >
                Rejoindre la liste d&apos;attente
              </a>
              <Button variant="glass" size="sm" onClick={() => setShowProModal(false)} className="mt-3">
                Pas maintenant
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
