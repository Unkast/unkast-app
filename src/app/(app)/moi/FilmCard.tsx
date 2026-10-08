"use client";
// Un film de la liste : role, statut, visibilite, et ses panneaux (modifier,
// image, visibilite, crediter par email, gestion).
import { useState } from "react";
import { CATEGORY_LABELS, MEMBERS_ONLY_WARNING, PROJECT_VISIBILITIES } from "@/lib/constants";
import type { ProjectCategory, ProjectVisibility } from "@/types/database";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import { FilmThumb, Note } from "./parts";
import { callApi, type ManagedProject, type ShowToast } from "./api";
import FilmManagers from "./FilmManagers";
import PosterUpload from "./PosterUpload";
import RightsDeclaration, {
  EMPTY_DECLARATION,
  declarationPayload,
  isDeclarationComplete,
  needsClientAuthorization,
  type Declaration,
} from "./RightsDeclaration";

type Panel = "edit" | "poster" | "visibility" | "credit" | "managers";

interface PanelProps {
  project: ManagedProject;
  reload: () => Promise<void>;
  showToast: ShowToast;
  close: () => void;
}

const helpCls = "text-xs leading-relaxed text-text-secondary";

/* ---------- Modifier (PATCH /api/dashboard/projects) ---------- */

function EditPanel({ project, reload, showToast, close }: PanelProps) {
  const isOwner = project.my_role === "owner";
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [category, setCategory] = useState<ProjectCategory>(project.category);
  const [year, setYear] = useState(project.year);
  const [declaration, setDeclaration] = useState<Declaration>(EMPTY_DECLARATION);
  // Le serveur a reclame une declaration (409).
  const [declarationAsked, setDeclarationAsked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Passage vers publicite ou clip : accord du client a declarer par le Responsable.
  const becomesClientWork = needsClientAuthorization(category) && !needsClientAuthorization(project.category);
  const showDeclaration = isOwner && (project.needs_rights_declaration || becomesClientWork || declarationAsked);

  // Seuls les champs modifies sont envoyes.
  const changes: Record<string, string | number | null> = {};
  if (title.trim() !== project.title) changes.title = title.trim();
  if ((description.trim() || null) !== (project.description?.trim() || null)) changes.description = description.trim() || null;
  if (category !== project.category) changes.category = category;
  if (year !== project.year) changes.year = year;
  const changed = Object.keys(changes).length > 0;

  const canSave = Boolean(title.trim()) && (showDeclaration ? isDeclarationComplete(declaration, category) : changed) && !saving;

  async function save() {
    setSaving(true);
    setError("");
    const r = await callApi("/api/dashboard/projects", "PATCH", {
      id: project.id,
      ...changes,
      ...(showDeclaration ? { declaration: declarationPayload(declaration, category) } : {}),
    });
    if (r.ok) {
      showToast("Film mis à jour");
      await reload();
      close();
      return;
    }
    setSaving(false);
    setError(r.error);
    // Un co-gestionnaire ne peut pas declarer : il ne voit que le message du serveur.
    if (isOwner && (r.code === "rights_declaration_required" || r.code === "client_authorization_required")) {
      setDeclarationAsked(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {project.needs_rights_declaration && (
        <p className="border-l-2 border-lime pl-3 text-xs leading-relaxed text-text-secondary">
          Avant de modifier ce film, indique ton rôle et confirme tes droits de diffusion.
        </p>
      )}
      <Field label="Titre" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value as ProjectCategory)}>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
        </Select>
        <Field label="Année" type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || project.year)} min={1990} max={2030} />
      </div>
      <Field multiline rows={3} label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <p className={helpCls}>Le lien vidéo n&apos;est pas modifiable : pour changer de vidéo, publie un nouveau film. L&apos;image se change dans « Image ».</p>

      {showDeclaration && <RightsDeclaration value={declaration} onChange={setDeclaration} category={category} />}
      {!isOwner && becomesClientWork && (
        <p className={helpCls}>
          Le passage en publicité ou en clip demande l&apos;accord du client ou du label, confirmé par le Responsable du film.
        </p>
      )}

      {error && <Note>{error}</Note>}

      <div className="flex gap-3">
        <Button onClick={save} disabled={!canSave} className="flex-1">
          {saving ? "..." : "Enregistrer"}
        </Button>
        <Button variant="glass" onClick={close} className="flex-1">
          Annuler
        </Button>
      </div>
    </div>
  );
}

/* ---------- Visibilite (Responsable seul) ---------- */

function VisibilityPanel({ project, reload, showToast, close }: PanelProps) {
  const [visibility, setVisibility] = useState<ProjectVisibility>(project.visibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const r = await callApi("/api/dashboard/projects", "PATCH", { id: project.id, visibility });
    if (r.ok) {
      showToast("Visibilité mise à jour");
      await reload();
      close();
      return;
    }
    setSaving(false);
    setError(r.error);
  }

  return (
    <div className="flex flex-col gap-3">
      <Select label="Qui peut voir ce film" value={visibility} onChange={(e) => setVisibility(e.target.value as ProjectVisibility)}>
        {PROJECT_VISIBILITIES.map((v) => (<option key={v.value} value={v.value}>{v.label}</option>))}
      </Select>
      {visibility === "members" && (
        <p className="rounded-card border border-orange-400/30 bg-orange-400/10 p-3 text-xs leading-relaxed text-text-primary">
          {MEMBERS_ONLY_WARNING}
        </p>
      )}
      {visibility === "unpublished" && <p className={helpCls}>Le film n&apos;est plus visible sur Unkast, sauf par ses gestionnaires.</p>}
      {error && <Note>{error}</Note>}
      <div className="flex gap-3">
        <Button onClick={save} disabled={visibility === project.visibility || saving} className="flex-1">
          {saving ? "..." : "Enregistrer"}
        </Button>
        <Button variant="glass" onClick={close} className="flex-1">
          Annuler
        </Button>
      </div>
    </div>
  );
}

