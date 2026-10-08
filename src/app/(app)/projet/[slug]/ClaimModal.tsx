"use client";

import { useState } from "react";
import { ModalBackdrop } from "@/components/motion";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import type { ProjectClaimKind } from "@/types/database";

// Mêmes règles que POST /api/projects/[id]/claims (la route fait foi).
const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 4 * 1024 * 1024;
const MAX_MESSAGE = 2000;

const CHOICES: { kind: ProjectClaimKind; title: string; text: string }[] = [
  { kind: "report", title: "Signaler un problème de droits", text: "Ce film est en ligne sans l'accord de ses ayants droit." },
  { kind: "claim", title: "Revendiquer ce film", text: "Tu en détiens les droits. L'équipe Unkast étudie ta demande." },
];

// Signalement de droits ou revendication d'un film, traité par l'équipe Unkast.
// Distinct de ReportModal (contenu : spam, faux profil, contenu inapproprié...).
export default function ClaimModal({
  open,
  onClose,
  projectId,
  projectTitle,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  onSent: () => void;
}) {
  const [kind, setKind] = useState<ProjectClaimKind | null>(null);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const fileRequired = kind === "claim";
  const canSend = Boolean(kind && message.trim() && (!fileRequired || file)) && !sending;

  function pickFile(picked: File | null) {
    setError("");
    if (picked && !FILE_TYPES.includes(picked.type)) {
      setFile(null);
      setError("Format non supporté (PDF, JPEG, PNG ou WebP uniquement).");
      return;
    }
    if (picked && picked.size > MAX_SIZE) {
      setFile(null);
      setError("Fichier trop volumineux (4 Mo maximum).");
      return;
    }
    setFile(picked);
  }

  async function submit() {
    if (!kind || !canSend) return;
    setSending(true);
    setError("");
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("message", message.trim());
      if (file) body.set("file", file);
      // Multipart : pas de Content-Type manuel, le navigateur pose la frontière.
      const res = await fetch(`/api/projects/${projectId}/claims`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (res.ok || data.code === "already_pending") {
        setKind(null);
        setMessage("");
        setFile(null);
        onSent();
      } else {
        setError(data.error || "Erreur lors de l'envoi de la demande.");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  return (
    <ModalBackdrop open={open} onClose={onClose}>
      <div className="p-5 sm:p-6">
        <h3 className="mb-1 text-lg font-bold text-text-primary">Signaler ou revendiquer ce film</h3>
        <p className="mb-5 text-sm text-text-secondary break-words">{projectTitle}</p>

        <div role="radiogroup" aria-label="Type de demande" className="mb-4 flex flex-col gap-2">
          {CHOICES.map((c) => {
            const selected = kind === c.kind;
            return (
              <button
                key={c.kind}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => { setKind(c.kind); setError(""); }}
                className={`rounded-card border px-4 py-3 text-left transition-colors duration-fast ${selected ? "border-lime/40 bg-lime/[0.06]" : "border-white/10 bg-white/5 hover:border-white/20"}`}
              >
                <span className="block text-sm font-semibold text-text-primary">{c.title}</span>
                <span className="mt-0.5 block text-xs text-text-secondary">{c.text}</span>
              </button>
            );
          })}
        </div>

        {kind && (
          <div className="space-y-4">
            <Field
              multiline
              rows={4}
              maxLength={MAX_MESSAGE}
              label={<>Message * <span className="text-text-tertiary">({message.length}/{MAX_MESSAGE})</span></>}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={kind === "claim" ? "Explique ton lien avec ce film..." : "Décris le problème..."}
            />
            <label className="flex flex-col gap-2 text-sm font-medium text-text-secondary">
              <span>Justificatif {fileRequired ? "*" : <span className="text-text-tertiary">(facultatif)</span>}</span>
              <input
                type="file"
                accept={FILE_TYPES.join(",")}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="w-full min-w-0 rounded-card border border-white/10 bg-white/5 px-3 py-2.5 text-[13px] font-normal text-text-secondary file:mr-3 file:rounded-pill file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-text-primary"
              />
              <span className="text-xs font-normal text-text-tertiary">PDF, JPEG, PNG ou WebP, 4 Mo maximum.</span>
            </label>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-[13px] text-red-400">{error}</p>}

        <div className="mt-5 flex gap-3">
          <Button onClick={submit} disabled={!canSend} className="flex-1">
            {sending ? "Envoi..." : "Envoyer"}
          </Button>
          <Button variant="glass" onClick={onClose}>Annuler</Button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
