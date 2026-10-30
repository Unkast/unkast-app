"use client";
// Un film de la liste : role, statut, visibilite, et ses panneaux (modifier,
// image, visibilite, crediter par email, gestion).
import { useRef, useState } from "react";
import { CATEGORY_LABELS, MEMBERS_ONLY_WARNING, PROJECT_VISIBILITIES, SERIES_CATEGORY, episodesLabel } from "@/lib/constants";
import type { ProjectCategory, ProjectVisibility } from "@/types/database";
import Avatar from "@/components/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import { FilmThumb, Note } from "./parts";
import { callApi, type ManagedProject, type ShowToast } from "./api";
import FilmManagers from "./FilmManagers";
import PosterUpload from "./PosterUpload";
import TeamList from "./TeamList";
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
  const isSeries = project.category === SERIES_CATEGORY;
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
        {/* Une série reste une série, un film ne le devient pas (lié à la playlist). */}
        <Select label="Catégorie" value={category} disabled={isSeries} onChange={(e) => setCategory(e.target.value as ProjectCategory)}>
          {Object.entries(CATEGORY_LABELS)
            .filter(([key]) => isSeries || key !== SERIES_CATEGORY)
            .map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
        </Select>
        <Field label="Année" type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || project.year)} min={1990} max={2030} />
      </div>
      <Field multiline rows={3} label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <p className={helpCls}>
        {isSeries
          ? "Le lien de la playlist n'est pas modifiable. Si tu as ajouté ou retiré des épisodes sur YouTube, clique sur « Actualiser les épisodes ». L'image se change dans « Image »."
          : "Le lien vidéo n'est pas modifiable : pour changer de vidéo, publie un nouveau film. L'image se change dans « Image »."}
      </p>

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

/* ---------- Crediter : un membre (recherche), ou quelqu'un par email ---------- */

// Membre propose par la recherche (GET /api/members/search) ou reconnu par son email.
interface MemberHit {
  id: string;
  name: string | null;
  avatar_url: string | null;
  role?: string | null;
}

const sectionTitleCls = "mb-2 text-[13px] font-semibold text-text-primary";

function MemberLine({ member }: { member: MemberHit }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar url={member.avatar_url} name={member.name || "?"} size={36} className="shrink-0" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-text-primary">{member.name || "Membre"}</span>
        {member.role && <span className="block truncate text-xs text-text-secondary">{member.role}</span>}
      </span>
    </span>
  );
}