/* ---------- Crediter par email un collaborateur absent d'Unkast ---------- */

function CreditPanel({ project, reload, showToast, close }: PanelProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    const r = await callApi<{ email_sent?: boolean }>("/api/invitations", "POST", {
      project_id: project.id,
      email,
      role,
      name: name || null,
    });
    setSending(false);
    if (!r.ok) {
      showToast(r.error);
      return;
    }
    showToast(r.data.email_sent ? "Invitation envoyée par email" : "Invitation enregistrée (email non envoyé en dev)");
    await reload();
    close();
  }

  return (
    <div>
      <p className={`mb-3 ${helpCls}`}>
        Crédite un collaborateur absent d&apos;Unkast : il reçoit un email pour rejoindre et revendiquer son crédit. Pour un membre déjà inscrit, passe par son profil.
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1.6fr_1fr]">
        <Field aria-label="Nom" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" />
        <Field aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <Field aria-label="Rôle" type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rôle" />
      </div>
      <Button onClick={send} disabled={!email || !role || sending} className="mt-3 w-full sm:w-auto">
        Inviter
      </Button>
    </div>
  );
}

/* ========================================================================== */

export default function FilmCard({
  project,
  userId,
  reload,
  showToast,
}: {
  project: ManagedProject;
  userId: string;
  reload: () => Promise<void>;
  showToast: ShowToast;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const isOwner = project.my_role === "owner";

  const statusTone = project.status === "approved" ? "published" : project.status === "pending" ? "pending" : "rejected";
  const statusLabel = project.status === "approved" ? "Publié" : project.status === "pending" ? "En attente" : "Refusé";
  const visibilityLabel = PROJECT_VISIBILITIES.find((v) => v.value === project.visibility)?.label ?? "Public";

  async function remove() {
    if (!confirm("Supprimer ce film ? Cette action est définitive.")) return;
    const r = await callApi(`/api/dashboard/projects?id=${project.id}`, "DELETE");
    if (!r.ok) showToast(r.error);
    await reload();
  }

  const tabs: { key: Panel; label: string }[] = [
    { key: "edit", label: "Modifier" },
    { key: "poster", label: "Image" },
    ...(isOwner ? [{ key: "visibility" as const, label: "Visibilité" }] : []),
    { key: "credit", label: "Créditer" },
    { key: "managers", label: "Gestion" },
  ];
  const panelProps: PanelProps = { project, reload, showToast, close: () => setPanel(null) };

  return (
    <>
      <div className="flex items-center gap-3">
        <FilmThumb url={project.poster_url} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">{project.title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="neutral">{isOwner ? "Responsable" : "Co-gestionnaire"}</Badge>
            <Badge variant={statusTone}>{statusLabel}</Badge>
            <Badge variant="neutral">{visibilityLabel}</Badge>
          </div>
        </div>
        {/* Supprimer : Responsable seul */}
        {isOwner && (
          <Button variant="icon" size="sm" aria-label="Supprimer le film" onClick={remove} className="shrink-0 self-start text-text-secondary!">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </Button>
        )}
      </div>

      {project.status === "refused" && project.refusal && project.refusal.length > 0 && (
        <div className="mt-3 rounded-card border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-text-secondary">
          <p className="text-text-primary">Ce film n&apos;a pas été retenu :</p>
          <ul className="mt-1 list-disc pl-4">
            {project.refusal.map((line, i) => (<li key={i} className="break-words">{line}</li>))}
          </ul>
          <p className="mt-2">
            Tu peux proposer une nouvelle version ou un autre film quand tu veux, et ce refus ne compte pas dans ta limite de films.
          </p>
        </div>
      )}

      {isOwner && project.needs_rights_declaration && panel !== "edit" && (
        <p className="mt-3 text-xs leading-relaxed text-yellow-400">
          Droits de diffusion à confirmer : ouvre « Modifier ».
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {tabs.map(({ key, label }) => {
          const open = panel === key;
          return (
            <Button
              key={key}
              variant="glass"
              size="sm"
              aria-expanded={open}
              onClick={() => setPanel(open ? null : key)}
              className={`px-3! ${open ? "border-lime/40! text-lime!" : ""}`}
            >
              {label}
            </Button>
          );
        })}
      </div>

      {panel && (
        <div className="mt-3 border-t border-white/10 pt-3">
          {panel === "edit" && <EditPanel {...panelProps} />}
          {panel === "poster" && <PosterUpload project={project} reload={reload} showToast={showToast} />}
          {panel === "visibility" && <VisibilityPanel {...panelProps} />}
          {panel === "credit" && <CreditPanel {...panelProps} />}
          {panel === "managers" && <FilmManagers projectId={project.id} userId={userId} reloadFilms={reload} showToast={showToast} />}
        </div>
      )}
    </>
  );
}
