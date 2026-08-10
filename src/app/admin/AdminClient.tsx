"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { isGrantValid, validateGrantExpiry, type ProGrantType } from "@/lib/pro-plan";

type Tab = "recruiters" | "reports" | "users" | "films";

// `plan` (2026-08-10) : le badge « verifie » n'est affiche au public que si le
// toggle est pose ET le compte Pro. L'admin doit voir les deux — voir VerifiedPill.
interface Recruiter { id: string; full_name: string; slug: string; email: string; recruiter_company: string | null; recruiter_role: string | null; recruiter_website: string | null; recruiter_status: string; recruiter_verified?: boolean; plan?: string | null; is_suspended?: boolean; created_at: string; }
interface RecruiterEdit { id: string; full_name: string; slug: string; bio: string | null; bio_pending: string | null; recruiter_verified: boolean; plan?: string | null; recruiter_company: string | null; created_at: string; }
interface Report { id: string; reporter_id: string; reporter_name: string; target_type: string; target_id: string; target_name: string; target_slug: string; target_owner_id: string; reason: string; description: string | null; total_reports: number; urgent?: boolean; created_at: string; }
// pro_grant_type / pro_grant_expires_at / subscription_status : chantier grants
// (2026-08-10) — necessaires pour afficher l'ORIGINE du Pro (Stripe / offert /
// recruteur), pas seulement le badge `plan` opaque. Voir GET tab=users
// (src/app/api/admin/route.ts) qui les selectionne desormais.
interface User { id: string; full_name: string; slug: string; email: string; account_type: string; plan: string; is_suspended: boolean; status: string; created_at: string; pro_grant_type: string | null; pro_grant_expires_at: string | null; subscription_status: string | null; }
interface Film { id: string; title: string; slug: string; category: string; year: number; video_url: string; poster_url: string | null; preview_url: string | null; owner_name: string; owner_slug: string; status: string; created_at: string; }

const REASON_LABELS: Record<string, string> = { spam: "Spam", inappropriate: "Inapproprié", fake: "Faux profil", harassment: "Harcèlement", copyright: "Arnaque", other: "Autre" };

// Statuts Stripe consideres "actif" — miroir de PRO_STATUSES (webhook) et de
// la RPC recompute_plan, uniquement pour l'AFFICHAGE du badge composite.
const STRIPE_ACTIVE_STATUSES = ["active", "trialing", "past_due"];
const GRANT_TYPE_LABELS: Record<string, string> = { launch: "Lancement", vip: "VIP", recruiter: "Recruteur" };

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
    if (grantValid && u.pro_grant_type === "recruiter") return { label: "Pro · Recruteur", tone: "pro" };
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

