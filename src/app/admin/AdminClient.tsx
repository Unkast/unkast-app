"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { isGrantValid, validateGrantExpiry, type ProGrantType } from "@/lib/pro-plan";
import { CATEGORY_LABELS, DECLARED_ROLES, REFUSAL_REASONS } from "@/lib/constants";
import VideoFacade from "@/components/VideoFacade";

type Tab = "recruiters" | "reports" | "users" | "films" | "claims";
// Onglets ouvrables par lien direct (/admin?tab=films).
const TABS: Tab[] = ["recruiters", "reports", "users", "films", "claims"];

// `plan` (2026-08-10) : le badge « verifie » n'est affiche au public que si le
// toggle est pose ET le compte Pro. L'admin doit voir les deux — voir VerifiedPill.
interface Recruiter { id: string; full_name: string; slug: string; email: string; recruiter_company: string | null; recruiter_role: string | null; recruiter_website: string | null; recruiter_status: string; recruiter_verified?: boolean; plan?: string | null; is_suspended?: boolean; created_at: string; }
interface RecruiterEdit { id: string; full_name: string; slug: string; bio: string | null; bio_pending: string | null; recruiter_verified: boolean; plan?: string | null; recruiter_company: string | null; created_at: string; }
// reporter_id null = signalement automatique (detecteur de coordonnees).
// career_entry : contenu de l'entree du Parcours signalee (null si deja supprimee).
// message_recipient : destinataire du message signale (target_* = expediteur).
interface Report { id: string; reporter_id: string | null; reporter_name: string; target_type: string; target_id: string; target_name: string; target_slug: string; target_owner_id: string; reason: string; description: string | null; total_reports: number; urgent?: boolean; created_at: string; career_entry?: { title: string; role: string; year: number; production: string | null } | null; message_recipient?: string | null; }
// pro_grant_type / pro_grant_expires_at / subscription_status : chantier grants
// (2026-08-10) — necessaires pour afficher l'ORIGINE du Pro (Stripe / offert /
// recruteur), pas seulement le badge `plan` opaque. Voir GET tab=users
// (src/app/api/admin/route.ts) qui les selectionne desormais.
interface User { id: string; full_name: string; slug: string; email: string; account_type: string; plan: string; is_suspended: boolean; status: string; created_at: string; pro_grant_type: string | null; pro_grant_expires_at: string | null; subscription_status: string | null; }
interface Film { id: string; title: string; slug: string; category: string; year: number; video_url: string; poster_url: string | null; preview_url: string | null; owner_name: string; owner_slug: string; status: string; created_at: string; profile_id: string | null; source_title: string | null; source_author: string | null; source_duration: number | null; declared_role: string | null; }
// Gestion des films (lot 2 de la route) : films approuves modifies, films sans
// Responsable, signalements / revendications de films.
interface EditedFilm { id: string; title: string; slug: string; edited_at: string; edited_by_name: string; title_changed: boolean; reported: boolean; approved_title: string | null; }
interface OrphanFilm { id: string; title: string; slug: string; status: string; visibility: string; }
interface Claim { id: string; project_id: string; claimant_id: string; kind: "report" | "claim"; message: string; created_at: string; project_title: string; project_slug: string; claimant_name: string; claimant_slug: string; document_url: string | null; }
// Attribution d'un Responsable : `preset` = demandeur d'une revendication acceptee.
interface AssignTarget { projectId: string; title: string; preset?: { id: string; name: string }; }
interface AssignCandidate { id: string; full_name: string; email: string; account_type: string; }

const REASON_LABELS: Record<string, string> = { spam: "Spam", inappropriate: "Inapproprié", fake: "Faux profil", harassment: "Harcèlement", copyright: "Arnaque", other: "Autre", contact_info: "Coordonnées" };
const TARGET_LABELS: Record<string, string> = { profile: "Profil", project: "Film", message: "Message", career_entry: "Parcours" };
const FILM_STATUS_LABELS: Record<string, string> = { pending: "En attente", approved: "Approuvé", refused: "Refusé" };
const VISIBILITY_LABELS: Record<string, string> = { public: "Public", members: "Membres seulement", unpublished: "Dépublié" };

// Statuts Stripe consideres "actif" — miroir de PRO_STATUSES (webhook) et de
// la RPC recompute_plan, uniquement pour l'AFFICHAGE du badge composite.
const STRIPE_ACTIVE_STATUSES = ["active", "trialing", "past_due"];
const GRANT_TYPE_LABELS: Record<string, string> = { launch: "Lancement", vip: "VIP" };

interface ProBadge { label: string; tone: "pro" | "muted" | "expired"; }

// Badge composite remplaçant l'ancien badge `plan` opaque : distingue un Pro
// Stripe d'un Pro offert (et sa nature), et signale un grant expire meme apres
// retour en free (temoin conserve en base, voir migration 20260810_pro_grants).
function proBadge(u: User): ProBadge {
  const stripeActive = u.subscription_status !== null && STRIPE_ACTIVE_STATUSES.includes(u.subscription_status);
  const grantValid = isGrantValid(u.pro_grant_type, u.pro_grant_expires_at);
  const grantLabel = u.pro_grant_type ? (GRANT_TYPE_LABELS[u.pro_grant_type] ?? u.pro_grant_type) : null;

  if (u.plan === "pro") {
    if (stripeActive && grantValid) return { label: `Pro · Stripe + ${grantLabel}`, tone: "pro" };
    if (stripeActive) return { label: "Pro · Stripe actif", tone: "pro" };
    if (grantValid && u.pro_grant_type === "launch") {
      const d = u.pro_grant_expires_at ? new Date(u.pro_grant_expires_at).toLocaleDateString("fr-FR") : "?";
      return { label: `Pro · Lancement → ${d}`, tone: "pro" };
    }
    if (grantValid && u.pro_grant_type === "vip") return { label: "Pro · Offert VIP", tone: "pro" };
    // plan='pro' sans stripe actif NI grant valide detectable ici : etat
    // transitoire (juste avant le prochain recompute_plan) ou anomalie a
    // investiguer manuellement — pas un des 5 cas nommes, badge generique.
    return { label: "Pro", tone: "pro" };
  }

  // plan === 'free' : un grant expire (colonnes conservees comme temoin,
  // jamais nettoyees automatiquement) reste visible pour l'admin.
  if (u.pro_grant_type && u.pro_grant_expires_at && !grantValid) {
    const d = new Date(u.pro_grant_expires_at).toLocaleDateString("fr-FR");
    return { label: `Free · ex-${(grantLabel ?? u.pro_grant_type).toLowerCase()} (expiré le ${d})`, tone: "expired" };
  }
  return { label: "Free", tone: "muted" };
}

