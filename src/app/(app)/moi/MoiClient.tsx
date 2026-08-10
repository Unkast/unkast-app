"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORY_LABELS, CATEGORY_COLORS, MAX_PROJECTS_FREE, MAX_PROJECTS_PRO } from "@/lib/constants";
import { PHONE_CODES } from "@/lib/phone-codes";
import type { Profile, ProfileRole, Project, ProjectCredit, ProjectCategory, CreditRequest } from "@/types/database";
import AvatarUpload from "@/components/AvatarUpload";
import Avatar from "@/components/Avatar";
import { normalizeUrl, formatInstagram } from "@/lib/profile";
import RoleSelector from "@/components/RoleSelector";
import RecruitmentSpace from "./RecruitmentSpace";
import { createClient } from "@/lib/supabase/client";
import { isGrantValid } from "@/lib/pro-plan";

/* ---------- types ---------- */

interface ProjectWithCredits extends Project {
  credits: ProjectCredit[];
}

interface CreditRequestWithProject extends CreditRequest {
  project_title?: string;
  project_slug?: string;
  requester_name?: string;
}

/* ---------- style helpers ---------- */

const inputCls =
  "w-full px-4 py-3 bg-[#0d0d0d] border border-white/5 rounded-xl text-text-primary text-base focus:outline-none focus:border-[rgba(200,255,0,0.5)] transition";

