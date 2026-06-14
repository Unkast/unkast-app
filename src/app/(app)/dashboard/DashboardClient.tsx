"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AvatarUpload from "@/components/AvatarUpload";
import Avatar from "@/components/Avatar";
import { normalizeUrl, formatInstagram } from "@/lib/profile";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORY_LABELS, CATEGORY_COLORS, MAX_PROJECTS_FREE, MAX_PROJECTS_PRO } from "@/lib/constants";
import type {
  Profile,
  ProfileRole,
  Project,
  ProjectCredit,
  ProjectCategory,
  CreditRequest,
} from "@/types/database";

type DashSection = "profil" | "projets" | "credits";

interface ProjectWithCredits extends Project {
  credits: ProjectCredit[];
}

interface CreditRequestWithProject extends CreditRequest {
  project_title?: string;
  project_slug?: string;
  requester_name?: string;
}

export default function DashboardClient({ initialSection = "profil" }: { initialSection?: DashSection }) {
  const router = useRouter();
  const [section, setSection] = useState<DashSection>(initialSection);
  const [loading, setLoading] = useState(true);

  // Profile state
  const [profile, setProfile] = useState<(Profile & { account_type?: string }) | null>(null);
  const [roles, setRoles] = useState<ProfileRole[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAvailable, setEditAvailable] = useState(false);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editRoleInput, setEditRoleInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Profile edit — new fields
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editStageName, setEditStageName] = useState("");
  const [editDisplayPref, setEditDisplayPref] = useState<"real_name" | "stage_name">("real_name");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editPhonePrefix, setEditPhonePrefix] = useState("+33");
  const [editInstagram, setEditInstagram] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editShowEmail, setEditShowEmail] = useState("nobody");
  const [editShowPhone, setEditShowPhone] = useState("nobody");
  const [editShowRealName, setEditShowRealName] = useState("nobody");

  // Projects state
  const [projects, setProjects] = useState<ProjectWithCredits[]>([]);
  const [addingProject, setAddingProject] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<ProjectCategory>("court-metrage");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOwnerRole, setNewOwnerRole] = useState("");

  // Team management state
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [creditRequests, setCreditRequests] = useState<CreditRequestWithProject[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [toast, setToast] = useState("");

  // Talent credits state
  const [myCredits, setMyCredits] = useState<(ProjectCredit & { project_title?: string; project_slug?: string })[]>([]);
  const [myCreditRequests, setMyCreditRequests] = useState<CreditRequestWithProject[]>([]);

  // Pro upsell modal
  const [showProModal, setShowProModal] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const isCreator = profile?.account_type === "creator";
  const plan = profile?.plan || "free";
  const projectLimit = plan === "pro" ? MAX_PROJECTS_PRO : MAX_PROJECTS_FREE;

  const fetchProfile = useCallback(async () => {
    const res = await fetch("/api/dashboard/profile");
    if (res.status === 401) {
      router.push("/connexion");
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

  useEffect(() => {
    Promise.all([fetchProfile(), fetchProjects(), fetchCreditRequests()]).finally(() =>
      setLoading(false)
    );
  }, [fetchProfile, fetchProjects, fetchCreditRequests]);

  function startEditProfile() {
    if (!profile) return;
    setEditName(profile.full_name);
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
    // Parse existing prefix
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
    setEditingProfile(true);
  }

  async function saveProfile() {
    setSaving(true);
    await fetch("/api/dashboard/profile", {
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
      }),
    });
    await fetchProfile();
    setEditingProfile(false);
    setSaving(false);
  }

  function addEditRole() {
    const r = editRoleInput.trim();
    if (r && !editRoles.includes(r)) {
      setEditRoles([...editRoles, r]);
      setEditRoleInput("");
    }
  }

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

  async function handleCreditAction(id: string, status: "accepted" | "refused") {
    await fetch(`/api/credits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await Promise.all([fetchCreditRequests(), fetchProjects()]);
    showToast(status === "accepted" ? "Credit accepte" : "Demande refusee");
  }

  async function cancelMyCreditRequest(id: string) {
    await fetch(`/api/credits/${id}`, { method: "DELETE" });
    await fetchCreditRequests();
    showToast("Demande annulee");
  }

  async function sendInvitation(projectId: string) {
    if (!inviteEmail || !inviteRole) return;
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, email: inviteEmail, role: inviteRole, name: inviteName || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // L'email peut etre saute en dev (Resend non configure) : on le signale.
      showToast(data.email_sent ? "Invitation envoyee par email" : "Invitation enregistree (email non envoye en dev)");
      setInviteEmail("");
      setInviteRole("");
      setInviteName("");
      await fetchProjects();
    } else {
      showToast(data.error || "Erreur");
    }
  }


  // Tabs config
  const tabs: { key: DashSection; href: string; label: string }[] = [
    { key: "profil", href: "/dashboard", label: "Mon profil" },
    { key: "projets", href: "/dashboard/projets", label: isCreator ? `Mes films (${projects.length})` : `Projets (${projects.length})` },
  ];
  if (!isCreator) {
    tabs.splice(1, 0, { key: "credits", href: "/dashboard", label: `Mes credits (${myCredits.length})` });
  }

  if (loading) {
    return (
      <div className="pb-16 lg:pb-0">
        <main className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-lime/30 border-t-lime rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pb-16 lg:pb-0">
        <main className="flex items-center justify-center text-center px-4 py-20">
          <div>
            <p className="text-text-secondary mb-4">Tu dois etre connecte pour acceder au dashboard.</p>
            <Link href="/connexion" className="px-6 py-3 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition">
              Se connecter
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
    <div className="pb-16 lg:pb-0">
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 z-50 px-4 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-sm text-text-primary shadow-lg max-w-sm"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[22px] font-medium text-text-primary" style={{ letterSpacing: "-0.5px" }}>Bonjour, {profile.full_name.split(" ")[0]}</h1>
          <StatusBadge status={profile.status ?? "pending"} />
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 rounded-[10px] p-1 mb-5 overflow-x-auto no-scrollbar">
          {tabs.map(({ key, href, label }) => (
            <button
              key={key}
              onClick={() => { setSection(key); if (href !== "/dashboard") router.push(href); }}
              className={`px-4 py-2 rounded-md text-sm transition whitespace-nowrap ${
                section === key
                  ? "bg-[#C8FF00] text-[#0d0d0d] font-semibold"
                  : "text-[#555] hover:text-text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* PROFIL SECTION */}
        {section === "profil" && (
          <div>
            {editingProfile ? (
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 space-y-1">
                <h2 className="text-lg font-bold text-text-primary mb-2">Editer mon profil</h2>

                {/* PHOTO */}
                <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, marginTop: 24 }}>Photo</p>
                <div className="flex flex-col items-center gap-2 py-2">
                  <AvatarUpload
                    currentAvatarUrl={profile.avatar_url}
                    onUploadComplete={(url) => setProfile({ ...profile, avatar_url: url || null })}
                    initials={profile.full_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                    size={80}
                  />
                  <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#444", textAlign: "center" }}>Appuie pour changer la photo</p>
                </div>

                {/* IDENTITE */}
                <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, marginTop: 24 }}>Identite</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1.5">Prenom</label>
                    <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition" placeholder="Prenom" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1.5">Nom</label>
                    <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition" placeholder="Nom de famille" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-text-secondary mb-1.5">Nom de scene / Pseudonyme</label>
                  <input type="text" value={editStageName} onChange={(e) => setEditStageName(e.target.value)} className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition" placeholder="Ex: J.M. Vision" />
                  <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#444", marginTop: 6 }}>Laisse vide si tu n&apos;en as pas</p>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-text-secondary mb-2">Afficher sur le profil public</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditDisplayPref("real_name")}
                      className="px-4 py-2 rounded-full text-xs font-semibold transition"
                      style={{ background: editDisplayPref === "real_name" ? "#C8FF00" : "transparent", color: editDisplayPref === "real_name" ? "#0d0d0d" : "#555", border: editDisplayPref === "real_name" ? "1px solid #C8FF00" : "1px solid #333" }}
                    >
                      Vrai nom
                    </button>
                    <button
                      onClick={() => setEditDisplayPref("stage_name")}
                      className="px-4 py-2 rounded-full text-xs font-semibold transition"
                      style={{ background: editDisplayPref === "stage_name" ? "#C8FF00" : "transparent", color: editDisplayPref === "stage_name" ? "#0d0d0d" : "#555", border: editDisplayPref === "stage_name" ? "1px solid #C8FF00" : "1px solid #333" }}
                    >
                      Nom de scene
                    </button>
                  </div>
                </div>

                {/* PROFIL PRO */}
                <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, marginTop: 24 }}>Profil pro</p>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Metiers</label>
                  <div className="flex gap-2">
                    <input type="text" value={editRoleInput} onChange={(e) => setEditRoleInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEditRole(); } }} className="flex-1 px-4 py-2.5 bg-background border border-white/5 rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition" placeholder="Ajouter un metier..." />
                    <button onClick={addEditRole} className="px-4 py-2.5 bg-background border border-white/5 rounded-xl text-text-secondary hover:border-lime/50 hover:text-lime transition text-sm">+</button>
                  </div>
                  {editRoles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editRoles.map((r) => (
                        <span key={r} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime/10 border border-lime/30 text-lime text-xs font-semibold">
                          {r}
                          <button onClick={() => setEditRoles(editRoles.filter((x) => x !== r))} className="hover:text-white">&times;</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-text-secondary mb-1.5">Ville</label>
                  <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition" placeholder="Paris, Lyon..." />
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-text-secondary mb-1.5">
                    Bio <span style={{ color: "#555" }}>({editBio.length}/280)</span>
                  </label>
                  <textarea rows={4} value={editBio} onChange={(e) => { if (e.target.value.length <= 280) setEditBio(e.target.value); }} className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition resize-none" placeholder="Decris ton parcours, tes specialites..." />
                </div>

                {/* DISPONIBILITE */}
                <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, marginTop: 24 }}>Disponibilite</p>
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={editAvailable} onChange={(e) => setEditAvailable(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-teal transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
                  </label>
                  <span className="text-sm text-text-secondary">Disponible pour des projets</span>
                </div>

                {/* CONTACT & VISIBILITE */}
                <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, marginTop: 24 }}>Contact &amp; visibilite</p>
                <div className="p-3 rounded-lg bg-white/[0.02] border-l-2 border-[#C8FF00] pl-4 mb-4" style={{ borderLeft: "2px solid #C8FF00" }}>
                  <p className="text-xs text-text-secondary leading-relaxed">Ces informations permettent aux recruteurs de te contacter via Unkast. Elles ne sont pas affichees publiquement sur ton profil.</p>
                </div>

                {/* contact_email */}
                <div className="mt-2">
                  <label className="block text-xs text-text-secondary mb-1.5">Email de contact</label>
                  <input type="email" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition" placeholder="contact@exemple.com" />
                </div>

                {/* contact_phone */}
                <div className="mt-4">
                  <label className="block text-xs text-text-secondary mb-1.5">Telephone</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={editPhonePrefix}
                      onChange={(e) => setEditPhonePrefix(e.target.value)}
                      style={{ width: 100, padding: "12px 8px", background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, color: "#f0f0f0", fontSize: 14, outline: "none", flexShrink: 0 }}
                    >
                      <option value="+33">🇫🇷 +33</option>
                      <option value="+32">🇧🇪 +32</option>
                      <option value="+41">🇨🇭 +41</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+49">🇩🇪 +49</option>
                      <option value="+34">🇪🇸 +34</option>
                      <option value="+39">🇮🇹 +39</option>
                      <option value="+351">🇵🇹 +351</option>
                      <option value="+212">🇲🇦 +212</option>
                      <option value="+216">🇹🇳 +216</option>
                      <option value="+213">🇩🇿 +213</option>
                      <option value="+225">🇨🇮 +225</option>
                      <option value="+221">🇸🇳 +221</option>
                      <option value="+237">🇨🇲 +237</option>
                    </select>
                    <input type="tel" inputMode="tel" autoComplete="tel" value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} style={{ flex: 1, padding: "12px 14px", background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, color: "#f0f0f0", fontSize: 16, outline: "none" }} placeholder="6 12 34 56 78" />
                  </div>
                </div>

                {/* instagram */}
                <div className="mt-4">
                  <label className="block text-xs text-text-secondary mb-1.5">Instagram</label>
                  <input type="url" value={editInstagram} onChange={(e) => setEditInstagram(e.target.value)} className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition" placeholder="https://instagram.com/tonpseudo" />
                </div>

                {/* website */}
                <div className="mt-4">
                  <label className="block text-xs text-text-secondary mb-1.5">Site web / Portfolio</label>
                  <input type="url" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition" placeholder="https://tonsite.com" />
                </div>

                <div className="flex gap-3 pt-6">
                  <button onClick={saveProfile} disabled={saving} className="px-6 py-3 bg-lime text-[#0d0d0d] font-semibold text-sm rounded-xl hover:brightness-110 transition disabled:opacity-50">
                    {saving ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                  <button onClick={() => setEditingProfile(false)} className="px-6 py-3 border border-white/15 text-text-secondary text-sm rounded-lg hover:text-text-primary transition">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      {/* Static avatar in view mode */}
                      <Avatar url={profile.avatar_url} name={profile.full_name} size={72} style={{ border: "2px solid rgba(200,255,0,0.2)" }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-bold text-text-primary">
                          {(profile as any).stage_name && (profile as any).display_name_preference === "stage_name"
                            ? (profile as any).stage_name
                            : profile.full_name}
                        </h2>
                        {profile.is_available && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal/10 border border-teal/30 text-teal text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                            Disponible
                          </span>
                        )}
                      </div>
                      {roles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {roles.map((r) => (
                            <span key={r.id} className="px-2 py-0.5 rounded-full bg-lime/10 border border-lime/30 text-lime text-[10px] font-semibold">
                              {r.role_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={startEditProfile} className="px-4 py-2 border border-white/15 text-text-secondary text-sm rounded-lg hover:border-white/10 hover:text-text-primary transition">
                    Editer
                  </button>
                </div>
                {profile.location ? (
                  <p className="text-sm text-text-secondary mb-2">
                    <svg className="inline-block w-4 h-4 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {profile.location}
                  </p>
                ) : (
                  <button onClick={startEditProfile} className="text-xs text-[#C8FF00] hover:underline mt-1">Ajoute ta ville →</button>
                )}
                {profile.bio ? (
                  <p className="text-sm text-text-secondary leading-relaxed mt-3">{profile.bio}</p>
                ) : (
                  <button onClick={startEditProfile} className="text-xs text-[#C8FF00] hover:underline mt-1">Ajoute une bio →</button>
                )}
                {/* Contact info summary */}
                {((profile as any).contact_email || (profile as any).instagram_url || (profile as any).website_url) && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {(profile as any).contact_email && (
                      <span className="text-xs text-text-tertiary">{(profile as any).contact_email}</span>
                    )}
                    {(profile as any).instagram_url && (() => {
                      const ig = formatInstagram((profile as any).instagram_url);
                      return ig ? <a href={ig.href} target="_blank" rel="noopener noreferrer" className="text-xs text-[#C8FF00] hover:underline">{ig.display}</a> : null;
                    })()}
                    {(profile as any).website_url && (
                      <a href={normalizeUrl((profile as any).website_url) || "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-[#C8FF00] hover:underline">Site web</a>
                    )}
                  </div>
                )}
                {profile.status === "approved" && (
                  <Link href={`/profil/${profile.slug}`} className="inline-flex items-center gap-2 mt-4 text-xs text-lime hover:underline">
                    Voir mon profil public
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* PROJETS SECTION (creator) */}
        {section === "projets" && (
          <div>
            {/* Limit indicator */}
            {isCreator && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-text-secondary">{projects.length} / {projectLimit} films utilises</p>
                  {plan !== "pro" && projects.length >= projectLimit && (
                    <button onClick={() => setShowProModal(true)} className="text-xs text-orange-400 hover:text-orange-300 transition font-medium">
                      Passer a Unkast Pro →
                    </button>
                  )}
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${projects.length >= projectLimit ? "bg-orange-500" : "bg-lime"}`}
                    style={{ width: `${Math.min(100, (projects.length / projectLimit) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-text-tertiary">
                {projects.length} projet{projects.length > 1 ? "s" : ""}
              </p>
              {isCreator && projects.length < projectLimit && !addingProject && (
                <button onClick={() => setAddingProject(true)} className="px-4 py-2 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition">
                  + Ajouter un film
                </button>
              )}
            </div>

            {/* Add project form */}
            {addingProject && (
              <div className="bg-white/[0.03] border border-lime/30 rounded-xl p-6 mb-6 space-y-4">
                <h3 className="text-lg font-bold text-text-primary">Nouveau projet</h3>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Titre du projet" className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-base placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition" />
                <div className="grid grid-cols-2 gap-4">
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as ProjectCategory)} className="px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-base focus:outline-none focus:border-lime/50 transition">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
                  </select>
                  <input type="number" value={newYear} onChange={(e) => setNewYear(parseInt(e.target.value) || new Date().getFullYear())} className="px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-base focus:outline-none focus:border-lime/50 transition" min={1990} max={2030} />
                </div>
                <input type="url" value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} placeholder="URL video (Vimeo ou YouTube)" className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-base placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition" />
                <input type="text" value={newOwnerRole} onChange={(e) => setNewOwnerRole(e.target.value)} placeholder="Ton role sur ce projet" className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-base placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition" />
                <textarea rows={3} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description" className="w-full px-4 py-3 bg-background border border-white/5 rounded-xl text-text-primary text-base placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition resize-none" />
                <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-text-tertiary text-xs mt-0.5">i</span>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Chaque film est examine par l&apos;equipe Unkast avant d&apos;etre publie sur la plateforme. Delai habituel : 24-48h.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={addProject} disabled={!newTitle || !newVideoUrl || saving} className="px-6 py-3 bg-lime text-[#0d0d0d] font-semibold text-sm rounded-xl hover:brightness-110 transition disabled:opacity-50">
                    {saving ? "Ajout..." : "Ajouter"}
                  </button>
                  <button onClick={() => setAddingProject(false)} className="px-6 py-3 border border-white/15 text-text-secondary text-sm rounded-lg hover:text-text-primary transition">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Project list */}
            {projects.length === 0 && !addingProject ? (
              <div className="border border-dashed border-[rgba(200,255,0,0.15)] rounded-xl p-8 text-center">
                <svg className="w-10 h-10 mx-auto mb-3 text-[#C8FF00] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4V2m0 2v2m0-2H5m2 0h2M3 20h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v10a2 2 0 002 2zM15 12l-4 2.5v-5l4 2.5z" />
                </svg>
                <h3 className="text-sm font-medium text-text-primary mb-1">Publie ton premier film</h3>
                <p className="text-xs text-text-tertiary mb-4">Ajoute jusqu&apos;a 2 films gratuitement</p>
                <button onClick={() => setAddingProject(true)} className="px-5 py-2.5 bg-[#C8FF00] text-[#0d0d0d] font-semibold text-sm rounded-lg hover:brightness-110 transition">
                  + Ajouter un film
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => {
                  const catColor = CATEGORY_COLORS[project.category];
                  const isExpanded = expandedTeam === project.id;
                  const projectCreditReqs = creditRequests.filter((cr) => cr.project_id === project.id && cr.status === "pending");

                  return (
                    <div key={project.id} className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
                      {/* Project card */}
                      <div className="p-5 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: catColor + "15", color: catColor, border: `1px solid ${catColor}30` }}>
                              {CATEGORY_LABELS[project.category]}
                            </span>
                            <span className="text-xs font-mono text-text-tertiary">{project.year}</span>
                            {(project as ProjectWithCredits & { status?: string }).status === "pending" && (
                              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-orange-500/10 text-[#f97316] border border-orange-500/20">En attente de validation</span>
                            )}
                            {(project as ProjectWithCredits & { status?: string }).status === "approved" && (
                              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-lime/10 text-lime border border-lime/20">Publie</span>
                            )}
                            {(project as ProjectWithCredits & { status?: string }).status === "refused" && (
                              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">Refuse</span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-text-primary truncate">{project.title}</h3>
                          {(project as ProjectWithCredits & { status?: string }).status === "refused" && (
                            <p className="text-[10px] text-red-400 mt-0.5">Contacte-nous pour plus d&apos;informations</p>
                          )}
                          <p className="text-xs text-text-tertiary mt-1">
                            {project.credits.length} credit{project.credits.length > 1 ? "s" : ""}
                            {projectCreditReqs.length > 0 && (
                              <span className="ml-2 text-orange-400">· {projectCreditReqs.length} demande{projectCreditReqs.length > 1 ? "s" : ""}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          {isCreator && (
                            <button
                              onClick={() => setExpandedTeam(isExpanded ? null : project.id)}
                              className={`px-3 py-1.5 border text-xs rounded-lg transition ${isExpanded ? "border-lime/30 text-lime bg-lime/5" : "border-white/5 text-text-secondary hover:border-white/10 hover:text-text-primary"}`}
                            >
                              {isExpanded ? "Fermer" : "Gerer l'equipe"}
                            </button>
                          )}
                          <Link href={`/projet/${project.slug}`} className="px-3 py-1.5 border border-white/5 text-text-secondary text-xs rounded-lg hover:border-white/10 hover:text-text-primary transition">
                            Voir
                          </Link>
                          {isCreator && (
                            <button onClick={() => deleteProject(project.id)} className="px-3 py-1.5 border border-white/5 text-text-tertiary text-xs rounded-lg hover:border-red-500/30 hover:text-red-400 transition">
                              Supprimer
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Team management panel (inline) */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-white/5 px-5 py-4 space-y-5">
                              {/* Existing credits */}
                              <div>
                                <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Equipe</h4>
                                {project.credits.length === 0 ? (
                                  <p className="text-xs text-text-tertiary">Aucun credit.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {project.credits.map((credit) => (
                                      <div key={credit.id} className="flex items-center gap-3 py-1.5">
                                        <Avatar url={null} name={credit.ghost_name || "?"} size={28} />
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-medium text-text-primary truncate">
                                            {credit.profile_id ? (
                                              <Link href={`/profil/${credit.profile_id}`} className="hover:text-lime transition">{credit.ghost_name || "Membre"}</Link>
                                            ) : (
                                              credit.ghost_name || "Inconnu"
                                            )}
                                          </p>
                                          <p className="text-[10px] text-text-tertiary">{credit.role_on_project}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${credit.profile_id ? "bg-teal/10 text-[#00D4AA] border border-[#00D4AA]/20" : "bg-white/5 text-text-tertiary border border-white/10"}`}>
                                          {credit.profile_id ? "Confirme" : "Invite"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Pending credit requests */}
                              {projectCreditReqs.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">Demandes en attente</h4>
                                  <div className="space-y-2">
                                    {projectCreditReqs.map((cr) => (
                                      <div key={cr.id} className="flex items-center justify-between bg-orange-500/5 border border-orange-500/15 rounded-lg px-3 py-2.5">
                                        <div>
                                          <p className="text-xs font-medium text-text-primary">{cr.requester_name || "Membre"}</p>
                                          <p className="text-[10px] text-text-tertiary">Demande : {cr.role}</p>
                                          {cr.message && <p className="text-[10px] text-text-tertiary mt-0.5 italic">&quot;{cr.message}&quot;</p>}
                                        </div>
                                        <div className="flex gap-1.5 flex-shrink-0 ml-3">
                                          <button onClick={() => handleCreditAction(cr.id, "accepted")} className="px-3 py-1 bg-lime text-[#0d0d0d] font-bold text-[10px] rounded-md hover:brightness-110 transition">
                                            Accepter
                                          </button>
                                          <button onClick={() => handleCreditAction(cr.id, "refused")} className="px-3 py-1 border border-white/10 text-text-tertiary text-[10px] rounded-md hover:border-red-500/30 hover:text-red-400 transition">
                                            Refuser
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Invite a member par email (collaborateur absent d'Unkast) */}
                              <div>
                                <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Créditer un collaborateur absent</h4>
                                <p className="text-[10px] text-text-tertiary mb-2">Il reçoit un email pour rejoindre Unkast et revendiquer son crédit. Pour créditer un membre déjà inscrit, passe par son profil.</p>
                                <div className="flex gap-2">
                                  <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nom" className="w-28 px-3 py-2 bg-background border border-white/5 rounded-lg text-text-primary text-xs placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition" />
                                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email" className="flex-1 px-3 py-2 bg-background border border-white/5 rounded-lg text-text-primary text-xs placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition" />
                                  <input type="text" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} placeholder="Rôle" className="w-28 px-3 py-2 bg-background border border-white/5 rounded-lg text-text-primary text-xs placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition" />
                                  <button onClick={() => sendInvitation(project.id)} disabled={!inviteEmail || !inviteRole} className="px-3 py-2 bg-lime text-[#0d0d0d] font-bold text-xs rounded-lg hover:brightness-110 transition disabled:opacity-40">
                                    Inviter
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CREDITS SECTION (talent) */}
        {section === "credits" && !isCreator && (
          <div className="space-y-6">
            {/* Confirmed credits */}
            <div>
              <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Credits confirmes ({myCredits.length})</h3>
              {myCredits.length === 0 ? (
                <p className="text-xs text-text-tertiary py-4">Aucun credit pour le moment.</p>
              ) : (
                <div className="space-y-2">
                  {myCredits.map((credit) => (
                    <div key={credit.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{credit.project_title || "Projet"}</p>
                        <p className="text-xs text-text-tertiary">{credit.role_on_project}</p>
                      </div>
                      {credit.project_slug && (
                        <Link href={`/projet/${credit.project_slug}`} className="px-3 py-1.5 border border-white/5 text-text-secondary text-xs rounded-lg hover:border-white/10 hover:text-text-primary transition">
                          Voir
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending requests */}
            <div>
              <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Demandes en attente ({myCreditRequests.filter((r) => r.status === "pending").length})</h3>
              {myCreditRequests.filter((r) => r.status === "pending").length === 0 ? (
                <p className="text-xs text-text-tertiary py-4">Aucune demande en attente.</p>
              ) : (
                <div className="space-y-2">
                  {myCreditRequests.filter((r) => r.status === "pending").map((req) => (
                    <div key={req.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{req.project_title || "Projet"}</p>
                        <p className="text-xs text-text-tertiary">{req.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">En attente</span>
                        <button onClick={() => cancelMyCreditRequest(req.id)} className="px-3 py-1.5 border border-white/5 text-text-tertiary text-xs rounded-lg hover:border-red-500/30 hover:text-red-400 transition">
                          Annuler
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pro upsell modal */}
        <AnimatePresence>
          {showProModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[20px] p-4"
              onClick={() => setShowProModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#141414] border border-white/5 rounded-2xl p-6 max-w-sm w-full text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Tu as utilise tes 2 films gratuits</h3>
                <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                  Passe a Unkast Pro pour publier en illimite et booster ta visibilite.
                </p>
                <a
                  href="mailto:pro@unkast.com?subject=Liste attente Pro"
                  className="block w-full py-3 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition mb-3"
                >
                  Rejoindre la liste d&apos;attente
                </a>
                <button onClick={() => setShowProModal(false)} className="text-xs text-text-tertiary hover:text-text-primary transition">
                  Pas maintenant
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
    </motion.div>
  );
}

/* ---- Sub-components ---- */

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[20px] bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] text-[#22c55e] text-xs font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
        Approuve
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
        Rejete
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
      En attente
    </span>
  );
}

