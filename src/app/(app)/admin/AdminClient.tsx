"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Tab = "recruiters" | "reports" | "users" | "films";

interface Recruiter { id: string; full_name: string; slug: string; email: string; recruiter_company: string | null; recruiter_role: string | null; recruiter_website: string | null; recruiter_status: string; recruiter_verified?: boolean; is_suspended?: boolean; created_at: string; }
interface RecruiterEdit { id: string; full_name: string; slug: string; bio: string | null; bio_pending: string | null; recruiter_verified: boolean; recruiter_company: string | null; created_at: string; }
interface Report { id: string; reporter_id: string; reporter_name: string; target_type: string; target_id: string; target_name: string; target_slug: string; reason: string; description: string | null; total_reports: number; urgent?: boolean; created_at: string; }
interface User { id: string; full_name: string; slug: string; email: string; account_type: string; plan: string; is_suspended: boolean; status: string; created_at: string; }
interface Film { id: string; title: string; slug: string; category: string; year: number; video_url: string; poster_url: string | null; preview_url: string | null; owner_name: string; owner_slug: string; status: string; created_at: string; }

const REASON_LABELS: Record<string, string> = { spam: "Spam", inappropriate: "Inapproprié", fake: "Faux profil", harassment: "Harcèlement", copyright: "Arnaque", other: "Autre" };

export default function AdminClient() {
  const [tab, setTab] = useState<Tab>("recruiters");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<{ action: string; targetId: string; label: string } | null>(null);
  const [modalReason, setModalReason] = useState("");
  const [toast, setToast] = useState("");

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
    await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, target_id: targetId, reason }),
    });
    setActionLoading(null);
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
                        {e.recruiter_verified && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(56,189,248,0.12)", color: "#38bdf8", fontWeight: 600 }}>Vérifié</span>}
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
                      {r.recruiter_verified && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(56,189,248,0.12)", color: "#38bdf8", fontWeight: 600 }}>Vérifié</span>}
                    </div>
                    <p style={{ fontSize: 11, color: "#555" }}>{r.recruiter_company}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {r.recruiter_verified
                      ? <button onClick={() => confirmAction("revoke_recruiter_verified", r.id, `Retirer la vérification de ${r.full_name}`)} style={{ ...btnDanger, padding: "6px 12px", fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>Retirer vérif.</button>
                      : <button onClick={() => doAction("grant_recruiter_verified", r.id)} disabled={actionLoading === r.id} style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Vérifier</button>
                    }
                    <button onClick={() => confirmAction("suspend_user", r.id, `Suspendre ${r.full_name}`)} style={{ ...btnDanger, padding: "6px 12px", fontSize: 12 }}>Suspendre</button>
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
                <button onClick={() => confirmAction("suspend_user", r.target_type === "profile" ? r.target_id : "", `Suspendre le compte`)} style={btnDanger}>Suspendre</button>
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
          {users.map((u) => (
            <div key={u.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0f0" }}>{u.full_name}</p>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#666", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace" }}>{u.account_type}</span>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: u.plan === "pro" ? "rgba(200,255,0,0.1)" : "rgba(255,255,255,0.05)", color: u.plan === "pro" ? "#C8FF00" : "#555" }}>{u.plan}</span>
                  {u.is_suspended && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Suspendu</span>}
                </div>
                <p style={{ fontSize: 11, color: "#555" }}>{u.email} · {new Date(u.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {u.plan !== "pro" && <button onClick={() => doAction("set_pro", u.id)} style={{ ...btnApprove, padding: "6px 10px", fontSize: 11 }}>Pro</button>}
                {u.is_suspended
                  ? <button onClick={() => doAction("reactivate_user", u.id)} style={{ ...btnApprove, padding: "6px 10px", fontSize: 11 }}>Reactiver</button>
                  : <button onClick={() => confirmAction("suspend_user", u.id, `Suspendre ${u.full_name}`)} style={{ ...btnDanger, padding: "6px 10px", fontSize: 11 }}>Suspendre</button>
                }
              </div>
            </div>
          ))}
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
    </div>
  );
}
