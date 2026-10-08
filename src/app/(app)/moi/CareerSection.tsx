"use client";
// Parcours du profil : experiences declarees, texte uniquement
// (/api/dashboard/career). Distinct des films publies.
import { useCallback, useEffect, useState } from "react";
import { CAREER_KINDS, MAX_CAREER_ENTRIES } from "@/lib/constants";
import type { CareerEntry, CareerKind } from "@/types/database";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import { Note, SectionLabel } from "./parts";
import { callApi, type ShowToast } from "./api";

const ENDPOINT = "/api/dashboard/career";
const EMPTY = { title: "", role: "", year: String(new Date().getFullYear()), kind: "court-metrage" as CareerKind, production: "" };

export default function CareerSection({ showToast }: { showToast: ShowToast }) {
  const [entries, setEntries] = useState<CareerEntry[] | null>(null);
  // null : formulaire ferme ; "new" : ajout ; sinon id de l'entree modifiee.
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      callApi<{ entries?: CareerEntry[] }>(ENDPOINT).then((r) => {
        setEntries(r.ok ? r.data.entries ?? [] : []);
      }),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  function open(entry?: CareerEntry) {
    setError("");
    setEditing(entry ? entry.id : "new");
    setForm(
      entry
        ? { title: entry.title, role: entry.role, year: String(entry.year), kind: entry.kind, production: entry.production ?? "" }
        : EMPTY
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    const fields = { ...form, year: Number(form.year), production: form.production.trim() || null };
    const r = editing === "new"
      ? await callApi(ENDPOINT, "POST", fields)
      : await callApi(ENDPOINT, "PATCH", { id: editing, ...fields });
    setSaving(false);
    // Le message du serveur couvre contact_refused, link_refused et career_limit_reached.
    if (!r.ok) {
      setError(r.error);
      return;
    }
    showToast(editing === "new" ? "Expérience ajoutée" : "Expérience mise à jour");
    setEditing(null);
    await load();
  }

  async function remove(entry: CareerEntry) {
    if (!confirm(`Supprimer « ${entry.title} » de ton Parcours ?`)) return;
    const r = await callApi(`${ENDPOINT}?id=${entry.id}`, "DELETE");
    if (!r.ok) showToast(r.error);
    await load();
  }

  const count = entries?.length ?? 0;
  const full = count >= MAX_CAREER_ENTRIES;

  return (
    <>
      <div className="flex w-full items-center justify-between gap-3">
        <SectionLabel>Parcours</SectionLabel>
        {entries && <p className="text-xs text-text-secondary">{count} sur {MAX_CAREER_ENTRIES}</p>}
      </div>
      <p className="text-xs leading-relaxed text-text-secondary">
        Tes expériences déclarées, sans vidéo : elles sont visibles sur ton profil public.
      </p>

      {entries === null && <p className="text-xs text-text-secondary">Chargement...</p>}
      {entries?.length === 0 && editing === null && (
        <p className="text-[13px] text-text-secondary">Aucune expérience pour le moment.</p>
      )}

      {entries && entries.length > 0 && (
        <ul className="flex w-full flex-col divide-y divide-white/10">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold text-text-primary">{entry.title}</p>
                <p className="mt-0.5 break-words text-xs leading-relaxed text-text-secondary">
                  {[
                    entry.role,
                    CAREER_KINDS.find((k) => k.value === entry.kind)?.label,
                    entry.year,
                    entry.production,
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button variant="glass" size="sm" onClick={() => open(entry)} className="shrink-0 px-3!">
                Modifier
              </Button>
              <Button variant="icon" size="sm" aria-label={`Supprimer ${entry.title}`} onClick={() => remove(entry)} className="shrink-0 text-text-secondary!">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <div className="flex w-full flex-col gap-3 border-t border-white/10 pt-4">
          <h3 className="text-[15px] font-semibold text-text-primary">
            {editing === "new" ? "Nouvelle expérience" : "Modifier l'expérience"}
          </h3>
          <Field label="Titre de l'œuvre" type="text" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Field label="Ton rôle" type="text" maxLength={80} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CareerKind })}>
              {CAREER_KINDS.map((k) => (<option key={k.value} value={k.value}>{k.label}</option>))}
            </Select>
            <Field label="Année" type="number" min={1900} max={2100} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </div>
          <Field label="Production (facultatif)" type="text" maxLength={120} value={form.production} onChange={(e) => setForm({ ...form, production: e.target.value })} />
          {error && <Note>{error}</Note>}
          <div className="flex gap-3">
            <Button onClick={save} disabled={!form.title.trim() || !form.role.trim() || !form.year || saving} className="flex-1">
              {saving ? "..." : "Enregistrer"}
            </Button>
            <Button variant="glass" onClick={() => setEditing(null)} className="flex-1">
              Annuler
            </Button>
          </div>
        </div>
      )}

      {editing === null && entries && (
        <>
          <Button variant="dashed" size="sm" onClick={() => open()} disabled={full}>
            + Ajouter une expérience
          </Button>
          {full && (
            <p className="text-xs leading-relaxed text-text-secondary">
              Tu as atteint le maximum de {MAX_CAREER_ENTRIES} expériences. Supprimes-en une pour en ajouter une autre.
            </p>
          )}
        </>
      )}
    </>
  );
}