// Pastille « verifie » de l'onglet recruteurs. Deux etats a ne PAS confondre :
// le toggle est pose et le compte est Pro (le public voit le badge), ou le
// toggle est pose mais le compte est Free (le public ne voit rien). Le bouton
// Verifier/Retirer verif. reste pilote par le toggle seul — c'est la seule
// chose que l'admin controle ; le Pro, lui, vient de Stripe ou d'un grant.
function VerifiedPill({ verified, plan }: { verified?: boolean; plan?: string | null }) {
  if (!verified) return null;
  const active = plan === "pro";
  return (
    <span
      title={
        active
          ? "Vérification accordée + compte Pro : le badge est affiché sur le profil public."
          : "Vérification accordée, mais compte Free : le badge n'est PAS affiché au public. Il réapparaît si le compte redevient Pro."
      }
      style={{
        fontSize: 10,
        padding: "2px 6px",
        borderRadius: 4,
        fontWeight: 600,
        background: active ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.04)",
        color: active ? "#38bdf8" : "#777",
        border: active ? "1px solid transparent" : "1px dashed rgba(255,255,255,0.2)",
        whiteSpace: "nowrap",
      }}
    >
      {active ? "Vérifié" : "Vérifié · masqué (Free)"}
    </span>
  );
}

// Duree en secondes -> m:ss, ou h:mm:ss au-dela d'une heure.
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const ss = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// Carte d'un film a valider, pensee pour le telephone : lecteur, informations a
// comparer, puis deux gros boutons. « Refuser » deplie les motifs dans la carte.
function PendingFilmCard({ film: f, busy, onApprove, onRefuse }: {
  film: Film;
  busy: boolean;
  onApprove: () => void;
  onRefuse: (reasons: string[], note: string) => void;
}) {
  const [refusing, setRefusing] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);

  const other = reasons.includes("autre");
  const canConfirm = reasons.length > 0 && (!other || note.trim() !== "") && !busy;
  const declaredRole = DECLARED_ROLES.find((r) => r.value === f.declared_role)?.label ?? f.declared_role;
  const category = (CATEGORY_LABELS as Record<string, string>)[f.category] ?? f.category;

  function toggleReason(value: string) {
    const checked = reasons.includes(value);
    setReasons(checked ? reasons.filter((r) => r !== value) : [...reasons, value]);
    if (value === "autre" && !checked) setNoteOpen(true);
  }

  const label = { color: "#555" } as const;
  const missing = { color: "#444" } as const;
  const bigBtn = { flex: 1, minHeight: 52, borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" } as const;

  return (
    <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 16, maxWidth: 560, overflow: "hidden" }}>
      {/* Le lecteur ne se monte qu'au clic (VideoFacade). */}
      <VideoFacade url={f.video_url} title={f.title} poster={f.poster_url || f.preview_url} />

      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 17, fontWeight: 600, color: "#f0f0f0", lineHeight: 1.3, overflowWrap: "anywhere" }}>{f.title}</p>

        {/* Titre et chaine lus chez YouTube / Vimeo a la soumission : a
            comparer au titre saisi et au deposant (vol d'oeuvre). */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 12, marginTop: 10, fontSize: 13, color: "#aaa", lineHeight: 1.7, overflowWrap: "anywhere" }}>
          <p style={{ margin: 0 }}><span style={label}>Titre d&apos;origine :</span> {f.source_title || <span style={missing}>non relevé</span>}</p>
          <p style={{ margin: 0 }}><span style={label}>Chaîne d&apos;origine :</span> {f.source_author || <span style={missing}>non relevée</span>}</p>
          <p style={{ margin: 0 }}><span style={label}>Rôle déclaré :</span> {declaredRole || <span style={missing}>aucune déclaration</span>}</p>
          <p style={{ margin: 0 }}><span style={label}>Catégorie :</span> {category}</p>
          <p style={{ margin: 0 }}><span style={label}>Année :</span> {f.year}</p>
          {f.source_duration != null && <p style={{ margin: 0 }}><span style={label}>Durée :</span> {formatDuration(f.source_duration)}</p>}
          <p style={{ margin: 0 }}>
            <span style={label}>Publié par :</span>{" "}
            {f.owner_slug
              ? <Link href={`/profil/${f.owner_slug}`} target="_blank" style={{ color: "#C8FF00", textDecoration: "none" }}>{f.owner_name || f.owner_slug}</Link>
              : <span style={{ color: "#f97316" }}>sans Responsable</span>}
          </p>
        </div>

        <p style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
          Proposé le {new Date(f.created_at).toLocaleDateString("fr-FR")} ·{" "}
          <a href={f.video_url} target="_blank" rel="noopener noreferrer" style={{ color: "#888" }}>Lien vidéo</a>
        </p>

        {!refusing ? (
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={onApprove} disabled={busy} style={{ ...bigBtn, background: "#22c55e", border: "none", color: "#0d0d0d", opacity: busy ? 0.5 : 1 }}>Approuver</button>
            <button onClick={() => setRefusing(true)} disabled={busy} style={{ ...bigBtn, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", opacity: busy ? 0.5 : 1 }}>Refuser</button>
          </div>
        ) : (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>Motif du refus (un ou plusieurs)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {REFUSAL_REASONS.map((r) => {
                const checked = reasons.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleReason(r.value)}
                    style={{
                      minHeight: 46, padding: "0 16px", borderRadius: 23, fontSize: 14, fontWeight: 600, cursor: "pointer",
                      background: checked ? "#ef4444" : "rgba(255,255,255,0.05)",
                      border: checked ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.14)",
                      color: checked ? "#fff" : "#aaa",
                    }}
                  >
                    {checked ? "✓ " : ""}{r.label}
                  </button>
                );
              })}
            </div>

            {noteOpen ? (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                aria-label="Précision"
                placeholder={other ? "Précise le motif (obligatoire)" : "Précision (facultative)"}
                style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 12, padding: 12, background: "#1a1a1a", border: `1px solid ${other && !note.trim() ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, fontSize: 16, color: "#f0f0f0", resize: "vertical", minHeight: 80, outline: "none" }}
              />
            ) : (
              <button type="button" onClick={() => setNoteOpen(true)} style={{ display: "block", marginTop: 4, padding: "12px 0", background: "none", border: "none", color: "#888", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>
                Ajouter une précision
              </button>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={() => onRefuse(reasons, note.trim())} disabled={!canConfirm} style={{ ...bigBtn, flex: 2, background: "#ef4444", border: "none", color: "#fff", opacity: canConfirm ? 1 : 0.4, cursor: canConfirm ? "pointer" : "default" }}>Confirmer le refus</button>
              <button onClick={() => setRefusing(false)} disabled={busy} style={{ ...bigBtn, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Annuler</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminClient({ initialTab }: { initialTab?: string }) {
  // Lien direct /admin?tab=films ; valeur inconnue ou absente : recruteurs.
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "recruiters");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<{ action: string; targetId: string; label: string } | null>(null);
  const [modalReason, setModalReason] = useState("");
  const [toast, setToast] = useState("");

  // Modal "Offrir Pro…" — distinct du modal reason ci-dessus : porte un type
  // de grant + une echeance, pas une simple raison texte.
  const [grantModal, setGrantModal] = useState<{ targetId: string; label: string } | null>(null);
  // 'launch' debloque le 2026-08-10 (commit 5) : le cron d'expiration
  // (/api/cron/pro-expiry, vercel.json) existe desormais et recompute les
  // launch echus chaque jour — un launch accorde ici n'est plus un VIP
  // deguise. Reste par defaut sur 'vip' a l'ouverture (voir openGrantModal).
  const [grantType, setGrantType] = useState<Extract<ProGrantType, "vip" | "launch">>("vip");
  const [grantExpiresAt, setGrantExpiresAt] = useState(""); // input type="date" (yyyy-mm-dd), vide = sans echeance (interdit pour 'launch', voir validateGrantExpiry)

  // Data
  const [pendingRecruiters, setPendingRecruiters] = useState<Recruiter[]>([]);
  const [approvedRecruiters, setApprovedRecruiters] = useState<Recruiter[]>([]);
  const [recruiterEdits, setRecruiterEdits] = useState<RecruiterEdit[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [films, setFilms] = useState<Film[]>([]);
  const [editedFilms, setEditedFilms] = useState<EditedFilm[]>([]);
  const [orphanFilms, setOrphanFilms] = useState<OrphanFilm[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [backfilling, setBackfilling] = useState(false);
  // Adresses de profil qui contiennent un vrai nom alors que la personne affiche
  // un nom de scene : null = pas encore verifie, sinon la liste a confirmer.
  const [slugFixes, setSlugFixes] = useState<{ id: string; display_name: string; real_name: string; slug: string }[] | null>(null);
  const [slugFixBusy, setSlugFixBusy] = useState(false);

  // Modal "Attribuer un Responsable" : recherche d'un membre par nom
  // (GET tab=users&q=), puis assign_project_owner avec son id.
  const [assign, setAssign] = useState<AssignTarget | null>(null);
  const [assignQuery, setAssignQuery] = useState("");
  const [assignResults, setAssignResults] = useState<AssignCandidate[] | null>(null);
  const [assignSearching, setAssignSearching] = useState(false);

  // Les erreurs (messages serveur, parfois longs) restent affichees plus longtemps.
  function showToast(msg: string, ms = 3000) { setToast(msg); setTimeout(() => setToast(""), ms); }

  // Charge un onglet et range sa reponse.
  const loadTab = useCallback(async (key: Tab, q = "") => {
    const res = await fetch(`/api/admin?tab=${key}&q=${q}`);
    if (!res.ok) return;
    const data = await res.json();
    if (key === "recruiters") { setPendingRecruiters(data.pending || []); setApprovedRecruiters(data.approved || []); setRecruiterEdits(data.edits || []); }
    if (key === "reports") setReports(data.reports || []);
    if (key === "users") setUsers(data.users || []);
    if (key === "films") { setFilms(data.films || []); setEditedFilms(data.edited || []); setOrphanFilms(data.orphans || []); }
    if (key === "claims") setClaims(data.claims || []);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await loadTab(tab, userSearch);
    setLoading(false);
  }, [tab, userSearch, loadTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Pastilles des onglets : visibles des l'ouverture de l'admin, sans attendre
  // qu'un onglet soit ouvert. Une fois, au montage (l'onglet actif est charge
  // par fetchData).
  useEffect(() => {
    (["reports", "films", "claims"] as Tab[]).forEach((key) => { loadTab(key); });
  }, [loadTab]);

  // Renvoie true si l'action a porte. `extra` : champs propres a une action
  // (profile_id pour assign_project_owner). Le message d'erreur du serveur est
  // affiche tel quel (dont le 409 de approve_film : video deja prise).
  async function doAction(action: string, targetId: string, reason?: string, extra?: Record<string, unknown>, done = "Action effectuee"): Promise<boolean> {
    setActionLoading(targetId);
    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, target_id: targetId, reason, ...extra }),
    });
    setActionLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showToast(data?.error || "Erreur inconnue", 7000);
      return false;
    }
    showToast(done);
    fetchData();
    return true;
  }

  function openAssign(target: AssignTarget) {
    setAssign(target);
    setAssignQuery("");
    setAssignResults(null);
  }

  async function searchAssignCandidates() {
    if (!assignQuery.trim()) return;
    setAssignSearching(true);
    const res = await fetch(`/api/admin?tab=users&q=${encodeURIComponent(assignQuery.trim())}`);
    const data = res.ok ? await res.json() : null;
    setAssignResults(data?.users || []);
    setAssignSearching(false);
  }

  async function executeAssign(profileId: string) {
    if (!assign) return;
    if (await doAction("assign_project_owner", assign.projectId, undefined, { profile_id: profileId })) setAssign(null);
  }

  // Accepter ne transfere PAS le film (voulu, en deux gestes) : pour une
  // revendication, on propose ensuite l'attribution au demandeur, sans la faire.
  async function acceptClaim(c: Claim) {
    if (!(await doAction("accept_claim", c.id))) return;
    if (c.kind === "claim") openAssign({ projectId: c.project_id, title: c.project_title, preset: { id: c.claimant_id, name: c.claimant_name } });
  }

  function confirmAction(action: string, targetId: string, label: string) {
    setModalAction({ action, targetId, label });
    setModalReason("");
  }

  async function executeModal() {
    if (!modalAction) return;
    await doAction(modalAction.action, modalAction.targetId, modalReason);
    setModalAction(null);
  }

  function openGrantModal(targetId: string, label: string) {
    setGrantModal({ targetId, label });
    setGrantType("vip");
    setGrantExpiresAt("");
  }

  // 'launch' impose une echeance (profiles_pro_grant_expiry_check) : prefiller
  // a +1 an au choix du type, editable ensuite. Repasser sur 'vip' ne vide pas
  // la date deja saisie (elle redevient simplement optionnelle).
  function selectGrantType(type: Extract<ProGrantType, "vip" | "launch">) {
    setGrantType(type);
    if (type === "launch" && !grantExpiresAt) {
      const oneYearOut = new Date();
      oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
      setGrantExpiresAt(oneYearOut.toISOString().slice(0, 10));
    }
  }

  // Distinct de doAction() : grant_pro porte grant_type/expires_at, pas une
  // simple raison texte. Meme gestion d'erreur que doAction (remonte
  // l'erreur reelle renvoyee par la route, pas un message generique).
  async function executeGrant() {
    if (!grantModal) return;
    setActionLoading(grantModal.targetId);
    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "grant_pro",
        target_id: grantModal.targetId,
        grant_type: grantType,
        expires_at: grantExpiresAt ? new Date(grantExpiresAt).toISOString() : null,
      }),
    });
    setActionLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showToast(data?.error || "Erreur inconnue");
      return;
    }
    showToast("Pro offert accordé");
    setGrantModal(null);
    fetchData();
  }

  // Rattrapage des images de film manquantes (backfill_posters), par lots :
  // tant que remaining est vrai, on relance avec next_offset. 20 passes au plus.
  async function backfillPosters() {
    setBackfilling(true);
    let offset = 0, checked = 0, filled = 0, remaining = false, failure = "";
    for (let pass = 0; pass < 20; pass++) {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backfill_posters", offset }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => null) : null;
      if (!res?.ok || !data) { failure = data?.error || "Erreur inconnue"; break; }
      checked += data.checked ?? 0;
      filled += data.filled ?? 0;
      remaining = Boolean(data.remaining);
      if (!remaining) break;
      offset = data.next_offset ?? 0;
    }
    setBackfilling(false);
    const summary = `${filled} image(s) récupérée(s) sur ${checked} film(s) vérifié(s)`;
    if (failure) showToast(`${failure} (${summary})`, 7000);
    else showToast(remaining ? `${summary}. Relance pour continuer.` : summary, 7000);
    if (filled > 0) loadTab("films");
  }

  // Rattrapage des adresses de profil (fix_profile_slugs) : sans `ids`, la route
  // liste sans rien changer ; avec `ids`, elle applique a ces profils seulement.
  async function fixProfileSlugs(ids?: string[]) {
    setSlugFixBusy(true);
    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fix_profile_slugs", ...(ids ? { ids } : {}) }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setSlugFixBusy(false);
    if (!res?.ok || !data) { showToast(data?.error || "Erreur inconnue", 7000); return; }
    if (ids) {
      setSlugFixes(null);
      showToast(`${data.changed ?? 0} adresse(s) changée(s)`, 7000);
    } else {
      setSlugFixes(data.candidates ?? []);
    }
  }

  const filmsCount = films.length + editedFilms.length + orphanFilms.length;
  const totalPending = pendingRecruiters.length + recruiterEdits.length + reports.length + filmsCount + claims.length;
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const btnApprove = { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 } as const;
  const btnDanger = { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 } as const;
  const btnNeutral = { ...btnApprove, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" } as const;
  const card = { background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16, marginBottom: 12 } as const;
  const sectionTitle = { fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 14 } as const;
  const pill = { fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#888", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" } as const;

  return (
    <div style={{ padding: "20px 16px 120px", maxWidth: 900, margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 150, maxWidth: "calc(100vw - 32px)", padding: "10px 16px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 13, color: "#f0f0f0" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Administration Unkast</h1>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>{date} · {totalPending} action{totalPending !== 1 ? "s" : ""} en attente</p>

      {/* Tabs */}
      <div className="no-scrollbar" style={{ display: "flex", gap: 6, marginBottom: 24, overflowX: "auto" }}>
        {([
          ["recruiters", "Recruteurs", pendingRecruiters.length + recruiterEdits.length],
          ["reports", "Signalements", reports.length],
          ["users", "Utilisateurs", 0],
          ["films", "Films", filmsCount],
          ["claims", "Revendications", claims.length],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            style={{
              padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: tab === key ? 600 : 400, cursor: "pointer",
              background: tab === key ? "#C8FF00" : "rgba(255,255,255,0.06)",
              color: tab === key ? "#0d0d0d" : "#666",
              border: tab === key ? "none" : "1px solid rgba(255,255,255,0.08)",
              whiteSpace: "nowrap", position: "relative",
            }}
          >
            {label}
            {(count as number) > 0 && (
              <span style={{ marginLeft: 6, padding: "2px 6px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: "#ef4444", color: "#fff" }}>{count as number}</span>
            )}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "#555", fontSize: 13 }}>Chargement...</p>}

      {/* ===== RECRUITERS ===== */}
      {!loading && tab === "recruiters" && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 14 }}>En attente ({pendingRecruiters.length})</h2>
          {pendingRecruiters.length === 0 && <p style={{ color: "#555", fontSize: 13 }}>Aucune demande en attente.</p>}
          {pendingRecruiters.map((r) => (
            <div key={r.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0" }}>{r.full_name}</p>
                  <p style={{ fontSize: 12, color: "#555" }}>{r.email}</p>
                </div>
                <p style={{ fontSize: 11, color: "#444", fontFamily: "JetBrains Mono, monospace" }}>{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
              {r.recruiter_company && <p style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Société : {r.recruiter_company}</p>}
              {r.recruiter_role && <p style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Poste : {r.recruiter_role}</p>}
              {r.recruiter_website && <a href={r.recruiter_website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#C8FF00" }}>{r.recruiter_website}</a>}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => doAction("approve_recruiter", r.id)} disabled={actionLoading === r.id} style={btnApprove}>Approuver</button>
                <button onClick={() => confirmAction("reject_recruiter", r.id, `Refuser ${r.full_name}`)} style={btnDanger}>Refuser</button>
              </div>
            </div>
          ))}

          {/* Modifications sensibles (description pro) en attente de re-validation */}
          {recruiterEdits.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginTop: 32, marginBottom: 4 }}>Modifications en attente ({recruiterEdits.length})</h2>
              <p style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>Description professionnelle modifiée — le public voit encore la version actuelle.</p>
              {recruiterEdits.map((e) => (
                <div key={e.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Link href={`/profil/${e.slug}`} target="_blank" style={{ fontSize: 15, fontWeight: 600, color: "#f0f0f0", textDecoration: "none" }}>{e.full_name}</Link>
                        <VerifiedPill verified={e.recruiter_verified} plan={e.plan} />
                      </div>
                      {e.recruiter_company && <p style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{e.recruiter_company}</p>}
                    </div>
                    <p style={{ fontSize: 11, color: "#444", fontFamily: "JetBrains Mono, monospace" }}>{new Date(e.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 10 }}>
                      <p style={{ fontSize: 10, color: "#555", fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Actuelle (publique)</p>
                      <p style={{ fontSize: 12.5, color: "#888", lineHeight: 1.5, whiteSpace: "pre-wrap", margin: 0 }}>{e.bio || <span style={{ color: "#444" }}>— vide —</span>}</p>
                    </div>
                    <div style={{ background: "rgba(200,255,0,0.03)", border: "1px solid rgba(200,255,0,0.18)", borderRadius: 8, padding: 10 }}>
                      <p style={{ fontSize: 10, color: "#8aa800", fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Proposée</p>
                      <p style={{ fontSize: 12.5, color: "#e8e8e8", lineHeight: 1.5, whiteSpace: "pre-wrap", margin: 0 }}>{e.bio_pending || <span style={{ color: "#444" }}>— vide —</span>}</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => doAction("approve_recruiter_edit", e.id)} disabled={actionLoading === e.id} style={btnApprove}>Approuver la modif</button>
                    <button onClick={() => confirmAction("reject_recruiter_edit", e.id, `Refuser la modification de ${e.full_name}`)} style={btnDanger}>Refuser</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {approvedRecruiters.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginTop: 32, marginBottom: 14 }}>Approuvés ({approvedRecruiters.length})</h2>
              {approvedRecruiters.map((r) => (
                <div key={r.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0", overflowWrap: "anywhere", minWidth: 0 }}>{r.full_name}</p>
                      <VerifiedPill verified={r.recruiter_verified} plan={r.plan} />
                    </div>
                    <p style={{ fontSize: 11, color: "#555", overflowWrap: "anywhere" }}>{r.recruiter_company}</p>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {r.recruiter_verified
                      ? <button onClick={() => confirmAction("revoke_recruiter_verified", r.id, `Retirer la vérification de ${r.full_name}`)} style={{ ...btnDanger, padding: "6px 12px", fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Retirer vérif.</button>
                      : <button onClick={() => doAction("grant_recruiter_verified", r.id)} disabled={actionLoading === r.id} style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Vérifier</button>
                    }
                    <button onClick={() => confirmAction("suspend_user", r.id, `Suspendre ${r.full_name}`)} style={{ ...btnDanger, padding: "6px 12px", fontSize: 12 }}>Suspendre</button>
                    {/* Distinct de "Refuser" (candidature pending) : retire un statut
                        DEJA approuve — ex. fraude decouverte apres coup. Depuis le
                        2026-08-10 l'approbation ne donne plus le Pro : cette action
                        ne fait plus que retirer le statut (le grant 'recruiter'
                        qu'elle nettoyait par le passe a ete purge et retire du
                        modele — voir revoke_recruiter_approval). */}
                    <button onClick={() => confirmAction("revoke_recruiter_approval", r.id, `Révoquer le statut recruteur de ${r.full_name}`)} style={{ ...btnDanger, padding: "6px 12px", fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Révoquer statut</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ===== REPORTS ===== */}
      {!loading && tab === "reports" && (
        <div>
          {reports.length === 0 && <p style={{ color: "#555", fontSize: 13 }}>Aucun signalement en attente.</p>}
          {reports.map((r) => (
            <div key={r.id} style={r.urgent ? { ...card, borderColor: "rgba(239,68,68,0.4)", borderLeft: "3px solid #ef4444" } : card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {r.urgent && <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "#ef4444", color: "#fff", letterSpacing: "0.05em" }}>URGENT</span>}
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#888", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace" }}>{TARGET_LABELS[r.target_type] || r.target_type}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0" }}>{r.target_name}</span>
                    {r.total_reports >= 3 && <span style={{ padding: "2px 6px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: "#ef4444", color: "#fff" }}>{r.total_reports} signalements</span>}
                  </div>
                  <p style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{r.reporter_id ? `Signalé par ${r.reporter_name}` : "Détection automatique"} · {REASON_LABELS[r.reason] || r.reason}</p>
                </div>
                <p style={{ fontSize: 11, color: "#444", fontFamily: "JetBrains Mono, monospace" }}>{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
              {/* Entree du Parcours : son contenu (target_name = profil concerne). */}
              {r.target_type === "career_entry" && (
                <p style={{ fontSize: 13, color: "#888", marginBottom: 8, overflowWrap: "anywhere" }}>
                  {r.career_entry
                    ? <>Entrée du Parcours : <span style={{ color: "#f0f0f0" }}>{r.career_entry.title}</span> · {r.career_entry.role} · {r.career_entry.year}{r.career_entry.production ? ` · ${r.career_entry.production}` : ""}</>
                    : "Entrée du Parcours déjà supprimée."}
                </p>
              )}
              {/* Message : target_name = expediteur. */}
              {r.target_type === "message" && (
                <p style={{ fontSize: 13, color: "#888", marginBottom: 8, overflowWrap: "anywhere" }}>
                  Message de <span style={{ color: "#f0f0f0" }}>{r.target_name || "expéditeur introuvable"}</span> à <span style={{ color: "#f0f0f0" }}>{r.message_recipient || "destinataire introuvable"}</span>
                </p>
              )}
              {r.description && <p style={{ fontSize: 13, color: "#666", marginBottom: 8, overflowWrap: "anywhere" }}>{r.description}</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(r.target_type === "career_entry" || r.target_type === "message") && r.target_slug && <Link href={`/profil/${r.target_slug}`} target="_blank" style={{ ...btnNeutral, textDecoration: "none", display: "inline-block" }}>Voir le profil</Link>}
                {r.target_type === "career_entry" && r.career_entry && <button onClick={() => confirmAction("delete_career_entry", r.target_id, `Supprimer l'entrée « ${r.career_entry?.title} »`)} style={btnDanger}>Supprimer l&apos;entrée</button>}
                {r.target_type === "profile" && <Link href={`/profil/${r.target_slug}`} target="_blank" style={{ ...btnApprove, textDecoration: "none", display: "inline-block", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Voir le profil</Link>}
                {r.target_type === "project" && <Link href={`/projet/${r.target_slug}`} target="_blank" style={{ ...btnApprove, textDecoration: "none", display: "inline-block", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Voir le film</Link>}
                {r.target_owner_id && <button onClick={() => confirmAction("suspend_user", r.target_owner_id, `Suspendre le compte`)} style={btnDanger}>Suspendre</button>}
                <button onClick={() => doAction("dismiss_report", r.id)} style={{ ...btnApprove, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Ignorer</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== USERS ===== */}
      {!loading && tab === "users" && (
        <div>
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Rechercher par nom..."
            style={{ width: "100%", padding: "12px 16px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 14, color: "#f0f0f0", marginBottom: 16, outline: "none" }}
          />
          {users.map((u) => {
            const badge = proBadge(u);
            const badgeStyle =
              badge.tone === "pro"
                ? { background: "rgba(200,255,0,0.1)", color: "#C8FF00" }
                : badge.tone === "expired"
                ? { background: "rgba(249,115,22,0.08)", color: "#f97316" }
                : { background: "rgba(255,255,255,0.05)", color: "#555" };
            // ⚠️ Jusqu'au 2026-08-10, "Offrir Pro…" etait masque sur un grant
            // 'recruiter' (grant_pro l'aurait ecrase sans garde-fou serveur —
            // le seul garde-fou existant etait ici, cote UI). Ce type n'existe
            // plus dans le modele (lib/pro-plan.ts) : plus rien a exclure.
            const canRevokeGrant = isGrantValid(u.pro_grant_type, u.pro_grant_expires_at);
            return (
              <div key={u.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0" }}>{u.full_name}</p>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#666", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace" }}>{u.account_type}</span>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, ...badgeStyle }}>{badge.label}</span>
                    {u.is_suspended && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Suspendu</span>}
                  </div>
                  <p style={{ fontSize: 11, color: "#555" }}>{u.email} · {new Date(u.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                  <button onClick={() => openGrantModal(u.id, `Offrir Pro à ${u.full_name}`)} style={{ ...btnApprove, padding: "6px 10px", fontSize: 11 }}>Offrir Pro…</button>
                  {canRevokeGrant && <button onClick={() => confirmAction("revoke_pro_grant", u.id, `Retirer le Pro offert de ${u.full_name}`)} style={{ ...btnDanger, padding: "6px 10px", fontSize: 11 }}>Retirer le Pro offert</button>}
                  {u.is_suspended
                    ? <button onClick={() => doAction("reactivate_user", u.id)} style={{ ...btnApprove, padding: "6px 10px", fontSize: 11 }}>Reactiver</button>
                    : <button onClick={() => confirmAction("suspend_user", u.id, `Suspendre ${u.full_name}`)} style={{ ...btnDanger, padding: "6px 10px", fontSize: 11 }}>Suspendre</button>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== FILMS ===== */}
      {!loading && tab === "films" && (
        <div>
          <h2 style={sectionTitle}>À valider ({films.length})</h2>
          {films.length === 0 && <p style={{ color: "#555", fontSize: 13 }}>Aucun film en attente.</p>}
          {films.map((f) => (
            <PendingFilmCard
              key={f.id}
              film={f}
              busy={actionLoading === f.id}
              onApprove={() => doAction("approve_film", f.id, undefined, undefined, "Film approuvé")}
              onRefuse={(reasons, note) => doAction("refuse_film", f.id, undefined, { reasons, note: note || undefined }, "Film refusé")}
            />
          ))}

          {/* Films approuves modifies depuis leur validation */}
          <h2 style={{ ...sectionTitle, marginTop: 32 }}>Modifiés récemment ({editedFilms.length})</h2>
          <p style={{ color: "#555", fontSize: 12, marginBottom: 10 }}>Seulement les films à surveiller : titre nettement changé depuis ta validation, ou film signalé.</p>
          {editedFilms.length === 0 && <p style={{ color: "#555", fontSize: 13 }}>Aucune modification à relire.</p>}
          {editedFilms.map((f) => (
            <div key={f.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                <Link href={`/projet/${f.slug}`} target="_blank" style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0", textDecoration: "none", overflowWrap: "anywhere" }}>{f.title}</Link>
                {f.title_changed && f.approved_title && (
                  <p style={{ fontSize: 12, color: "#f59e0b", overflowWrap: "anywhere" }}>Titre validé : {f.approved_title}</p>
                )}
                {f.reported && <p style={{ fontSize: 12, color: "#ef4444" }}>Film signalé</p>}
                <p style={{ fontSize: 11, color: "#555" }}>Modifié par {f.edited_by_name || "un compte supprimé"} · {new Date(f.edited_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <Link href={`/projet/${f.slug}`} target="_blank" style={{ ...btnNeutral, textDecoration: "none", padding: "6px 12px", fontSize: 12 }}>Voir le film</Link>
                <button onClick={() => doAction("mark_film_edit_seen", f.id)} disabled={actionLoading === f.id} style={{ ...btnApprove, padding: "6px 12px", fontSize: 12 }}>Vu</button>
              </div>
            </div>
          ))}

          {/* Films sans Responsable (compte supprime sans co-gestionnaire) */}
          <h2 style={{ ...sectionTitle, marginTop: 32 }}>Sans Responsable ({orphanFilms.length})</h2>
          {orphanFilms.length === 0 && <p style={{ color: "#555", fontSize: 13 }}>Aucun film sans Responsable.</p>}
          {orphanFilms.map((f) => (
            <div key={f.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                <Link href={`/projet/${f.slug}`} target="_blank" style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0", textDecoration: "none", overflowWrap: "anywhere" }}>{f.title}</Link>
                <p style={{ fontSize: 11, color: "#555" }}>{FILM_STATUS_LABELS[f.status] || f.status} · {VISIBILITY_LABELS[f.visibility] || f.visibility}</p>
              </div>
              <button onClick={() => openAssign({ projectId: f.id, title: f.title })} style={{ ...btnApprove, padding: "6px 12px", fontSize: 12 }}>Attribuer un Responsable</button>
            </div>
          ))}
          {/* Rattrapage : vignette de la video pour les films sans image */}
          <div style={{ marginTop: 32 }}>
            <button onClick={backfillPosters} disabled={backfilling} style={{ ...btnNeutral, padding: "6px 12px", fontSize: 12, fontWeight: 500, opacity: backfilling ? 0.5 : 1, cursor: backfilling ? "default" : "pointer" }}>
              {backfilling ? "Récupération en cours..." : "Récupérer les images manquantes"}
            </button>
          </div>
          {/* Rattrapage : adresses de profil qui contiennent un vrai nom */}
          <div style={{ marginTop: 16 }}>
            <button onClick={() => fixProfileSlugs()} disabled={slugFixBusy} style={{ ...btnNeutral, padding: "6px 12px", fontSize: 12, fontWeight: 500, opacity: slugFixBusy ? 0.5 : 1, cursor: slugFixBusy ? "default" : "pointer" }}>
              Vérifier les adresses de profil
            </button>
            {slugFixes && slugFixes.length === 0 && (
              <p style={{ marginTop: 10, fontSize: 12, color: "#888" }}>Aucune adresse ne contient un vrai nom masqué.</p>
            )}
            {slugFixes && slugFixes.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
                  Ces personnes affichent un nom de scène, mais leur adresse contient leur vrai nom. Confirmer leur donne une
                  nouvelle adresse ; l&apos;ancienne ne fonctionnera plus (page introuvable, sans redirection).
                </p>
                {slugFixes.map((p) => (
                  <p key={p.id} style={{ fontSize: 12, color: "#f0f0f0", overflowWrap: "anywhere", marginBottom: 4 }}>
                    {p.display_name} <span style={{ color: "#666" }}>({p.real_name})</span> · /profil/{p.slug}
                  </p>
                ))}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  <button onClick={() => fixProfileSlugs(slugFixes.map((p) => p.id))} disabled={slugFixBusy} style={{ ...btnApprove, padding: "6px 12px", fontSize: 12 }}>
                    Changer {slugFixes.length} adresse(s)
                  </button>
                  <button onClick={() => setSlugFixes(null)} disabled={slugFixBusy} style={{ ...btnNeutral, padding: "6px 12px", fontSize: 12 }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== CLAIMS (signalements et revendications de films) ===== */}
      {!loading && tab === "claims" && (
        <div>
          {claims.length === 0 && <p style={{ color: "#555", fontSize: 13 }}>Aucune demande en attente.</p>}
          {claims.map((c) => (
            <div key={c.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={c.kind === "claim" ? { ...pill, background: "rgba(200,255,0,0.1)", color: "#C8FF00" } : pill}>{c.kind === "claim" ? "Revendication" : "Signalement"}</span>
                    <Link href={`/projet/${c.project_slug}`} target="_blank" style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0", textDecoration: "none", overflowWrap: "anywhere" }}>{c.project_title || "Film introuvable"}</Link>
                  </div>
                  <p style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                    Demandé par <Link href={`/profil/${c.claimant_slug}`} target="_blank" style={{ color: "#888", textDecoration: "none" }}>{c.claimant_name || "compte introuvable"}</Link>
                  </p>
                </div>
                <p style={{ fontSize: 11, color: "#444", fontFamily: "JetBrains Mono, monospace", flexShrink: 0 }}>{new Date(c.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
              <p style={{ fontSize: 13, color: "#888", marginBottom: 8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.message}</p>
              <p style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
                {c.document_url
                  ? <><a href={c.document_url} target="_blank" rel="noopener noreferrer" style={{ color: "#C8FF00" }}>Ouvrir le justificatif</a> (lien valable 10 minutes, recharge l&apos;onglet s&apos;il a expiré)</>
                  : "Aucun justificatif joint."}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => acceptClaim(c)} disabled={actionLoading === c.id} style={btnApprove}>Accepter</button>
                <button onClick={() => confirmAction("reject_claim", c.id, `Refuser ${c.kind === "claim" ? "la revendication" : "le signalement"} de ${c.claimant_name}`)} style={btnDanger}>Refuser</button>
              </div>
              {c.kind === "claim" && <p style={{ fontSize: 11, color: "#555", marginTop: 8 }}>Accepter ne transfère pas le film : l&apos;attribution au demandeur est proposée ensuite.</p>}
            </div>
          ))}
        </div>
      )}

      {/* ===== ASSIGN OWNER MODAL ("Attribuer un Responsable") ===== */}
      {assign && (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) setAssign(null); }} style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", padding: 16 }}>
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 6, overflowWrap: "anywhere" }}>Responsable de « {assign.title} »</h3>
            <p style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>Le membre choisi devient le Responsable du film. S&apos;il y en a déjà un, il est remplacé.</p>

            {assign.preset && (
              <div style={{ background: "rgba(200,255,0,0.03)", border: "1px solid rgba(200,255,0,0.18)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: "#e8e8e8", marginBottom: 10 }}>Revendication acceptée. Attribuer le film à {assign.preset.name} ?</p>
                <button onClick={() => executeAssign(assign.preset!.id)} disabled={actionLoading === assign.projectId} style={btnApprove}>Attribuer à {assign.preset.name}</button>
              </div>
            )}

            <p style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{assign.preset ? "Ou un autre membre" : "Chercher un membre"}</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                value={assignQuery}
                onChange={(e) => setAssignQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") searchAssignCandidates(); }}
                placeholder="Nom du membre..."
                style={{ flex: 1, minWidth: 0, padding: 12, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#f0f0f0", outline: "none" }}
              />
              <button onClick={searchAssignCandidates} disabled={assignSearching || !assignQuery.trim()} style={{ ...btnNeutral, opacity: assignQuery.trim() ? 1 : 0.4 }}>Chercher</button>
            </div>
            {assignSearching && <p style={{ color: "#555", fontSize: 13, marginBottom: 12 }}>Recherche...</p>}
            {!assignSearching && assignResults?.length === 0 && <p style={{ color: "#555", fontSize: 13, marginBottom: 12 }}>Aucun membre trouvé.</p>}
            {!assignSearching && assignResults?.map((u) => (
              <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: "#f0f0f0", overflowWrap: "anywhere" }}>{u.full_name} <span style={{ fontSize: 10, color: "#666", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace" }}>{u.account_type}</span></p>
                  <p style={{ fontSize: 11, color: "#555", overflowWrap: "anywhere" }}>{u.email}</p>
                </div>
                <button onClick={() => executeAssign(u.id)} disabled={actionLoading === assign.projectId} style={{ ...btnApprove, padding: "6px 12px", fontSize: 12, flexShrink: 0 }}>Attribuer</button>
              </div>
            ))}

            <button onClick={() => setAssign(null)} style={{ ...btnNeutral, width: "100%", marginTop: 16 }}>{assign.preset ? "Plus tard" : "Annuler"}</button>
          </div>
        </div>
      )}

      {/* ===== REASON MODAL ===== */}
      {modalAction && (
        <div onClick={() => setModalAction(null)} style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 12 }}>{modalAction.label}</h3>
            <textarea
              value={modalReason}
              onChange={(e) => setModalReason(e.target.value)}
              placeholder="Raison (obligatoire)..."
              style={{ width: "100%", padding: 12, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#f0f0f0", resize: "none", minHeight: 80, outline: "none", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={executeModal} disabled={!modalReason.trim()} style={{ ...btnDanger, flex: 1, opacity: modalReason.trim() ? 1 : 0.4 }}>Confirmer</button>
              <button onClick={() => setModalAction(null)} style={{ ...btnApprove, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== GRANT PRO MODAL ("Offrir Pro…") ===== */}
      {grantModal && (() => {
        // Miroir client de la regle serveur (profiles_pro_grant_expiry_check /
        // validateGrantExpiry) : 'launch' impose une echeance, 'vip' non. Ne
        // remplace pas la validation serveur, evite juste un aller-retour 400.
        const grantExpiresIso = grantExpiresAt ? new Date(grantExpiresAt).toISOString() : null;
        const grantValidationError = validateGrantExpiry(grantType, grantExpiresIso);
        return (
        <div onClick={() => setGrantModal(null)} style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 16 }}>{grantModal.label}</h3>

            <p style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Nature du grant</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#f0f0f0", cursor: "pointer" }}>
                <input type="radio" name="grant_type" checked={grantType === "vip"} onChange={() => selectGrantType("vip")} />
                VIP — sans échéance par défaut, une date reste possible
              </label>
              {/* Debloque le 2026-08-10 (commit 5) : le cron d'expiration
                  (/api/cron/pro-expiry, vercel.json) existe desormais et
                  recompute chaque jour les launch echus — voir commentaire sur
                  le state grantType plus haut. */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#f0f0f0", cursor: "pointer" }}>
                <input type="radio" name="grant_type" checked={grantType === "launch"} onChange={() => selectGrantType("launch")} />
                Lancement — échéance obligatoire (pré-remplie à +1 an, modifiable)
              </label>
            </div>

            <p style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Échéance {grantType === "launch" ? "(obligatoire)" : "(optionnelle)"}</p>
            <input
              type="date"
              value={grantExpiresAt}
              onChange={(e) => setGrantExpiresAt(e.target.value)}
              style={{ width: "100%", padding: 12, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#f0f0f0", outline: "none", marginBottom: grantValidationError ? 6 : 16 }}
            />
            {grantValidationError && (
              <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 16 }}>{grantValidationError}</p>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={executeGrant} disabled={actionLoading === grantModal.targetId || !!grantValidationError} style={{ ...btnApprove, flex: 1, opacity: (actionLoading === grantModal.targetId || grantValidationError) ? 0.5 : 1 }}>Confirmer</button>
              <button onClick={() => setGrantModal(null)} style={{ ...btnApprove, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Annuler</button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
