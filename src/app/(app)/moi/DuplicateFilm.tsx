"use client";
// Ecran affiche quand la video soumise est deja sur Unkast (409 `duplicate`).
import { useState } from "react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Field from "@/components/ui/Field";
import { Note } from "./parts";
import { callApi, type DuplicateProject } from "./api";

type Choice = "credit" | "manage" | "claim";

// Memes limites que POST /api/projects/[id]/claims.
const CLAIM_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const CLAIM_MAX_SIZE = 4 * 1024 * 1024;
const CLAIM_MAX_MESSAGE = 2000;

export default function DuplicateFilm({ project, onBack }: { project: DuplicateProject | null; onBack: () => void }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // Actions deja envoyees : le bouton ne se represente pas.
  const [sent, setSent] = useState<Choice[]>([]);

  function pick(next: Choice) {
    setChoice(next);
    setFeedback(null);
  }

  async function send(kind: Choice, okText: string, run: () => ReturnType<typeof callApi>) {
    setBusy(true);
    setFeedback(null);
    const r = await run();
    setBusy(false);
    if (r.ok) {
      setSent((s) => [...s, kind]);
      setFeedback({ tone: "ok", text: okText });
    } else if (r.code === "not_credited") {
      setFeedback({ tone: "error", text: "Tu dois d'abord être crédité sur ce film. Demande à être crédité, puis reviens demander la co-gestion." });
    } else {
      setFeedback({ tone: "error", text: r.error });
    }
  }

  function chooseFile(next: File | null) {
    setFeedback(null);
    if (next && !CLAIM_TYPES.includes(next.type)) {
      setFile(null);
      setFeedback({ tone: "error", text: "Format non accepté : PDF, JPEG, PNG ou WebP uniquement." });
      return;
    }
    if (next && next.size > CLAIM_MAX_SIZE) {
      setFile(null);
      setFeedback({ tone: "error", text: "Fichier trop volumineux (4 Mo maximum)." });
      return;
    }
    setFile(next);
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-[15px] font-semibold text-text-primary">Cette vidéo est déjà sur Unkast</h3>
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Le film n&apos;a pas pu être identifié. Réessaie dans un instant.
        </p>
        <Button variant="glass" onClick={onBack} className="self-start">Retour au formulaire</Button>
      </div>
    );
  }

  const base = `/api/projects/${project.id}`;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[15px] font-semibold text-text-primary">Cette vidéo est déjà sur Unkast</h3>
      {project.title ? (
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Elle correspond au film <span className="font-semibold text-text-primary">{project.title}</span>.{" "}
          {project.slug && project.is_visible && (
            <a href={`/projet/${project.slug}`} target="_blank" rel="noopener noreferrer" className="text-lime hover:underline">
              Voir le film
            </a>
          )}
        </p>
      ) : (
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Elle correspond à un film qui n&apos;est pas visible pour le moment.
        </p>
      )}
      <p className="text-[13px] leading-relaxed text-text-secondary">Un film n&apos;existe qu&apos;une fois sur Unkast. Tu peux :</p>

      <div className="flex flex-wrap gap-2">
        <Chip selected={choice === "credit"} onClick={() => pick("credit")}>Être crédité</Chip>
        <Chip selected={choice === "manage"} onClick={() => pick("manage")}>Co-gérer</Chip>
        <Chip selected={choice === "claim"} onClick={() => pick("claim")}>Revendiquer</Chip>
      </div>

      {choice === "credit" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-text-secondary">
            Indique ton rôle sur le film. Les gestionnaires du film valident ta demande.
          </p>
          {!sent.includes("credit") && (
            <>
              <Field aria-label="Ton rôle sur le film" type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ton rôle sur le film" />
              <Button
                disabled={!role.trim() || busy}
                onClick={() => send("credit", "Demande de crédit envoyée.", () => callApi("/api/credits/request", "POST", { project_id: project.id, role: role.trim() }))}
                className="self-start"
              >
                Demander à être crédité
              </Button>
            </>
          )}
        </div>
      )}

      {choice === "manage" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-text-secondary">
            La co-gestion est réservée aux personnes créditées sur le film. Le Responsable du film valide ta demande.
          </p>
          {!sent.includes("manage") && (
            <Button
              disabled={busy}
              onClick={() => send("manage", "Demande de co-gestion envoyée au Responsable.", () => callApi(`${base}/managers`, "POST"))}
              className="self-start"
            >
              Demander à co-gérer
            </Button>
          )}
        </div>
      )}

      {choice === "claim" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-text-secondary">
            Tu penses que ce film devrait être sous ta responsabilité ? Explique pourquoi et joins un justificatif. L&apos;équipe Unkast étudie la demande.
          </p>
          {!sent.includes("claim") && (
            <>
              <Field
                multiline
                rows={3}
                aria-label="Ton message"
                value={message}
                maxLength={CLAIM_MAX_MESSAGE}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ton lien avec ce film"
              />
              <label className="flex flex-col gap-2 text-sm font-medium text-text-secondary">
                Justificatif (PDF, JPEG, PNG ou WebP, 4 Mo maximum)
                <input
                  type="file"
                  accept={CLAIM_TYPES.join(",")}
                  onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
                  className="w-full min-w-0 text-xs font-normal text-text-secondary file:mr-3 file:min-h-9 file:rounded-pill file:border-0 file:bg-white/10 file:px-4 file:text-[13px] file:font-semibold file:text-text-primary"
                />
              </label>
              <Button
                disabled={!message.trim() || !file || busy}
                onClick={() =>
                  send("claim", "Revendication envoyée. L'équipe Unkast te répondra.", () => {
                    const form = new FormData();
                    form.append("kind", "claim");
                    form.append("message", message.trim());
                    if (file) form.append("file", file);
                    return callApi(`${base}/claims`, "POST", form);
                  })
                }
                className="self-start"
              >
                {busy ? "Envoi..." : "Envoyer la revendication"}
              </Button>
            </>
          )}
        </div>
      )}

      {feedback && <Note tone={feedback.tone}>{feedback.text}</Note>}

      <Button variant="glass" onClick={onBack} className="self-start">Retour au formulaire</Button>
    </div>
  );
}