export default function AdminClient() {
  const [tab, setTab] = useState<Tab>("recruiters");
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

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin?tab=${tab}&q=${userSearch}`);
    if (res.ok) {
      const data = await res.json();
      if (tab === "recruiters") { setPendingRecruiters(data.pending || []); setApprovedRecruiters(data.approved || []); setRecruiterEdits(data.edits || []); }
      if (tab === "reports") setReports(data.reports || []);
      if (tab === "users") setUsers(data.users || []);
      if (tab === "films") setFilms(data.films || []);
    }
    setLoading(false);
  }, [tab, userSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function doAction(action: string, targetId: string, reason?: string) {
    setActionLoading(targetId);
    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, target_id: targetId, reason }),
    });
    setActionLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showToast(data?.error || "Erreur inconnue");
      return;
    }
    showToast("Action effectuee");
    fetchData();
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

  const totalPending = pendingRecruiters.length + recruiterEdits.length + reports.length + films.length;
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const btnApprove = { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 } as const;
  const btnDanger = { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 } as const;
  const card = { background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16, marginBottom: 12 } as const;

  return (
    <div style={{ padding: "20px 16px 120px", maxWidth: 900, margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 50, padding: "10px 16px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 13, color: "#f0f0f0" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>Administration Unkast</h1>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>{date} · {totalPending} action{totalPending !== 1 ? "s" : ""} en attente</p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, overflowX: "auto" }}>
        {([
          ["recruiters", "Recruteurs", pendingRecruiters.length + recruiterEdits.length],
          ["reports", "Signalements", reports.length],
          ["users", "Utilisateurs", 0],
          ["films", "Films", films.length],
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
                <div key={r.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0" }}>{r.full_name}</p>
                      <VerifiedPill verified={r.recruiter_verified} plan={r.plan} />
                    </div>
                    <p style={{ fontSize: 11, color: "#555" }}>{r.recruiter_company}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {r.recruiter_verified
                      ? <button onClick={() => confirmAction("revoke_recruiter_verified", r.id, `Retirer la vérification de ${r.full_name}`)} style={{ ...btnDanger, padding: "6px 12px", fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Retirer vérif.</button>
                      : <button onClick={() => doAction("grant_recruiter_verified", r.id)} disabled={actionLoading === r.id} style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Vérifier</button>
                    }
                    <button onClick={() => confirmAction("suspend_user", r.id, `Suspendre ${r.full_name}`)} style={{ ...btnDanger, padding: "6px 12px", fontSize: 12 }}>Suspendre</button>
                    {/* Distinct de "Refuser" (candidature pending) : retire un statut
                        DEJA approuve — ex. fraude decouverte apres coup. Depuis le
                        2026-08-10 l'approbation ne donne plus le Pro : cette action
                        ne fait donc plus que retirer le statut (elle nettoie encore
                        un grant 'recruiter' pour les profils approuves AVANT ce
                        changement — voir revoke_recruiter_approval). */}
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
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#888", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace" }}>{r.target_type}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0" }}>{r.target_name}</span>
                    {r.total_reports >= 3 && <span style={{ padding: "2px 6px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: "#ef4444", color: "#fff" }}>{r.total_reports} signalements</span>}
                  </div>
                  <p style={{ fontSize: 12, color: "#555", marginTop: 4 }}>Signale par {r.reporter_name} · {REASON_LABELS[r.reason] || r.reason}</p>
                </div>
                <p style={{ fontSize: 11, color: "#444", fontFamily: "JetBrains Mono, monospace" }}>{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
              {r.description && <p style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>{r.description}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                {r.target_type === "profile" && <Link href={`/profil/${r.target_slug}`} target="_blank" style={{ ...btnApprove, textDecoration: "none", display: "inline-block", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Voir le profil</Link>}
                {r.target_type === "project" && <Link href={`/projet/${r.target_slug}`} target="_blank" style={{ ...btnApprove, textDecoration: "none", display: "inline-block", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Voir le film</Link>}
                <button onClick={() => confirmAction("suspend_user", r.target_owner_id, `Suspendre le compte`)} style={btnDanger}>Suspendre</button>
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
            // "Offrir Pro…" masque sur un grant 'recruiter' : grant_pro ecrase
            // pro_grant_type sans garde-fou cote serveur (contrairement a
            // revoke_pro_grant, qui refuse d'agir dessus) — un clic ici
            // remplacerait silencieusement le grant recruiter par vip/launch,
            // decorrelant le Pro du statut recruteur approuve sans passer par
            // revoke_recruiter_approval. Le seul garde-fou existant est ici,
            // cote UI.
            const canOfferPro = u.pro_grant_type !== "recruiter";
            const canRevokeGrant = isGrantValid(u.pro_grant_type, u.pro_grant_expires_at) && u.pro_grant_type !== "recruiter";
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
                  {canOfferPro && <button onClick={() => openGrantModal(u.id, `Offrir Pro à ${u.full_name}`)} style={{ ...btnApprove, padding: "6px 10px", fontSize: 11 }}>Offrir Pro…</button>}
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
          {films.length === 0 && <p style={{ color: "#555", fontSize: 13 }}>Aucun film en attente.</p>}
          {films.map((f) => (
            <div key={f.id} style={{ ...card, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 80, height: 60, borderRadius: 8, background: "#1a1a1a", flexShrink: 0, overflow: "hidden", position: "relative" }}>
                {(f.preview_url || f.poster_url) ? (
                  <img src={(f.preview_url || f.poster_url) as string} alt={f.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#C8FF00" style={{ opacity: 0.2 }}><path d="M8 5v14l11-7z" /></svg>
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", marginBottom: 2 }}>{f.title}</p>
                <p style={{ fontSize: 11, color: "#555" }}>par <Link href={`/profil/${f.owner_slug}`} style={{ color: "#888", textDecoration: "none" }}>{f.owner_name}</Link> · {f.year} · {f.category}</p>
                <p style={{ fontSize: 11, color: "#444", fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>{new Date(f.created_at).toLocaleDateString("fr-FR")}</p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => doAction("approve_film", f.id)} disabled={actionLoading === f.id} style={btnApprove}>Approuver</button>
                  <button onClick={() => confirmAction("refuse_film", f.id, `Refuser "${f.title}"`)} style={btnDanger}>Refuser</button>
                  <a href={f.video_url} target="_blank" rel="noopener noreferrer" style={{ ...btnApprove, textDecoration: "none", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Lien video</a>
                </div>
              </div>
            </div>
          ))}
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
