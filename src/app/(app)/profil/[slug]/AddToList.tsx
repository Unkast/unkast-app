"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";

// « Ajouter à une liste » : range ce talent, sans poste (role null), dans les
// dossiers prives du visiteur. Affiche seulement pour un Pro createur ou
// recruteur (ProfileClient) ; /api/recruitment/* refait la verification.
// Le talent n'en sait rien : aucune lecture cote talent (RLS).

type Folder = { id: string; name: string };

export default function AddToList({ talentId }: { talentId: string }) {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [inFolders, setInFolders] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/recruitment/folders?talent_id=${encodeURIComponent(talentId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Listes indisponibles.");
      setFolders([]);
      return;
    }
    setFolders(data.folders ?? []);
    setInFolders(data.talent_folders ?? []);
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    setError("");
    if (next) load();
  }

  async function toggle(folderId: string) {
    const isIn = inFolders.includes(folderId);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/recruitment/dispatch", {
        method: isIn ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId, talent_id: talentId, role: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur");
        return;
      }
      setInFolders((prev) => (isIn ? prev.filter((id) => id !== folderId) : [...prev, folderId]));
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    let folder: Folder | null = null;
    try {
      const res = await fetch("/api/recruitment/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.folder) {
        setError(data.error || "Erreur");
        return;
      }
      folder = data.folder as Folder;
      setFolders((prev) => [...(prev ?? []), folder as Folder]);
      setNewName("");
    } finally {
      setBusy(false);
    }
    if (folder) await toggle(folder.id);
  }

  return (
    <>
      <Button variant="glass" onClick={toggleOpen} aria-expanded={open} className={inFolders.length ? "border-lime/40! text-lime!" : ""}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
        {inFolders.length ? `Dans ${inFolders.length} liste${inFolders.length > 1 ? "s" : ""}` : "Ajouter à une liste"}
      </Button>

      {open && (
        <div className="w-full max-w-md rounded-card border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Mes listes privées</p>
          {folders === null ? (
            <p className="mb-2.5 text-xs text-text-secondary">Chargement…</p>
          ) : (
            <>
              {folders.length === 0 && <p className="mb-2.5 text-xs text-text-secondary">Aucune liste. Crée la première :</p>}
              <div className="mb-2.5 flex flex-col">
                {folders.map((f) => {
                  const checked = inFolders.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      disabled={busy}
                      onClick={() => toggle(f.id)}
                      className="flex min-h-11 items-center gap-2.5 rounded-media px-2 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-60"
                    >
                      <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] ${checked ? "border-lime bg-lime text-canvas" : "border-white/30"}`}>
                        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>}
                      </span>
                      <span className="text-[13px] text-text-primary">{f.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Field
                  aria-label="Nouvelle liste"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createAndAdd(); }}
                  placeholder="Nouvelle liste (ex. Film A)"
                  className="min-w-40 flex-1"
                />
                <Button disabled={busy || !newName.trim()} onClick={createAndAdd} className="shrink-0">
                  Créer et ajouter
                </Button>
              </div>
            </>
          )}
          {error && <p role="alert" className="mt-2 text-xs text-orange-400">{error}</p>}
          <p className="mt-2.5 text-[11px] leading-snug text-text-tertiary">
            Personne d&apos;autre ne voit tes listes. Tu peux y ajouter une remarque dans Mon profil, onglet Recrutement.
          </p>
        </div>
      )}
    </>
  );
}
