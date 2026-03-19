"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORY_LABELS, CATEGORY_COLORS, MAX_PROJECTS_FREE } from "@/lib/constants";
import type {
  Profile,
  ProfileRole,
  Project,
  ProjectCredit,
  ProjectCategory,
  ContactRequest,
} from "@/types/database";

type DashSection = "profil" | "projets" | "contacts";

interface ProjectWithCredits extends Project {
  credits: ProjectCredit[];
}

export default function DashboardClient({ initialSection = "profil" }: { initialSection?: DashSection }) {
  const router = useRouter();
  const [section, setSection] = useState<DashSection>(initialSection);
  const [loading, setLoading] = useState(true);

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<ProfileRole[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAvailable, setEditAvailable] = useState(false);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editRoleInput, setEditRoleInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Projects state
  const [projects, setProjects] = useState<ProjectWithCredits[]>([]);
  const [addingProject, setAddingProject] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<ProjectCategory>("court-metrage");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOwnerRole, setNewOwnerRole] = useState("");

  // Contacts state
  const [contacts, setContacts] = useState<ContactRequest[]>([]);

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

  const fetchContacts = useCallback(async () => {
    const res = await fetch("/api/dashboard/contacts");
    if (res.ok) {
      const data = await res.json();
      setContacts(data.contacts);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchProfile(), fetchProjects(), fetchContacts()]).finally(() =>
      setLoading(false)
    );
  }, [fetchProfile, fetchProjects, fetchContacts]);

  function startEditProfile() {
    if (!profile) return;
    setEditName(profile.full_name);
    setEditBio(profile.bio ?? "");
    setEditLocation(profile.location ?? "");
    setEditAvailable(profile.is_available);
    setEditRoles(roles.map((r) => r.role_name));
    setEditingProfile(true);
  }

  async function saveProfile() {
    setSaving(true);
    await fetch("/api/dashboard/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: editName,
        bio: editBio || null,
        location: editLocation || null,
        is_available: editAvailable,
        roles: editRoles,
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
    await fetch("/api/dashboard/projects", {
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

  async function updateContactStatus(id: string, status: "accepted" | "declined") {
    await fetch("/api/dashboard/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await fetchContacts();
  }

  const pendingContacts = contacts.filter((c) => c.status === "pending");
  const otherContacts = contacts.filter((c) => c.status !== "pending");

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
            <Link href="/rejoindre" className="px-6 py-3 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition">
              Creer mon profil
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="pb-16 lg:pb-0">
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-extrabold text-text-primary">Dashboard</h1>
          <StatusBadge status={profile.status} />
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1 mb-5">
          {(
            [
              { key: "profil", href: "/dashboard", label: "Mon profil" },
              { key: "projets", href: "/dashboard/projets", label: `Mes projets (${projects.length})` },
              { key: "contacts", href: "/dashboard/contacts", label: `Contacts (${pendingContacts.length})` },
            ] as const
          ).map(({ key, href, label }) => (
            <Link
              key={key}
              href={href}
              onClick={(e) => { e.preventDefault(); setSection(key); router.push(href); }}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                section === key
                  ? "bg-white/10 text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* PROFIL SECTION */}
        {section === "profil" && (
          <div>
            {editingProfile ? (
              <div className="bg-card border border-border rounded-xl p-6 space-y-5">
                <h2 className="text-lg font-bold text-text-primary mb-4">Editer mon profil</h2>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Nom complet</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Metiers</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editRoleInput}
                      onChange={(e) => setEditRoleInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEditRole(); } }}
                      className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition"
                      placeholder="Ajouter un metier..."
                    />
                    <button onClick={addEditRole} className="px-4 py-2.5 bg-background border border-border rounded-xl text-text-secondary hover:border-lime/50 hover:text-lime transition text-sm">+</button>
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

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Localisation</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Bio</label>
                  <textarea
                    rows={4}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition resize-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={editAvailable} onChange={(e) => setEditAvailable(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-teal transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
                  </label>
                  <span className="text-sm text-text-secondary">Disponible pour des projets</span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={saveProfile} disabled={saving} className="px-6 py-2.5 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition disabled:opacity-50">
                    {saving ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                  <button onClick={() => setEditingProfile(false)} className="px-6 py-2.5 border border-border-active text-text-secondary text-sm rounded-lg hover:text-text-primary transition">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-background border border-border overflow-hidden flex-shrink-0">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-text-tertiary">
                          {profile.full_name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-bold text-text-primary">{profile.full_name}</h2>
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
                  <button onClick={startEditProfile} className="px-4 py-2 border border-border-active text-text-secondary text-sm rounded-lg hover:border-border-hover hover:text-text-primary transition">
                    Editer
                  </button>
                </div>

                {profile.location && (
                  <p className="text-sm text-text-secondary mb-2">
                    <svg className="inline-block w-4 h-4 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {profile.location}
                  </p>
                )}

                {profile.bio && (
                  <p className="text-sm text-text-secondary leading-relaxed mt-3">{profile.bio}</p>
                )}

                {profile.status === "approved" && (
                  <Link
                    href={`/profil/${profile.slug}`}
                    className="inline-flex items-center gap-2 mt-4 text-xs text-lime hover:underline"
                  >
                    Voir mon profil public
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* PROJETS SECTION */}
        {section === "projets" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-text-secondary">
                {projects.length} / {MAX_PROJECTS_FREE} projets
              </p>
              {projects.length < MAX_PROJECTS_FREE && !addingProject && (
                <button
                  onClick={() => setAddingProject(true)}
                  className="px-4 py-2 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition"
                >
                  + Ajouter un projet
                </button>
              )}
            </div>

            {/* Add project form */}
            {addingProject && (
              <div className="bg-card border border-lime/30 rounded-xl p-6 mb-6 space-y-4">
                <h3 className="text-lg font-bold text-text-primary">Nouveau projet</h3>

                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Titre du projet"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                />

                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ProjectCategory)}
                    className="px-4 py-3 bg-background border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="px-4 py-3 bg-background border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-lime/50 transition"
                    min={1990} max={2030}
                  />
                </div>

                <input
                  type="url"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder="URL video (Vimeo ou YouTube)"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                />

                <input
                  type="text"
                  value={newOwnerRole}
                  onChange={(e) => setNewOwnerRole(e.target.value)}
                  placeholder="Ton role sur ce projet"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition"
                />

                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition resize-none"
                />

                <div className="flex gap-3">
                  <button
                    onClick={addProject}
                    disabled={!newTitle || !newVideoUrl || saving}
                    className="px-6 py-2.5 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition disabled:opacity-50"
                  >
                    {saving ? "Ajout..." : "Ajouter"}
                  </button>
                  <button
                    onClick={() => setAddingProject(false)}
                    className="px-6 py-2.5 border border-border-active text-text-secondary text-sm rounded-lg hover:text-text-primary transition"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Project list */}
            {projects.length === 0 && !addingProject ? (
              <div className="text-center py-12">
                <p className="text-text-tertiary text-sm mb-4">Aucun projet pour le moment.</p>
                <button
                  onClick={() => setAddingProject(true)}
                  className="px-6 py-3 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition"
                >
                  Ajouter mon premier projet
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => {
                  const catColor = CATEGORY_COLORS[project.category];
                  return (
                    <div key={project.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{
                              backgroundColor: catColor + "15",
                              color: catColor,
                              border: `1px solid ${catColor}30`,
                            }}
                          >
                            {CATEGORY_LABELS[project.category]}
                          </span>
                          <span className="text-xs font-mono text-text-tertiary">{project.year}</span>
                        </div>
                        <h3 className="text-sm font-bold text-text-primary truncate">{project.title}</h3>
                        <p className="text-xs text-text-tertiary mt-1">
                          {project.credits.length} credit{project.credits.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <Link
                          href={`/projet/${project.slug}`}
                          className="px-3 py-1.5 border border-border text-text-secondary text-xs rounded-lg hover:border-border-hover hover:text-text-primary transition"
                        >
                          Voir
                        </Link>
                        <button
                          onClick={() => deleteProject(project.id)}
                          className="px-3 py-1.5 border border-border text-text-tertiary text-xs rounded-lg hover:border-red-500/30 hover:text-red-400 transition"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CONTACTS SECTION */}
        {section === "contacts" && (
          <div>
            {contacts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-tertiary text-sm">Aucune demande de contact pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Pending */}
                {pendingContacts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                      En attente ({pendingContacts.length})
                    </h3>
                    <div className="space-y-3">
                      {pendingContacts.map((contact) => (
                        <ContactCard
                          key={contact.id}
                          contact={contact}
                          onAccept={() => updateContactStatus(contact.id, "accepted")}
                          onDecline={() => updateContactStatus(contact.id, "declined")}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Handled */}
                {otherContacts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                      Traitees ({otherContacts.length})
                    </h3>
                    <div className="space-y-3">
                      {otherContacts.map((contact) => (
                        <ContactCard key={contact.id} contact={contact} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* ---- Sub-components ---- */

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal/10 border border-teal/30 text-teal text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-teal" />
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

function ContactCard({
  contact,
  onAccept,
  onDecline,
}: {
  contact: ContactRequest;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const subjectLabels: Record<string, string> = {
    collaboration: "Collaboration",
    project: "Projet",
    question: "Question",
    other: "Autre",
  };

  const date = new Date(contact.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-text-primary">{contact.from_name}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-text-tertiary">
              {subjectLabels[contact.subject] ?? contact.subject}
            </span>
          </div>
          <p className="text-xs text-text-tertiary">{contact.from_email} — {date}</p>
        </div>

        {contact.status !== "pending" && (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              contact.status === "accepted"
                ? "bg-teal/10 text-teal border border-teal/30"
                : "bg-red-500/10 text-red-400 border border-red-500/30"
            }`}
          >
            {contact.status === "accepted" ? "Acceptee" : "Refusee"}
          </span>
        )}
      </div>

      <p className="text-sm text-text-secondary leading-relaxed">{contact.message}</p>

      {contact.status === "pending" && onAccept && onDecline && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={onAccept}
            className="px-4 py-2 bg-lime text-[#0d0d0d] font-bold text-xs rounded-lg hover:brightness-110 transition"
          >
            Accepter
          </button>
          <button
            onClick={onDecline}
            className="px-4 py-2 border border-border-active text-text-secondary text-xs rounded-lg hover:border-red-500/30 hover:text-red-400 transition"
          >
            Refuser
          </button>
        </div>
      )}
    </div>
  );
}
