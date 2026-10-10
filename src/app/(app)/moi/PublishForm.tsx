"use client";
// Formulaire de publication d'un film (POST /api/dashboard/projects).
import { useState } from "react";
import { CATEGORY_LABELS, DECLARED_ROLES, SERIES_CATEGORY } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import { Note } from "./parts";
import { callApi, type DuplicateProject, type ShowToast } from "./api";
import DuplicateFilm from "./DuplicateFilm";
import RightsDeclaration, {
  EMPTY_DECLARATION,
  declarationPayload,
  isDeclarationComplete,
  type Declaration,
} from "./RightsDeclaration";

export default function PublishForm({
  onPublished,
  onCancel,
  showToast,
}: {
  onPublished: () => Promise<void>;
  onCancel: () => void;
  showToast: ShowToast;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ProjectCategory>("court-metrage");
  const [year, setYear] = useState(new Date().getFullYear());
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [ownerRole, setOwnerRole] = useState("");
  const [declaration, setDeclaration] = useState<Declaration>(EMPTY_DECLARATION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // undefined : pas de doublon ; null : doublon non identifie.
  const [duplicate, setDuplicate] = useState<DuplicateProject | null | undefined>(undefined);

  const isSeries = category === SERIES_CATEGORY;
  // Realisateur et producteur : credit cree automatiquement par le serveur.
  const autoCredit = DECLARED_ROLES.find((r) => r.value === declaration.role)?.credit ?? null;

  async function submit() {
    setSaving(true);
    setError("");
    const r = await callApi<{ project?: DuplicateProject | null }>("/api/dashboard/projects", "POST", {
      title,
      category,
      year,
      video_url: videoUrl,
      description: description || null,
      owner_role: ownerRole.trim() || null,
      ...declarationPayload(declaration, category),
    });
    if (r.ok) {
      showToast(isSeries ? "Série ajoutée, en attente de validation" : "Film ajouté, en attente de validation");
      await onPublished();
      return;
    }
    setSaving(false);
    // Les champs sont conserves : l'utilisateur peut corriger ou coller une autre video.
    if (r.code === "duplicate") setDuplicate(r.data.project ?? null);
    else setError(r.error);
  }

  if (duplicate !== undefined) {
    return <DuplicateFilm project={duplicate} onBack={() => setDuplicate(undefined)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[15px] font-semibold text-text-primary">{isSeries ? "Nouvelle série" : "Nouveau film"}</h3>
      <Field
        aria-label={isSeries ? "Titre de la série" : "Titre du film"}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isSeries ? "Titre de la série (celui de la playlist si tu laisses vide)" : "Titre du film"}
      />
      <div className="grid grid-cols-2 gap-3">
        <Select aria-label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value as ProjectCategory)}>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
        </Select>
        <Field aria-label="Année" type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())} min={1990} max={2030} />
      </div>
      <div>
        <Field
          aria-label={isSeries ? "Lien de la playlist YouTube" : "URL vidéo (Vimeo ou YouTube)"}
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder={isSeries ? "Lien de la playlist YouTube (il contient list=)" : "URL vidéo (Vimeo ou YouTube)"}
        />
        <div className="mt-2 space-y-1 text-xs leading-relaxed text-text-secondary">
          {isSeries && (
            <p>
              Colle le lien de la playlist YouTube de ta série. L&apos;image, le nombre d&apos;épisodes et leurs titres sont repris automatiquement. Une série compte pour 1 film.
            </p>
          )}
          <p>
            <span className="text-text-primary">« Non répertoriée » : acceptée.</span> La vidéo se lit sur Unkast sans apparaître dans les recherches {isSeries ? "YouTube" : "YouTube ou Vimeo"}.
          </p>
          <p>
            <span className="text-text-primary">« Privée » : impossible à lire.</span> Une vidéo privée ne s&apos;ouvre que pour son propriétaire, Unkast ne peut pas l&apos;afficher : la publication est refusée. Passe-la en « Non répertoriée » avant de la coller ici{isSeries ? ", ainsi que la playlist elle-même" : ""}.
          </p>
        </div>
      </div>
      <Field multiline rows={3} aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />

      <RightsDeclaration value={declaration} onChange={setDeclaration} category={category} />

      <div>
        <Field
          label={autoCredit ? "Autre rôle au générique (facultatif)" : "Ton rôle au générique (facultatif)"}
          type="text"
          value={ownerRole}
          onChange={(e) => setOwnerRole(e.target.value)}
          placeholder={autoCredit ? "Ex : Monteur" : "Ex : Chef opérateur"}
        />
        <p className="mt-2 text-xs leading-relaxed text-text-secondary">
          {autoCredit
            ? `Tu seras crédité comme ${autoCredit}. Ajoute ici un second rôle si tu en as un.`
            : "Le rôle sous lequel tu apparais dans l'équipe du film."}
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-card border border-white/10 bg-white/5 p-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="mt-0.5 shrink-0 text-text-secondary" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.5v.5" />
        </svg>
        <p className="text-xs leading-relaxed text-text-secondary">Chaque film est examiné par l&apos;équipe Unkast avant d&apos;être publié. Délai habituel : 24-48h.</p>
      </div>

      {error && <Note>{error}</Note>}

      <div className="flex gap-3">
        <Button onClick={submit} disabled={(!title && !isSeries) || !videoUrl || !isDeclarationComplete(declaration, category) || saving} className="flex-1">
          {saving ? "Ajout..." : "Ajouter"}
        </Button>
        <Button variant="glass" onClick={onCancel} className="flex-1">
          Annuler
        </Button>
      </div>
    </div>
  );
}