function CreditPanel({ project, reload, showToast }: PanelProps) {
  // Recherche d'un membre
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [member, setMember] = useState<MemberHit | null>(null);
  const [memberRole, setMemberRole] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQuery = useRef("");
  // Invitation par email
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  // Email reconnu : le membre qui porte cet email
  const [match, setMatch] = useState<MemberHit | null>(null);
  const [sending, setSending] = useState(false);
  // Relit l'equipe apres une invitation (la liste se recharge a chaque changement).
  const [teamVersion, setTeamVersion] = useState(0);

  function search(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    latestQuery.current = q;
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const r = await callApi<{ members?: MemberHit[] }>(`/api/members/search?q=${encodeURIComponent(q)}`);
      if (latestQuery.current !== q) return; // une saisie plus recente a pris le relais
      if (!r.ok) showToast(r.error);
      setResults(r.ok ? r.data.members ?? [] : []);
      setSearched(true);
    }, 300);
  }

  // Invitation a un membre inscrit : il accepte ou refuse depuis son profil.
  async function inviteMember(target: MemberHit, targetRole: string) {
    setSending(true);
    const r = await callApi("/api/invitations/project", "POST", {
      project_id: project.id,
      invited_profile_id: target.id,
      role: targetRole.trim(),
    });
    setSending(false);
    if (!r.ok) {
      showToast(r.error);
      return;
    }
    showToast(`Invitation envoyée à ${target.name || "ce membre"}`);
    setMember(null);
    setMatch(null);
    setQuery("");
    setResults([]);
    setSearched(false);
    setTeamVersion((v) => v + 1);
  }

  async function sendEmail() {
    setSending(true);
    const r = await callApi<{ self?: boolean; match?: MemberHit }>("/api/invitations", "POST", {
      project_id: project.id,
      email,
      role,
      name,
    });
    setSending(false);
    if (!r.ok) {
      showToast(r.error);
      return;
    }
    // Email d'un membre : rien n'est parti, on propose de le crediter.
    if (r.data.match) {
      setMatch(r.data.match);
      return;
    }
    showToast(r.data.self ? "Rôle ajouté à ton crédit" : "Invitation envoyée");
    setName("");
    setEmail("");
    setRole("");
    setTeamVersion((v) => v + 1);
    await reload();
  }

  return (
    <div className="flex flex-col gap-5">
      <p className={helpCls}>
        Personne n&apos;est crédité sans son accord : un membre accepte ou refuse l&apos;invitation depuis son profil.
      </p>

      {/* 1. Chercher un membre */}
      <section>
        <h4 className={sectionTitleCls}>Chercher un membre</h4>
        {member ? (
          <div className="flex flex-col gap-3 rounded-card border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <MemberLine member={member} />
              <Button variant="glass" size="sm" onClick={() => setMember(null)} className="shrink-0">
                Changer
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Field aria-label="Rôle sur le film" type="text" value={memberRole} onChange={(e) => setMemberRole(e.target.value)} placeholder="Rôle sur le film" className="sm:flex-1" />
              <Button onClick={() => inviteMember(member, memberRole)} disabled={!memberRole.trim() || sending} className="sm:shrink-0">
                Inviter
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Field aria-label="Chercher un membre" type="search" value={query} onChange={(e) => search(e.target.value)} placeholder="Nom affiché ou nom de scène" />
            {results.length > 0 && (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => { setMember(m); setMemberRole(""); }}
                      className="flex min-h-11 w-full items-center rounded-card border border-white/10 bg-white/5 p-2.5 text-left hover:border-lime/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
                    >
                      <MemberLine member={m} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searched && results.length === 0 && <p className={`mt-2 ${helpCls}`}>Aucun membre trouvé.</p>}
          </>
        )}
      </section>

      {/* 2. Equipe du film */}
      <TeamList key={teamVersion} projectId={project.id} showToast={showToast} />

      {/* 3. Pas trouve : inviter par email */}
      <section className="border-t border-white/10 pt-4">
        <h4 className={sectionTitleCls}>Pas trouvé ? Inviter par email</h4>
        {match ? (
          <div className="flex flex-col gap-3 rounded-card border border-lime/25 bg-white/5 p-3">
            <p className="text-sm text-text-primary">Cet email correspond au membre {match.name || "Membre"}.</p>
            <MemberLine member={match} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => inviteMember(match, role)} disabled={sending}>
                Créditer ce membre
              </Button>
              <Button variant="glass" onClick={() => setMatch(null)} disabled={sending}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className={`mb-2 ${helpCls}`}>Pour quelqu&apos;un qui n&apos;est pas encore sur Unkast : il reçoit un email pour créer son compte et retrouver son crédit.</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1.6fr_1fr]">
              <Field aria-label="Nom" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" />
              <Field aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
              <Field aria-label="Rôle" type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rôle" />
            </div>
            <Button onClick={sendEmail} disabled={!name.trim() || !email || !role.trim() || sending} className="mt-3 w-full sm:w-auto">
              Inviter par email
            </Button>
          </>
        )}
      </section>
    </div>
  );
}

/* ========================================================================== */

export default function FilmCard({
  project,
  userId,
  reload,
  showToast,
  onPanelChange,
}: {
  project: ManagedProject;
  userId: string;
  reload: () => Promise<void>;
  showToast: ShowToast;
  /** Prévient la grille quand un panneau s'ouvre ou se ferme (la carte ouverte prend toute la largeur). */
  onPanelChange?: (open: boolean) => void;
}) {
  const [panel, setPanelState] = useState<Panel | null>(null);
  const setPanel = (next: Panel | null) => {
    setPanelState(next);
    onPanelChange?.(next !== null);
  };
  const [refreshing, setRefreshing] = useState(false);
  const isOwner = project.my_role === "owner";
  const isSeries = project.category === SERIES_CATEGORY;

  const statusTone = project.status === "approved" ? "published" : project.status === "pending" ? "pending" : "rejected";
  const statusLabel = project.status === "approved" ? "Publié" : project.status === "pending" ? "En attente" : "Refusé";
  const visibilityLabel = PROJECT_VISIBILITIES.find((v) => v.value === project.visibility)?.label ?? "Public";

  // Série : relit la playlist (épisodes ajoutés ou retirés), sans nouvelle validation.
  async function refreshEpisodes() {
    setRefreshing(true);
    const r = await callApi<{ episode_count?: number }>(`/api/projects/${project.id}/episodes`, "POST");
    setRefreshing(false);
    showToast(r.ok ? `Épisodes à jour : ${episodesLabel(r.data.episode_count ?? 0)}` : r.error);
    if (r.ok) await reload();
  }

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
        <FilmThumb url={project.poster_url} large />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">{project.title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="neutral">{isOwner ? "Responsable" : "Co-gestionnaire"}</Badge>
            <Badge variant={statusTone}>{statusLabel}</Badge>
            <Badge variant="neutral">{visibilityLabel}</Badge>
            {isSeries && project.episode_count != null && <Badge variant="neutral">{episodesLabel(project.episode_count)}</Badge>}
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
        {isSeries && (
          <Button variant="glass" size="sm" disabled={refreshing} onClick={refreshEpisodes} className="px-3!">
            {refreshing ? "Actualisation..." : "Actualiser les épisodes"}
          </Button>
        )}
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