const sectionHeader: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 11,
  color: "#555",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 12,
  marginTop: 24,
};

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

  /* --- projects --- */
  const [projects, setProjects] = useState<ProjectWithCredits[]>([]);
  const [addingProject, setAddingProject] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<ProjectCategory>("court-metrage");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOwnerRole, setNewOwnerRole] = useState("");

  /* --- invitation email d'un collaborateur absent (chantier 10) --- */
  const [inviteForProject, setInviteForProject] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  /* --- credits --- */
  const [creditRequests, setCreditRequests] = useState<CreditRequestWithProject[]>([]);
  const [myCredits, setMyCredits] = useState<(ProjectCredit & { project_title?: string; project_slug?: string })[]>([]);
  const [myCreditRequests, setMyCreditRequests] = useState<CreditRequestWithProject[]>([]);

  /* --- invitations --- */
  const [receivedInvitations, setReceivedInvitations] = useState<any[]>([]);
  const [sentInvitations, setSentInvitations] = useState<any[]>([]);

  /* --- pro upsell --- */
  const [showProModal, setShowProModal] = useState(false);

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
  const projectLimit = plan === "pro" ? MAX_PROJECTS_PRO : MAX_PROJECTS_FREE;
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
    if (!profile) return "Utilisateur";
    if ((profile as any).display_name_preference === "stage_name" && (profile as any).stage_name) {
      return (profile as any).stage_name;
    }
    const parts = [(profile as any).first_name, (profile as any).last_name].filter(Boolean);
    return parts.join(" ") || profile.full_name || "Utilisateur";
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
      setProjects(data.projects);
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
    setEditFirstName((profile as any).first_name || "");
    setEditLastName((profile as any).last_name || "");
    setEditStageName((profile as any).stage_name || "");
    setEditDisplayPref((profile as any).display_name_preference || "real_name");
    setEditBio(profile.bio ?? "");
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

  /* ---------- project actions ---------- */

  async function addProject() {
    if (!newTitle || !newVideoUrl) return;
    setSaving(true);
    const res = await fetch("/api/dashboard/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        category: newCategory,
        year: newYear,
        video_url: newVideoUrl,
        description: newDescription || null,
        owner_role: newOwnerRole || null,
      }),
    });
    if (!res.ok) {
      // Doublon vidéo (409) ou autre erreur : on garde le formulaire et les champs
      // pour permettre la correction (ex. coller une autre vidéo).
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Erreur lors de l'ajout du film");
      setSaving(false);
      return;
    }
    await fetchProjects();
    setAddingProject(false);
    setNewTitle("");
    setNewVideoUrl("");
    setNewDescription("");
    setNewOwnerRole("");
    setSaving(false);
  }

  async function deleteProject(id: string) {
    if (!confirm("Supprimer ce projet ?")) return;
    await fetch(`/api/dashboard/projects?id=${id}`, { method: "DELETE" });
    await fetchProjects();
  }

  async function sendEmailInvitation(projectId: string) {
    if (!inviteEmail || !inviteRole) return;
    setInviteSending(true);
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, email: inviteEmail, role: inviteRole, name: inviteName || null }),
    });
    const data = await res.json().catch(() => ({}));
    setInviteSending(false);
    if (res.ok) {
      showToast(data.email_sent ? "Invitation envoyée par email" : "Invitation enregistrée (email non envoyé en dev)");
      setInviteName(""); setInviteEmail(""); setInviteRole(""); setInviteForProject(null);
      await fetchProjects();
    } else {
      showToast(data.error || "Erreur");
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#C8FF00]/30 border-t-[#C8FF00] rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center text-center px-4 py-20">
        <div>
          <p style={{ color: "#666", fontSize: 14, marginBottom: 16 }}>Tu dois être connecté pour accéder à cette page.</p>
          <Link href="/connexion" style={{ padding: "12px 24px", background: "#C8FF00", color: "#0d0d0d", fontWeight: 700, fontSize: 14, borderRadius: 8, textDecoration: "none" }}>
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  /* ======================== EDITING MODE ======================== */

  if (isEditing) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{ position: "fixed", top: 16, right: 16, zIndex: 50, padding: "10px 16px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 13, color: "#f0f0f0" }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setIsEditing(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer" }}>
            Annuler
          </button>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: "#f0f0f0", fontWeight: 600 }}>Modifier le profil</span>
          <button onClick={saveProfile} disabled={saving} style={{ background: "none", border: "none", color: "#C8FF00", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.5 : 1 }}>
            {saving ? "..." : "Enregistrer"}
          </button>
        </div>

        <div style={{ padding: "0 16px", paddingBottom: 120 }}>
          {/* PHOTO */}
          <p style={sectionHeader}>Photo</p>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <AvatarUpload
              currentAvatarUrl={profile.avatar_url}
              onUploadComplete={(url) => setProfile({ ...profile, avatar_url: url || null })}
              initials={getInitials()}
              size={80}
            />
            <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#444", textAlign: "center" }}>Appuie pour changer la photo</p>
          </div>

          {/* IDENTITE */}
          <p style={sectionHeader}>Identité</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Prénom</label>
              <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} className={inputCls} placeholder="Prénom" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Nom</label>
              <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} className={inputCls} placeholder="Nom de famille" />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Nom de scène / Pseudonyme</label>
            <input type="text" value={editStageName} onChange={(e) => setEditStageName(e.target.value)} className={inputCls} placeholder="Ex: J.M. Vision" />
            <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#444", marginTop: 6 }}>Laisse vide si tu n&apos;en as pas</p>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8 }}>Afficher sur le profil public</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setEditDisplayPref("real_name")}
                style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", background: editDisplayPref === "real_name" ? "#C8FF00" : "transparent", color: editDisplayPref === "real_name" ? "#0d0d0d" : "#555", border: editDisplayPref === "real_name" ? "1px solid #C8FF00" : "1px solid #333" }}
              >
                Vrai nom
              </button>
              <button
                onClick={() => setEditDisplayPref("stage_name")}
                style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", background: editDisplayPref === "stage_name" ? "#C8FF00" : "transparent", color: editDisplayPref === "stage_name" ? "#0d0d0d" : "#555", border: editDisplayPref === "stage_name" ? "1px solid #C8FF00" : "1px solid #333" }}
              >
                Nom de scène
              </button>
            </div>
          </div>

          {/* PROFIL PRO */}
          <p style={sectionHeader}>Profil pro</p>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Métiers</label>
            <RoleSelector
              selectedRoles={editRoles}
              onChange={setEditRoles}
              maxSelection={5}
              placeholder="Rechercher un métier..."
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Ville</label>
            <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className={inputCls} placeholder="Paris, Lyon..." />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>
              {isRecruiter ? "Description professionnelle" : "Bio"} <span style={{ color: "#555" }}>({editBio.length}/280)</span>
            </label>
            <textarea
              rows={4}
              value={editBio}
              onChange={(e) => { if (e.target.value.length <= 280) setEditBio(e.target.value); }}
              className={inputCls}
              style={{ resize: "none" }}
              placeholder={isRecruiter ? "Ton parcours, les films faits, les postes occupés..." : "Décris ton parcours, tes spécialités..."}
            />
            {isRecruiter && (
              <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#8aa800", marginTop: 6, lineHeight: 1.5 }}>
                Toute modification de ta description est vérifiée par l&apos;équipe avant publication. Le public continue de voir ta version actuelle en attendant.
              </p>
            )}
          </div>

          {/* DISPONIBILITE */}
          <p style={sectionHeader}>Disponibilité</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={editAvailable} onChange={(e) => setEditAvailable(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-teal transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
            </label>
            <span style={{ fontSize: 14, color: "#888" }}>Disponible pour des projets</span>
          </div>

          {/* RECRUTEMENT — reserve aux comptes Pro createur/recruteur */}
          {isCreatorOrRecruiter && (
            <>
              <p style={{ ...sectionHeader }}>Recrutement</p>
              {canRecruit ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontSize: 14, color: "#f0f0f0" }}>Je recrute activement</span>
                    <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, cursor: "pointer" }}>
                      <input type="checkbox" checked={editIsRecruiting} onChange={(e) => { setEditIsRecruiting(e.target.checked); if (!e.target.checked) setEditRecruitingRoles([]); }} style={{ display: "none" }} />
                      <div style={{ width: 44, height: 24, borderRadius: 12, background: editIsRecruiting ? "#22c55e" : "#333", transition: "background 200ms", position: "relative" }}>
                        <div style={{ position: "absolute", top: 2, left: editIsRecruiting ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "white", transition: "left 200ms" }} />
                      </div>
                    </label>
                  </div>
                  {editIsRecruiting && (
                    <>
                      <p style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>Quel(s) métier(s) recherches-tu ?</p>
                      <RoleSelector
                        selectedRoles={editRecruitingRoles}
                        onChange={setEditRecruitingRoles}
                        maxSelection={5}
                        placeholder="Quel métier recherches-tu ?"
                      />
                      <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#444", marginTop: 8 }}>Ce badge sera visible sur ton profil public et dans les résultats de recherche.</p>
                    </>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: 13, color: "#666" }}>Le badge « Je recrute » est réservé aux comptes Pro.</span>
                  <a href="/pro" style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: "#C8FF00", textDecoration: "none" }}>Passer à Pro →</a>
                </div>
              )}
            </>
          )}

          {/* CONTACT & VISIBILITE */}
          <p style={sectionHeader}>Contact &amp; visibilité</p>
          <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)", borderLeft: "2px solid #C8FF00", paddingLeft: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>Ces informations permettent aux recruteurs de te contacter via Unkast. Elles ne sont pas affichées publiquement sur ton profil.</p>
          </div>

          {/* contact_email */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Email de contact</label>
            <input type="email" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} className={inputCls} placeholder="contact@exemple.com" />
          </div>

          {/* contact_phone */}
          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Telephone</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={editPhonePrefix}
                onChange={(e) => setEditPhonePrefix(e.target.value)}
                style={{ width: 100, padding: "12px 8px", background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, color: "#f0f0f0", fontSize: 14, outline: "none", flexShrink: 0 }}
              >
                {PHONE_CODES.map((c) => (
                  <option key={c.label} value={c.dial}>{c.label}</option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={editContactPhone}
                onChange={(e) => setEditContactPhone(e.target.value)}
                style={{ flex: 1, padding: "12px 14px", background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, color: "#f0f0f0", fontSize: 16, outline: "none" }}
                placeholder="6 12 34 56 78"
              />
            </div>
          </div>

          {/* instagram */}
          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Instagram</label>
            <input type="url" value={editInstagram} onChange={(e) => setEditInstagram(e.target.value)} className={inputCls} placeholder="https://instagram.com/tonpseudo" />
          </div>

          {/* website */}
          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Site web / Portfolio</label>
            <input type="url" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} className={inputCls} placeholder="https://tonsite.com" />
          </div>

        </div>
      </motion.div>
    );
  }

  /* ======================== VIEW MODE ======================== */

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ position: "fixed", top: 16, right: 16, zIndex: 50, padding: "10px 16px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 13, color: "#f0f0f0" }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ paddingBottom: 120 }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }} className="no-scrollbar mx-auto w-full max-w-2xl">
          {(([
            { key: "profil", label: "Profil" },
            { key: "content", label: isCreator ? "Mes films" : "Mes participations" },
            { key: "activity", label: "Activité" },
            // Espace pré-casting : visible des qu'on est Pro createur/recruteur
            // (independamment du badge "Je recrute", qui ne gere que la visibilite
            // cote talent). canRecruit = plan pro + role creator/recruteur.
            ...(canRecruit ? [{ key: "recrutement", label: "Recrutement" }] : []),
            { key: "compte", label: "Compte" },
          ] as { key: MoiTab; label: string }[])).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: activeTab === key ? 600 : 400,
                color: activeTab === key ? "#f0f0f0" : "#444",
                background: "none",
                border: "none",
                borderBottom: activeTab === key ? "2px solid #C8FF00" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 150ms",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mx-auto w-full max-w-2xl lg:pt-2" style={{ padding: "0 16px" }}>
          {/* TAB: Profil */}
          {activeTab === "profil" && (
            <div style={{ marginTop: 16, padding: "0 4px" }}>
              {/* Bouton modifier flottant */}
              <button
                onClick={startEditProfile}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, cursor: "pointer", marginBottom: 20 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#C8FF00" }}>Modifier mon profil</span>
              </button>

              {/* Recruteur : modification de description en attente de validation */}
              {isRecruiter && (profile as any).recruiter_review_status === "pending" && (
                <div style={{ background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.2)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#C8FF00", margin: 0, marginBottom: 6 }}>Modification en attente de validation</p>
                  <p style={{ fontSize: 12, color: "#888", margin: 0, lineHeight: 1.5 }}>
                    Ta nouvelle description est en cours de vérification. Le public voit encore ta version actuelle en attendant.
                  </p>
                  {(profile as any).bio_pending && (
                    <p style={{ fontSize: 12, color: "#aaa", fontStyle: "italic", margin: "10px 0 0", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", lineHeight: 1.6 }}>
                      « {(profile as any).bio_pending} »
                    </p>
                  )}
                </div>
              )}

              {/* Recruteur : derniere modification de description refusee */}
              {isRecruiter && (profile as any).recruiter_review_status === "rejected" && (
                <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#ef4444", margin: 0, marginBottom: 6 }}>Modification refusée</p>
                  <p style={{ fontSize: 12, color: "#888", margin: 0, lineHeight: 1.5 }}>
                    Ta nouvelle description n'a pas été validée. Le public voit toujours ta version actuelle. Tu peux modifier ton profil pour soumettre une autre version.
                  </p>
                  {(profile as any).recruiter_review_reason && (
                    <p style={{ fontSize: 12, color: "#aaa", margin: "10px 0 0", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", lineHeight: 1.6 }}>
                      Motif : {(profile as any).recruiter_review_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Rendu profil public */}
              {/* Avatar */}
              <div style={{ marginBottom: 16 }}>
                <Avatar url={profile.avatar_url} name={getDisplayName()} size={88} style={{ border: "2px solid rgba(200,255,0,0.2)" }} />
              </div>

              {/* Nom + badge dispo */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <h2 style={{ fontSize: 24, fontWeight: 600, color: "#f0f0f0", margin: 0, letterSpacing: "-0.5px" }}>{getDisplayName()}</h2>
                {profile.is_available && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.3)", color: "#00D4AA", fontSize: 11, fontWeight: 600 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D4AA", animation: "recruiting-pulse 2s ease infinite" }} />
                    Disponible
                  </span>
                )}
              </div>

              {/* Rôles */}
              {roles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {roles.map((r) => (
                    <span key={r.id} style={{ padding: "4px 12px", borderRadius: 20, background: "rgba(200,255,0,0.1)", border: "1px solid rgba(200,255,0,0.2)", color: "#C8FF00", fontSize: 12, fontWeight: 500 }}>
                      {r.role_name}
                    </span>
                  ))}
                </div>
              )}

              {/* Recruiting badge */}
              {(profile as any).is_recruiting && (profile as any).recruiting_roles?.length > 0 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "6px 14px", marginBottom: 12 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "recruiting-pulse 2s ease infinite", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#22c55e" }}>Je recrute</span>
                  <span style={{ color: "rgba(34,197,94,0.4)", fontSize: 12 }}>·</span>
                  <span style={{ fontSize: 12, color: "rgba(34,197,94,0.8)" }}>
                    {((profile as any).recruiting_roles as string[]).slice(0, 2).join(" · ")}{(profile as any).recruiting_roles.length > 2 ? ` +${(profile as any).recruiting_roles.length - 2}` : ""}
                  </span>
                </div>
              )}

              {/* Localisation */}
              {profile.location && (
                <p style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
                  <svg style={{ display: "inline-block", width: 14, height: 14, marginRight: 4, verticalAlign: "-2px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {profile.location}
                </p>
              )}

              {/* Bio */}
              {profile.bio && (
                <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, marginTop: 8 }}>{profile.bio}</p>
              )}

              {/* Contact info */}
              {((profile as any).contact_email || (profile as any).instagram_url || (profile as any).website_url) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                  {(profile as any).contact_email && (
                    <a href={`mailto:${(profile as any).contact_email}`} style={{ fontSize: 12, color: "#C8FF00", textDecoration: "none" }}>{(profile as any).contact_email}</a>
                  )}
                  {(profile as any).instagram_url && (
                    <a href={formatInstagram((profile as any).instagram_url)?.href || "#"} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#C8FF00", textDecoration: "none" }}>
                      {formatInstagram((profile as any).instagram_url)?.display || (profile as any).instagram_url}
                    </a>
                  )}
                  {(profile as any).website_url && (
                    <a href={normalizeUrl((profile as any).website_url) || "#"} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#C8FF00", textDecoration: "none" }}>Site web</a>
                  )}
                </div>
              )}

              <style>{`@keyframes recruiting-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }`}</style>
            </div>
          )}

          {/* TAB: Content (films or credits) */}
          {activeTab === "content" && (
            <div style={{ marginTop: 16 }}>
              {/* ============ SECTION 2 — My content ============ */}
              {isCreator ? (
                /* ----- Creator: Mes films ----- */
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>Mes films</h3>
                    <span style={{ fontSize: 12, color: "#555" }}>{projects.length}/{projectLimit}</span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden", marginBottom: 16 }}>
                    <div style={{ height: "100%", borderRadius: 2, background: projects.length >= projectLimit ? "#f97316" : "#C8FF00", width: `${Math.min(100, (projects.length / projectLimit) * 100)}%`, transition: "width 300ms" }} />
                  </div>

                  {/* Project list */}
                  {projects.map((project) => {
                    const statusColor = project.status === "approved" ? "#22c55e" : project.status === "pending" ? "#f97316" : "#ef4444";
                    const statusLabel = project.status === "approved" ? "Publié" : project.status === "pending" ? "En attente" : "Refusé";

                    const inviteOpen = inviteForProject === project.id;
                    return (
                      <div key={project.id} style={{ marginBottom: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {/* Thumbnail */}
                          <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {project.poster_url ? (
                              <img src={project.poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={1.5}><path d="M15 12l-4 2.5v-5l4 2.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            )}
                          </div>
                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.title}</p>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: statusColor, marginTop: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} />
                              {statusLabel}
                            </span>
                          </div>
                          {/* Inviter */}
                          <button onClick={() => { setInviteForProject(inviteOpen ? null : project.id); setInviteName(""); setInviteEmail(""); setInviteRole(""); }} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600, color: inviteOpen ? "#C8FF00" : "#aaa" }}>
                            Créditer
                          </button>
                          {/* Delete */}
                          <button onClick={() => deleteProject(project.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        </div>
                        {inviteOpen && (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
                              Crédite un collaborateur absent d&apos;Unkast : il reçoit un email pour rejoindre et revendiquer son crédit. Pour un membre déjà inscrit, passe par son profil.
                            </p>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nom" className={inputCls} style={{ flex: "1 1 100px" }} />
                              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email" className={inputCls} style={{ flex: "2 1 160px" }} />
                              <input type="text" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} placeholder="Rôle" className={inputCls} style={{ flex: "1 1 100px" }} />
                              <button onClick={() => sendEmailInvitation(project.id)} disabled={!inviteEmail || !inviteRole || inviteSending} style={{ padding: "10px 16px", background: "#C8FF00", color: "#0d0d0d", fontWeight: 700, fontSize: 13, borderRadius: 10, border: "none", cursor: "pointer", opacity: !inviteEmail || !inviteRole || inviteSending ? 0.5 : 1 }}>
                                Inviter
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add button */}
                  {!addingProject && projects.length < projectLimit && (
                    <button
                      onClick={() => setAddingProject(true)}
                      style={{ width: "100%", padding: 12, borderRadius: 10, background: "#C8FF00", color: "#0d0d0d", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", marginTop: 8 }}
                    >
                      + Ajouter un film
                    </button>
                  )}

                  {!addingProject && plan !== "pro" && projects.length >= projectLimit && (
                    <button
                      onClick={() => setShowProModal(true)}
                      style={{ width: "100%", padding: 12, borderRadius: 10, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)", color: "#f97316", fontWeight: 600, fontSize: 13, cursor: "pointer", marginTop: 8 }}
                    >
                      Passer a Unkast Pro pour publier plus &rarr;
                    </button>
                  )}

                  {/* Add project form */}
                  {addingProject && (
                    <div style={{ marginTop: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(200,255,0,0.2)", borderRadius: 12, padding: 16 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0", marginBottom: 12, marginTop: 0 }}>Nouveau projet</h4>
                      <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Titre du projet" className={inputCls} style={{ marginBottom: 10 }} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as ProjectCategory)} className={inputCls}>
                          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
                        </select>
                        <input type="number" value={newYear} onChange={(e) => setNewYear(parseInt(e.target.value) || new Date().getFullYear())} className={inputCls} min={1990} max={2030} />
                      </div>
                      <input type="url" value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} placeholder="URL video (Vimeo ou YouTube)" className={inputCls} style={{ marginBottom: 10 }} />
                      <input type="text" value={newOwnerRole} onChange={(e) => setNewOwnerRole(e.target.value)} placeholder="Ton role sur ce projet" className={inputCls} style={{ marginBottom: 10 }} />
                      <textarea rows={3} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description" className={inputCls} style={{ resize: "none", marginBottom: 10 }} />
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 12 }}>
                        <span style={{ color: "#555", fontSize: 12, marginTop: 1 }}>i</span>
                        <p style={{ fontSize: 12, color: "#888", lineHeight: 1.5, margin: 0 }}>Chaque film est examiné par l&apos;équipe Unkast avant d&apos;être publié. Délai habituel : 24-48h.</p>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={addProject} disabled={!newTitle || !newVideoUrl || saving} style={{ flex: 1, padding: 12, background: "#C8FF00", color: "#0d0d0d", fontWeight: 700, fontSize: 14, borderRadius: 10, border: "none", cursor: "pointer", opacity: !newTitle || !newVideoUrl || saving ? 0.5 : 1 }}>
                          {saving ? "Ajout..." : "Ajouter"}
                        </button>
                        <button onClick={() => setAddingProject(false)} style={{ flex: 1, padding: 12, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#888", fontSize: 14, borderRadius: 10, cursor: "pointer" }}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ----- Talent: Mes credits ----- */
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", margin: 0, marginBottom: 4 }}>Mes participations</h3>
                  <p style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>Les films dans lesquels tu apparais.</p>

                  {/* Confirmed */}
                  {myCredits.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#444", marginBottom: 16 }}>Tu n&apos;apparais dans aucun film pour le moment.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      {myCredits.map((credit) => (
                        <div key={credit.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>{credit.project_title || "Projet"}</p>
                            <p style={{ fontSize: 11, color: "#555", margin: 0, marginTop: 2 }}>{credit.role_on_project}</p>
                          </div>
                          {credit.project_slug && (
                            <Link href={`/projet/${credit.project_slug}`} style={{ fontSize: 12, color: "#C8FF00", textDecoration: "none" }}>Voir</Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pending requests */}
                  {myCreditRequests.filter((r) => r.status === "pending").length > 0 && (
                    <div>
                      <p style={{ ...sectionHeader, marginTop: 16 }}>Demandes de participation envoyees</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {myCreditRequests.filter((r) => r.status === "pending").map((req) => (
                          <div key={req.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>{req.project_title || "Projet"}</p>
                              <p style={{ fontSize: 11, color: "#555", margin: 0, marginTop: 2 }}>{req.role}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "rgba(234,179,8,0.1)", color: "#eab308", border: "1px solid rgba(234,179,8,0.2)" }}>En attente</span>
                              <button onClick={() => cancelMyCreditRequest(req.id)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#555", cursor: "pointer" }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Become Creator card */}
                  <div style={{ background: "rgba(200,255,0,0.03)", border: "1px dashed rgba(200,255,0,0.15)", borderRadius: 12, padding: 20, textAlign: "center", marginTop: 24 }}>
                    <svg style={{ margin: "0 auto 10px", opacity: 0.5 }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 4V2m0 2v2m0-2H5m2 0h2M3 20h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v10a2 2 0 002 2zM15 12l-4 2.5v-5l4 2.5z" /></svg>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 6 }}>Tu réalises ou produis des films ?</p>
                    <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>Passe en compte Créateur pour publier tes œuvres et construire ton équipe sur Unkast.</p>
                    <button onClick={() => switchAccountType("creator")} style={{ background: "transparent", border: "1px solid rgba(200,255,0,0.3)", color: "#C8FF00", borderRadius: 10, padding: "11px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                      Devenir Créateur →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: Activity */}
          {activeTab === "activity" && (
            <div style={{ marginTop: 16 }}>
              {!isCreator ? (
                /* ----- Talent activity ----- */
                <>
                  {/* Mes demandes de participation */}
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", margin: 0, marginBottom: 4 }}>Mes demandes de participation</h3>
                    <p style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>Les projets que tu as demandé à rejoindre.</p>
                    {myCreditRequests.length === 0 ? (
                      <div style={{ marginBottom: 24 }}>
                        <p style={{ fontSize: 13, color: "#444", marginBottom: 12 }}>Tu n&apos;as pas encore demandé à rejoindre un projet.</p>
                        <Link href="/recherche" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.2)", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 600, color: "#C8FF00" }}>
                          Explorer les films →
                        </Link>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                        {myCreditRequests.map((req) => {
                          const statusColor = req.status === "pending" ? "#f97316" : req.status === "accepted" ? "#22c55e" : "#ef4444";
                          const statusLabel = req.status === "pending" ? "En attente" : req.status === "accepted" ? "Accepté" : "Refusé";
                          return (
                            <div key={req.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.project_title || "Projet"}</p>
                                  <p style={{ fontSize: 11, color: "#555", margin: 0, marginTop: 2 }}>{req.role}</p>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: `rgba(${req.status === "pending" ? "249,115,22" : req.status === "accepted" ? "34,197,94" : "239,68,68"},0.1)`, color: statusColor, border: `1px solid rgba(${req.status === "pending" ? "249,115,22" : req.status === "accepted" ? "34,197,94" : "239,68,68"},0.2)` }}>{statusLabel}</span>
                                  {req.status === "pending" && (
                                    <button onClick={() => cancelMyCreditRequest(req.id)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#555", cursor: "pointer" }}>
                                      Annuler
                                    </button>
                                  )}
                                  {req.status === "accepted" && req.project_slug && (
                                    <Link href={`/projet/${req.project_slug}`} style={{ fontSize: 12, color: "#C8FF00", textDecoration: "none" }}>Voir le projet</Link>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0 24px" }} />

                  {/* Invitations reçues */}
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", margin: 0, marginBottom: 4 }}>Invitations reçues</h3>
                    <p style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>Des créateurs t&apos;ont invité à rejoindre leur projet.</p>
                    {receivedInvitations.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#444" }}>Aucune invitation reçue.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {receivedInvitations.map((inv) => (
                          <div key={inv.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: inv.message ? 8 : 0 }}>
                              {/* Project thumbnail */}
                              <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {inv.project_poster_url ? (
                                  <img src={inv.project_poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={1.5}><path d="M15 12l-4 2.5v-5l4 2.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.project_title || "Projet"}</p>
                                <p style={{ fontSize: 11, color: "#555", margin: 0, marginTop: 2 }}>
                                  {inv.role_offered && <span>{inv.role_offered}</span>}
                                  {inv.inviter_name && <span style={{ color: "#444" }}> · {inv.inviter_name}</span>}
                                </p>
                              </div>
                            </div>
                            {inv.message && (
                              <p style={{ fontSize: 11, color: "#555", fontStyle: "italic", margin: "0 0 10px" }}>&quot;{inv.message}&quot;</p>
                            )}
                            {inv.status === "pending" && (
                              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                <button onClick={() => handleInvitationAction(inv.id, "accepted")} style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                                  Accepter
                                </button>
                                <button onClick={() => handleInvitationAction(inv.id, "refused")} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                                  Refuser
                                </button>
                              </div>
                            )}
                            {inv.status !== "pending" && (
                              <span style={{ display: "inline-block", marginTop: 8, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: inv.status === "accepted" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: inv.status === "accepted" ? "#22c55e" : "#ef4444", border: `1px solid ${inv.status === "accepted" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                                {inv.status === "accepted" ? "Acceptée" : "Déclinée"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ----- Creator activity ----- */
                <>
                  {/* Demandes de participation */}
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", margin: 0, marginBottom: 4 }}>Demandes de participation</h3>
                    <p style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>Des membres veulent apparaître dans l&apos;équipe de tes films.</p>
                    {pendingReceivedCredits.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#444" }}>Aucune demande en attente.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {pendingReceivedCredits.map((cr) => (
                          <div key={cr.id} style={{ background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 12, padding: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>{cr.requester_name || "Membre"}</p>
                                <p style={{ fontSize: 11, color: "#555", margin: 0, marginTop: 2 }}>
                                  {cr.project_title && <span>{cr.project_title} &middot; </span>}
                                  {cr.role}
                                </p>
                                {cr.message && <p style={{ fontSize: 11, color: "#555", margin: 0, marginTop: 4, fontStyle: "italic" }}>&quot;{cr.message}&quot;</p>}
                              </div>
                              <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                                <button onClick={() => handleCreditAction(cr.id, "accepted")} style={{ padding: "6px 12px", background: "#C8FF00", color: "#0d0d0d", fontWeight: 700, fontSize: 11, borderRadius: 8, border: "none", cursor: "pointer" }}>
                                  Accepter
                                </button>
                                <button onClick={() => handleCreditAction(cr.id, "refused")} style={{ padding: "6px 12px", background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#555", fontSize: 11, borderRadius: 8, cursor: "pointer" }}>
                                  Refuser
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "24px 0" }} />

                  {/* Invitations envoyées */}
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0", margin: 0, marginBottom: 4 }}>Invitations envoyées</h3>
                    <p style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>Les membres que tu as invités à rejoindre tes projets.</p>
                    {sentInvitations.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#444" }}>Aucune invitation envoyée.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {sentInvitations.map((inv) => {
                          const statusColor = inv.status === "pending" ? "#f97316" : inv.status === "accepted" ? "#22c55e" : "#ef4444";
                          const statusLabel = inv.status === "pending" ? "En attente" : inv.status === "accepted" ? "Acceptée" : "Déclinée";
                          return (
                            <div key={inv.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                {/* Invited person avatar */}
                                <Avatar url={inv.invitee_avatar_url} name={inv.invitee_name || "?"} size={36} style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>{inv.invitee_name || "Membre"}</p>
                                  <p style={{ fontSize: 11, color: "#555", margin: 0, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.project_title || "Projet"}</p>
                                </div>
                                <span style={{ flexShrink: 0, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: `rgba(${inv.status === "pending" ? "249,115,22" : inv.status === "accepted" ? "34,197,94" : "239,68,68"},0.1)`, color: statusColor, border: `1px solid rgba(${inv.status === "pending" ? "249,115,22" : inv.status === "accepted" ? "34,197,94" : "239,68,68"},0.2)` }}>{statusLabel}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: Recrutement (espace pré-casting — Pro createur/recruteur) */}
          {activeTab === "recrutement" && canRecruit && (
            <RecruitmentSpace showToast={showToast} />
          )}

          {/* TAB: Compte */}
          {activeTab === "compte" && (
            <div style={{ marginTop: 16 }}>
              {/* Mon forfait */}
              <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Mon forfait</p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>
                    {plan === "pro" ? "Unkast Pro" : "Gratuit"}
                  </p>
                  <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: plan === "pro" ? "rgba(200,255,0,0.1)" : "rgba(255,255,255,0.06)", color: plan === "pro" ? "#C8FF00" : "#666", border: plan === "pro" ? "1px solid rgba(200,255,0,0.3)" : "1px solid rgba(255,255,255,0.08)" }}>
                    {plan === "pro" ? "Actif" : "Free"}
                  </span>
                </div>

                {proOrigin && (
                  <p style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{proOrigin}</p>
                )}

                <p style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
                  Type de compte : {profile.account_type === "creator" ? "Créateur" : profile.account_type === "recruiter" ? "Recruteur" : "Talent"}
                </p>

                {/* Bascule de role : uniquement talent <-> creator (recruteur masque) */}
                {(profile.account_type === "talent" || profile.account_type === "creator") && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {(["talent", "creator"] as const).map((r) => {
                      const active = profile.account_type === r;
                      return (
                        <button
                          key={r}
                          onClick={() => switchAccountType(r)}
                          disabled={active}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: active ? "default" : "pointer", background: active ? "rgba(200,255,0,0.1)" : "rgba(255,255,255,0.03)", color: active ? "#C8FF00" : "#888", border: active ? "1px solid rgba(200,255,0,0.3)" : "1px solid rgba(255,255,255,0.08)" }}
                        >
                          {r === "creator" ? "Je publie des œuvres (Créateur)" : "J'ai participé à un projet (Talent)"}
                        </button>
                      );
                    })}
                  </div>
                )}

                {plan === "free" && (
                  <p style={{ fontSize: 12, color: "#444", lineHeight: 1.5, marginTop: 8 }}>
                    Version gratuite — {MAX_PROJECTS_FREE} publications de films maximum.
                  </p>
                )}
              </div>

              {/* Pro upsell card */}
              {plan === "free" && (
                <div style={{ background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.15)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(200,255,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 2 }}>Passe a Unkast Pro</p>
                      <p style={{ fontSize: 12, color: "#666" }}>A partir de 9,99 €/mois</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {["Jusqu'à 30 films", "Messagerie directe", "Contacter les talents", "Badge Pro vérifié", "Priorité dans les résultats"].map((f) => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                        <span style={{ fontSize: 13, color: "#ccc" }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <Link href="/pro" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: 14, background: "#C8FF00", color: "#0d0d0d", fontSize: 15, fontWeight: 600, borderRadius: 12, textDecoration: "none", border: "none" }}>
                    Découvrir Unkast Pro
                  </Link>
                </div>
              )}

              {/* Pro active badge */}
              {plan === "pro" && (
                <div style={{ background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.15)", borderRadius: 16, padding: 20, marginBottom: 16, textAlign: "center" }}>
                  <svg style={{ margin: "0 auto 12px" }} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", marginBottom: 4 }}>Tu es Pro !</p>
                  <p style={{ fontSize: 12, color: "#666" }}>Toutes les fonctionnalités sont déverrouillées.</p>
                </div>
              )}

              {/* Disconnect — separate */}
              <button onClick={handleLogout} style={{ width: "100%", padding: 14, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, color: "#ef4444", fontSize: 14, fontWeight: 500, textAlign: "center", cursor: "pointer", marginTop: 8 }}>
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pro upsell modal */}
      <AnimatePresence>
        {showProModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowProModal(false)}
            style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(20px)", padding: 16 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: 24, maxWidth: 360, width: "100%", textAlign: "center" }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 }}>Tu as utilise tes {MAX_PROJECTS_FREE} films gratuits</h3>
              <p style={{ fontSize: 14, color: "#888", marginBottom: 24, lineHeight: 1.5 }}>Passe à Unkast Pro pour publier en illimité et booster ta visibilité.</p>
              <a
                href="mailto:pro@unkast.com?subject=Liste attente Pro"
                style={{ display: "block", width: "100%", padding: 12, background: "#C8FF00", color: "#0d0d0d", fontWeight: 700, fontSize: 14, borderRadius: 10, textDecoration: "none", textAlign: "center", marginBottom: 12 }}
              >
                Rejoindre la liste d&apos;attente
              </a>
              <button onClick={() => setShowProModal(false)} style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer" }}>
                Pas maintenant
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
