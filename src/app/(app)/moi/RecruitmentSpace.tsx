"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import Avatar from "@/components/Avatar";
import { EnterList, EnterItem } from "@/components/motion";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Field from "@/components/ui/Field";
import { SectionLabel, ListSkeleton } from "./parts";

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

// Avatar des candidats : bordure blanche discrete sur fond translucide (verre).
const recruitAvatarStyle = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" } as const;

const nameCls = "text-sm font-semibold text-text-primary";
const metaCls = "mt-0.5 text-xs text-text-secondary";

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

  if (loading) return <ListSkeleton />;

  const totalCandidates = roleGroups.reduce((n, g) => n + g.candidates.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Segmented control */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
        {([
          { key: "candidates", label: `Candidatures${totalCandidates ? ` (${totalCandidates})` : ""}` },
          { key: "folders", label: `Dossiers${folders.length ? ` (${folders.length})` : ""}` },
        ] as const).map(({ key, label }) => (
          <Chip key={key} selected={view === key} onClick={() => { setView(key); setOpenFolder(null); }}>
            {label}
          </Chip>
        ))}
      </div>

      {/* ===================== VUE CANDIDATURES ===================== */}
      {view === "candidates" && (
        <EnterList className="flex flex-col gap-6">
          {totalCandidates === 0 ? (
            <EnterItem className="glass rounded-panel border-dashed px-4 py-7 text-center">
              <p className="text-sm text-text-primary">Aucune candidature pour le moment.</p>
              <p className="mt-1 text-xs text-text-secondary">Les talents qui se signalent « Disponible » sur ton profil apparaissent ici, par poste.</p>
            </EnterItem>
          ) : (
            roleGroups.map((g) => (
              <div key={g.role}>
                <div className="mb-2.5 flex items-center gap-2 px-1">
                  <h3 className="text-[15px] font-semibold text-text-primary">{g.role}</h3>
                  <span className="text-xs text-text-secondary">{g.candidates.length}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {g.candidates.map((c) => {
                    const key = `${c.talent_id}|${c.role}`;
                    const menuOpen = dispatchKey === key;
                    return (
                      <EnterItem key={key} className="glass rounded-card p-3">
                        <div className="flex items-center gap-3">
                          <Avatar url={c.avatar_url} name={c.full_name} style={recruitAvatarStyle} />
                          <div className="min-w-0 flex-1">
                            {c.slug ? (
                              <Link href={`/profil/${c.slug}`} className={nameCls}>{c.full_name}</Link>
                            ) : (
                              <span className={nameCls}>{c.full_name}</span>
                            )}
                            {c.location && <p className={metaCls}>{c.location}</p>}
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="glass"
                            size="sm"
                            aria-expanded={menuOpen}
                            onClick={() => setDispatchKey(menuOpen ? null : key)}
                            className={c.folders.length ? "border-lime/40! text-lime!" : ""}
                          >
                            {c.folders.length ? `Rangé (${c.folders.length})` : "Ranger"}
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                          </Button>
                          <Button variant="glass" size="sm" onClick={() => dismiss(c)} className="font-medium! text-text-secondary!">
                            Écarter
                          </Button>
                        </div>

                        {/* Menu de rangement */}
                        {menuOpen && (
                          <div className="mt-3 rounded-card border border-white/10 bg-white/5 p-3">
                            <SectionLabel className="mb-2">Ranger dans…</SectionLabel>
                            {folders.length === 0 && <p className="mb-2.5 text-xs text-text-secondary">Aucun dossier. Crée-en un :</p>}
                            <div className="mb-2.5 flex flex-col">
                              {folders.map((f) => {
                                const inFolder = c.folders.includes(f.id);
                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={inFolder}
                                    onClick={() => toggleDispatch(c, f.id)}
                                    className="flex min-h-11 items-center gap-2.5 rounded-media px-2 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-lime"
                                  >
                                    <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] ${inFolder ? "border-lime bg-lime text-canvas" : "border-white/30"}`}>
                                      {inFolder && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>}
                                    </span>
                                    <span className="text-[13px] text-text-primary">{f.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Field
                                aria-label="Nouveau dossier"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Nouveau dossier (ex. Film A)"
                                className="min-w-40 flex-1"
                              />
                              <Button
                                disabled={creating || !newFolderName.trim()}
                                onClick={async () => {
                                  const id = await createFolder(newFolderName);
                                  if (id) { setNewFolderName(""); await toggleDispatch(c, id); }
                                }}
                                className="shrink-0"
                              >
                                Créer + ranger
                              </Button>
                            </div>
                          </div>
                        )}
                      </EnterItem>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </EnterList>
      )}

      {/* ===================== VUE DOSSIERS ===================== */}
      {view === "folders" && !openFolder && (
        <EnterList className="flex flex-col gap-2">
          {/* Création */}
          <EnterItem className="mb-2 flex gap-2">
            <Field
              aria-label="Nouveau dossier-film"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nouveau dossier-film (ex. Film A)"
              className="min-w-0 flex-1"
            />
            <Button
              disabled={creating || !newFolderName.trim()}
              onClick={async () => { const id = await createFolder(newFolderName); if (id) setNewFolderName(""); }}
              className="shrink-0"
            >
              + Créer
            </Button>
          </EnterItem>

          {folders.length === 0 ? (
            <EnterItem className="glass rounded-panel border-dashed px-4 py-6 text-center">
              <p className="text-[13px] leading-relaxed text-text-secondary">Crée un dossier par film en préparation pour y ranger tes candidats. Ces dossiers sont privés, invisibles des talents.</p>
            </EnterItem>
          ) : (
            folders.map((f) => (
              <EnterItem key={f.id} className="glass flex items-center gap-2 rounded-card p-3">
                {renamingId === f.id ? (
                  <Field
                    autoFocus
                    aria-label="Nom du dossier"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") renameFolder(f.id); }}
                    className="min-w-0 flex-1"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => openFolderDetail(f.id)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-media text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-media border border-lime/30 bg-lime/15 text-lime">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{f.name}</p>
                      <p className={metaCls}>{f.count} candidat{f.count > 1 ? "s" : ""}</p>
                    </div>
                  </button>
                )}

                {renamingId === f.id ? (
                  <>
                    <Button size="sm" onClick={() => renameFolder(f.id)} className="shrink-0 px-3!">OK</Button>
                    <Button variant="glass" size="sm" onClick={() => { setRenamingId(null); setRenameValue(""); }} className="shrink-0 px-3!">Annuler</Button>
                  </>
                ) : (
                  <>
                    <Button variant="icon" size="sm" aria-label="Renommer" title="Renommer" onClick={() => { setRenamingId(f.id); setRenameValue(f.name); }} className="shrink-0 text-text-secondary!">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </Button>
                    <Button variant="icon" size="sm" aria-label="Supprimer" title="Supprimer" onClick={() => deleteFolder(f.id)} className="shrink-0 text-text-secondary!">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                    </Button>
                  </>
                )}
              </EnterItem>
            ))
          )}
        </EnterList>
      )}

      {/* ===================== DÉTAIL D'UN DOSSIER ===================== */}
      {view === "folders" && openFolder && (
        <EnterList className="flex flex-col gap-5">
          <EnterItem className="flex flex-col items-start gap-3">
            <Button variant="glass" size="sm" onClick={() => setOpenFolder(null)} className="pl-3!">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              Tous les dossiers
            </Button>
            <div className="px-1">
              <h3 className="text-sheen break-words text-2xl font-semibold">{openFolder.folder.name}</h3>
              <p className="mt-1 text-xs text-text-secondary">Ton casting idéal pour ce film, par poste.</p>
            </div>
          </EnterItem>

          {openFolder.roles.length === 0 ? (
            <EnterItem className="px-1">
              <p className="text-[13px] text-text-secondary">Aucun candidat rangé dans ce dossier. Va dans « Candidatures » pour en ajouter.</p>
            </EnterItem>
          ) : (
            openFolder.roles.map((g) => (
              <div key={g.role}>
                <p className="mb-2 px-1 text-[13px] font-semibold text-text-primary">{g.role}</p>
                <div className="flex flex-col gap-2">
                  {g.candidates.map((c) => (
                    <EnterItem key={`${c.talent_id}|${c.role}`} className="glass flex items-center gap-3 rounded-card p-3">
                      <Avatar url={c.avatar_url} name={c.full_name} size={36} style={recruitAvatarStyle} />
                      <div className="min-w-0 flex-1">
                        {c.slug ? (
                          <Link href={`/profil/${c.slug}`} className={nameCls}>{c.full_name}</Link>
                        ) : (
                          <span className={nameCls}>{c.full_name}</span>
                        )}
                        {c.location && <p className={metaCls}>{c.location}</p>}
                      </div>
                      <Button size="sm" onClick={() => contact(c.talent_id)} disabled={contactingId === c.talent_id} className="shrink-0 px-3!">
                        {contactingId === c.talent_id ? "…" : "Contacter"}
                      </Button>
                      <Button variant="icon" size="sm" aria-label="Retirer du dossier" title="Retirer du dossier" onClick={() => removeFromFolder(openFolder.folder.id, c)} className="shrink-0 text-text-secondary!">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </Button>
                    </EnterItem>
                  ))}
                </div>
              </div>
            ))
          )}
        </EnterList>
      )}

      {/* Toast undo écartement. Porte dans <body> : un ancetre en verre ou en cours
          d'animation deviendrait sinon son bloc conteneur. Pose 12 px au-dessus de la
          navigation mobile : barre plate (56 px) en navigateur, dock (88 px) dans l'app
          installee, rien en desktop. */}
      {undo && createPortal(
        <div
          role="status"
          className="glass-strong fixed left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-pill bg-glass-solid/80 py-1.5 pl-5 pr-1.5 shadow-2xl shadow-black/50 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] max-lg:[.app-installed_&]:bottom-[calc(100px+env(safe-area-inset-bottom,0px))] lg:bottom-6"
        >
          <span className="truncate text-[13px] text-text-primary">{undo.full_name} écarté</span>
          <Button variant="glass" size="sm" onClick={cancelDismiss} className="shrink-0 text-lime!">
            Annuler
          </Button>
        </div>,
        document.body
      )}
    </div>
  );
}
