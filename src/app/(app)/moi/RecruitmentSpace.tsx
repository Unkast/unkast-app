"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/Avatar";

/* ---------- types ---------- */

interface Candidate {
  talent_id: string;
  role: string;
  expires_at?: string;
  full_name: string;
  slug: string | null;
  avatar_url: string | null;
  location: string | null;
  folders: string[];
}
interface RoleGroup {
  role: string;
  candidates: Candidate[];
}
interface Folder {
  id: string;
  name: string;
  created_at: string;
  count: number;
}
interface FolderDetail {
  folder: { id: string; name: string };
  roles: { role: string; candidates: Candidate[] }[];
}

interface Props {
  showToast: (msg: string) => void;
}

/* ---------- helpers ---------- */

// Style local conservé (bordure blanche discrète, fond plein) pour ne pas
// changer le rendu existant de l'espace recrutement.
const recruitAvatarStyle = { background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" } as const;

/* ========================================================================== */

export default function RecruitmentSpace({ showToast }: Props) {
  const router = useRouter();
  const [view, setView] = useState<"candidates" | "folders">("candidates");

  const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const [dispatchKey, setDispatchKey] = useState<string | null>(null); // "talent_id|role"
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const [openFolder, setOpenFolder] = useState<FolderDetail | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [contactingId, setContactingId] = useState<string | null>(null);

  // Undo de l'ecartement.
  const [undo, setUndo] = useState<Candidate | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- fetch ---------- */

  const fetchCandidates = useCallback(async () => {
    const res = await fetch("/api/recruitment/candidates");
    if (res.ok) {
      const data = await res.json();
      setRoleGroups(data.roles || []);
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    const res = await fetch("/api/recruitment/folders");
    if (res.ok) {
      const data = await res.json();
      setFolders(data.folders || []);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchCandidates(), fetchFolders()]).finally(() => setLoading(false));
  }, [fetchCandidates, fetchFolders]);

  /* ---------- dispatch (ranger / retirer) ---------- */

  async function toggleDispatch(c: Candidate, folderId: string) {
    const isIn = c.folders.includes(folderId);
    const method = isIn ? "DELETE" : "POST";
    const res = await fetch("/api/recruitment/dispatch", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId, talent_id: c.talent_id, role: c.role }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showToast(d.error || "Erreur");
      return;
    }
    // MAJ optimiste de l'appartenance + compteurs.
    setRoleGroups((prev) =>
      prev.map((g) => ({
        ...g,
        candidates: g.candidates.map((x) =>
          x.talent_id === c.talent_id && x.role === c.role
            ? { ...x, folders: isIn ? x.folders.filter((f) => f !== folderId) : [...x.folders, folderId] }
            : x
        ),
      }))
    );
    fetchFolders();
  }

  /* ---------- ecarter (avec undo) ---------- */

  async function dismiss(c: Candidate) {
    // Optimiste : on retire de la liste tout de suite.
    setRoleGroups((prev) =>
      prev.map((g) => ({ ...g, candidates: g.candidates.filter((x) => !(x.talent_id === c.talent_id && x.role === c.role)) }))
    );
    const res = await fetch("/api/recruitment/dismissals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ talent_id: c.talent_id, role: c.role }),
    });
    if (!res.ok) {
      // rollback
      fetchCandidates();
      const d = await res.json().catch(() => ({}));
      showToast(d.error || "Erreur");
      return;
    }
    setUndo(c);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  }

  async function cancelDismiss() {
    if (!undo) return;
    const c = undo;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await fetch("/api/recruitment/dismissals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ talent_id: c.talent_id, role: c.role }),
    });
    fetchCandidates();
  }

  /* ---------- dossiers ---------- */

  async function createFolder(name: string): Promise<string | null> {
    const clean = name.trim();
    if (!clean) return null;
    setCreating(true);
    try {
      const res = await fetch("/api/recruitment/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json();
      if (res.ok && data.folder) {
        await fetchFolders();
        return data.folder.id as string;
      }
      showToast(data.error || "Erreur");
      return null;
    } finally {
      setCreating(false);
    }
  }

  async function renameFolder(id: string) {
    const clean = renameValue.trim();
    if (!clean) return;
    await fetch("/api/recruitment/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: clean }),
    });
    setRenamingId(null);
    setRenameValue("");
    await fetchFolders();
    if (openFolder?.folder.id === id) setOpenFolder({ ...openFolder, folder: { ...openFolder.folder, name: clean } });
    showToast("Dossier renommé");
  }

  async function deleteFolder(id: string) {
    if (!confirm("Supprimer ce dossier ? Les rangements seront perdus (les candidats restent dans tes candidatures).")) return;
    await fetch(`/api/recruitment/folders?id=${id}`, { method: "DELETE" });
    if (openFolder?.folder.id === id) setOpenFolder(null);
    await Promise.all([fetchFolders(), fetchCandidates()]);
    showToast("Dossier supprimé");
  }

  async function openFolderDetail(id: string) {
    const res = await fetch(`/api/recruitment/folders/${id}`);
    if (res.ok) setOpenFolder(await res.json());
  }

  async function removeFromFolder(folderId: string, c: Candidate) {
    await fetch("/api/recruitment/dispatch", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId, talent_id: c.talent_id, role: c.role }),
    });
    await Promise.all([openFolderDetail(folderId), fetchFolders(), fetchCandidates()]);
  }

  /* ---------- contacter ---------- */

  async function contact(talentId: string) {
    setContactingId(talentId);
    try {
      const res = await fetch("/api/messages/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: talentId }),
      });
      const data = await res.json();
      if (res.ok && data.conversation_id) {
        router.push(`/messages/${data.conversation_id}`);
      } else {
        showToast(data.error || "Erreur");
      }
    } catch {
      showToast("Erreur réseau");
    } finally {
      setContactingId(null);
    }
  }

  /* ============================== RENDER ============================== */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#C8FF00]/30 border-t-[#C8FF00] rounded-full animate-spin" />
      </div>
    );
  }

  const totalCandidates = roleGroups.reduce((n, g) => n + g.candidates.length, 0);

  return (
    <div style={{ marginTop: 16 }}>
      {/* Segmented control */}
      <div style={{ display: "inline-flex", gap: 0, padding: 3, background: "rgba(255,255,255,0.04)", borderRadius: 10, marginBottom: 20 }}>
        {([
          { key: "candidates", label: `Candidatures${totalCandidates ? ` (${totalCandidates})` : ""}` },
          { key: "folders", label: `Dossiers${folders.length ? ` (${folders.length})` : ""}` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setView(key); setOpenFolder(null); }}
            style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer", background: view === key ? "#C8FF00" : "transparent", color: view === key ? "#0d0d0d" : "#888" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ===================== VUE CANDIDATURES ===================== */}
      {view === "candidates" && (
        <div>
          {totalCandidates === 0 ? (
            <div style={{ border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 12, padding: "28px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "#888", margin: 0, marginBottom: 4 }}>Aucune candidature pour le moment.</p>
              <p style={{ fontSize: 12, color: "#555", margin: 0 }}>Les talents qui se signalent « Disponible » sur ton profil apparaissent ici, par poste.</p>
            </div>
          ) : (
            roleGroups.map((g) => (
              <div key={g.role} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>{g.role}</h3>
                  <span style={{ fontSize: 12, color: "#555" }}>{g.candidates.length}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.candidates.map((c) => {
                    const key = `${c.talent_id}|${c.role}`;
                    const menuOpen = dispatchKey === key;
                    return (
                      <div key={key} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Avatar url={c.avatar_url} name={c.full_name} style={recruitAvatarStyle} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {c.slug ? (
                              <Link href={`/profil/${c.slug}`} style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", textDecoration: "none" }}>{c.full_name}</Link>
                            ) : (
                              <span style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0" }}>{c.full_name}</span>
                            )}
                            {c.location && <p style={{ fontSize: 11, color: "#555", margin: 0, marginTop: 2 }}>{c.location}</p>}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button
                            onClick={() => setDispatchKey(menuOpen ? null : key)}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", background: c.folders.length ? "rgba(200,255,0,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${c.folders.length ? "rgba(200,255,0,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, color: c.folders.length ? "#C8FF00" : "#aaa", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                          >
                            {c.folders.length ? `Rangé (${c.folders.length})` : "Ranger"}
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                          </button>
                          <button
                            onClick={() => dismiss(c)}
                            style={{ padding: "7px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#888", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                          >
                            Écarter
                          </button>
                        </div>

                        {/* Menu de rangement */}
                        {menuOpen && (
                          <div style={{ marginTop: 10, padding: 12, background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
                            <p style={{ fontSize: 11, color: "#555", margin: 0, marginBottom: 8, fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ranger dans…</p>
                            {folders.length === 0 && <p style={{ fontSize: 12, color: "#666", margin: "0 0 10px" }}>Aucun dossier. Crée-en un :</p>}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                              {folders.map((f) => {
                                const inFolder = c.folders.includes(f.id);
                                return (
                                  <button key={f.id} onClick={() => toggleDispatch(c, f.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderRadius: 6 }}>
                                    <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${inFolder ? "#C8FF00" : "#444"}`, background: inFolder ? "#C8FF00" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      {inFolder && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0d0d0d" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                                    </span>
                                    <span style={{ fontSize: 13, color: "#f0f0f0" }}>{f.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <input
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Nouveau dossier (ex. Film A)"
                                style={{ flex: 1, padding: "8px 10px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#f0f0f0", fontSize: 13, outline: "none" }}
                              />
                              <button
                                disabled={creating || !newFolderName.trim()}
                                onClick={async () => {
                                  const id = await createFolder(newFolderName);
                                  if (id) { setNewFolderName(""); await toggleDispatch(c, id); }
                                }}
                                style={{ padding: "8px 12px", background: "#C8FF00", color: "#0d0d0d", fontSize: 12.5, fontWeight: 600, border: "none", borderRadius: 8, cursor: "pointer", opacity: creating || !newFolderName.trim() ? 0.5 : 1 }}
                              >
                                Créer + ranger
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===================== VUE DOSSIERS ===================== */}
      {view === "folders" && !openFolder && (
        <div>
          {/* Création */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nouveau dossier-film (ex. Film A)"
              style={{ flex: 1, padding: "10px 12px", background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f0", fontSize: 14, outline: "none" }}
            />
            <button
              disabled={creating || !newFolderName.trim()}
              onClick={async () => { const id = await createFolder(newFolderName); if (id) setNewFolderName(""); }}
              style={{ padding: "10px 16px", background: "#C8FF00", color: "#0d0d0d", fontSize: 14, fontWeight: 600, border: "none", borderRadius: 10, cursor: "pointer", opacity: creating || !newFolderName.trim() ? 0.5 : 1 }}
            >
              + Créer
            </button>
          </div>

          {folders.length === 0 ? (
            <div style={{ border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Crée un dossier par film en préparation pour y ranger tes candidats. Ces dossiers sont privés — invisibles des talents.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {folders.map((f) => (
                <div key={f.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
                  {renamingId === f.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") renameFolder(f.id); }}
                      style={{ flex: 1, padding: "6px 10px", background: "#0d0d0d", border: "1px solid rgba(200,255,0,0.4)", borderRadius: 8, color: "#f0f0f0", fontSize: 14, outline: "none" }}
                    />
                  ) : (
                    <button onClick={() => openFolderDetail(f.id)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", textAlign: "left", minWidth: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                        <p style={{ fontSize: 11, color: "#555", margin: 0, marginTop: 2 }}>{f.count} candidat{f.count > 1 ? "s" : ""}</p>
                      </div>
                    </button>
                  )}

                  {renamingId === f.id ? (
                    <>
                      <button onClick={() => renameFolder(f.id)} style={{ background: "none", border: "none", color: "#C8FF00", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>OK</button>
                      <button onClick={() => { setRenamingId(null); setRenameValue(""); }} style={{ background: "none", border: "none", color: "#666", fontSize: 13, cursor: "pointer" }}>Annuler</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setRenamingId(f.id); setRenameValue(f.name); }} title="Renommer" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button onClick={() => deleteFolder(f.id)} title="Supprimer" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== DÉTAIL D'UN DOSSIER ===================== */}
      {view === "folders" && openFolder && (
        <div>
          <button onClick={() => setOpenFolder(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#888", fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Tous les dossiers
          </button>

          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0", margin: 0, marginBottom: 4 }}>{openFolder.folder.name}</h3>
          <p style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>Ton casting idéal pour ce film, par poste.</p>

          {openFolder.roles.length === 0 ? (
            <p style={{ fontSize: 13, color: "#555" }}>Aucun candidat rangé dans ce dossier. Va dans « Candidatures » pour en ajouter.</p>
          ) : (
            openFolder.roles.map((g) => (
              <div key={g.role} style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f0", margin: 0, marginBottom: 8 }}>{g.role}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.candidates.map((c) => (
                    <div key={`${c.talent_id}|${c.role}`} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar url={c.avatar_url} name={c.full_name} size={36} style={recruitAvatarStyle} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {c.slug ? (
                          <Link href={`/profil/${c.slug}`} style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", textDecoration: "none" }}>{c.full_name}</Link>
                        ) : (
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0" }}>{c.full_name}</span>
                        )}
                        {c.location && <p style={{ fontSize: 11, color: "#555", margin: 0, marginTop: 2 }}>{c.location}</p>}
                      </div>
                      <button
                        onClick={() => contact(c.talent_id)}
                        disabled={contactingId === c.talent_id}
                        style={{ padding: "7px 12px", background: "#C8FF00", color: "#0d0d0d", fontSize: 12.5, fontWeight: 600, border: "none", borderRadius: 8, cursor: "pointer", opacity: contactingId === c.talent_id ? 0.5 : 1 }}
                      >
                        {contactingId === c.talent_id ? "…" : "Contacter"}
                      </button>
                      <button onClick={() => removeFromFolder(openFolder.folder.id, c)} title="Retirer du dossier" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Toast undo écartement */}
      {undo && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", zIndex: 60, display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
          <span style={{ fontSize: 13, color: "#f0f0f0" }}>{undo.full_name} écarté</span>
          <button onClick={cancelDismiss} style={{ background: "none", border: "none", color: "#C8FF00", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
        </div>
      )}
    </div>
  );
}
