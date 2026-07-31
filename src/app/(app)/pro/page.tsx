"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const FREE_FEATURES = [
  { label: "Profil public", included: true },
  { label: "2 publications de films max", included: true },
  { label: "Apparaitre dans les credits", included: true },
  { label: "Jusqu'a 30 films", included: false },
  { label: "Messagerie directe", included: false },
  { label: "Contact talents", included: false },
  { label: "Badge Pro verifie", included: false },
  { label: "Priorite dans les resultats", included: false },
];

const PRO_FEATURES = [
  { label: "Profil public", included: true },
  { label: "Jusqu'a 30 films (au lieu de 2)", included: true },
  { label: "Apparaitre dans les credits", included: true },
  { label: "Messagerie directe", included: true },
  { label: "Contact talents", included: true },
  { label: "Badge Pro verifie", included: true },
  { label: "Priorite dans les resultats", included: true },
  { label: "Support prioritaire", included: true },
];

// Interrupteur public : tant que false, le public voit la liste d'attente.
// Au lancement, passer NEXT_PUBLIC_BILLING_ENABLED=true (Vercel) => boutons d'achat.
const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

export default function ProPage() {
  // Waitlist (public)
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  // Détection viewer (admin override + déjà Pro ?)
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [busy, setBusy] = useState<"monthly" | "yearly" | "portal" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // is_admin et plan sont revoques pour anon/authenticated : plus de
        // lecture directe depuis le navigateur, on passe par la route serveur.
        // 401 (visiteur non connecte) => on laisse les deux etats a false.
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = await res.json();
        if (data.is_admin) setIsAdmin(true);
        if (data.plan === "pro") setIsPro(true);
      } catch {}
    })();
  }, []);

  // Les boutons d'achat sont visibles si le billing public est activé, OU pour un
  // admin (test). En mode test (billing public OFF) on affiche un bandeau clair.
  const showCheckout = BILLING_ENABLED || isAdmin;
  const testMode = !BILLING_ENABLED; // tant qu'on n'est pas live

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || null, type: "pro" }),
    });
    if (res.ok || res.status === 409) setSent(true);
    setSending(false);
  }

  async function startCheckout(interval: "monthly" | "yearly") {
    setBusy(interval);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (res.status === 401) { window.location.href = "/rejoindre"; return; }
      if (res.ok && data.url) { window.location.href = data.url; return; }
      alert(data.error || "Erreur");
    } catch { alert("Erreur réseau"); }
    finally { setBusy(null); }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      alert(data.error || "Erreur");
    } catch { alert("Erreur réseau"); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ padding: "20px 16px 120px", maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(200,255,0,0.1)", color: "#C8FF00", border: "1px solid rgba(200,255,0,0.2)", marginBottom: 16 }}>
          {showCheckout ? "Unkast Pro" : "Bientot disponible"}
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.8px", color: "#f0f0f0", marginBottom: 8 }}>
          Unkast Pro
        </h1>
        <p style={{ fontSize: 15, color: "#666", lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
          Deverrouille tout le potentiel d&apos;Unkast. Messagerie directe, films illimites, visibilite maximale.
        </p>
      </div>

      {/* Bandeau mode test (visible uniquement quand les boutons d'achat sont montrés en test) */}
      {showCheckout && testMode && (
        <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 20, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#f97316", margin: 0, lineHeight: 1.5 }}>
            Mode test — aucun paiement réel. Carte de test : 4242 4242 4242 4242.
          </p>
        </div>
      )}

      {/* Comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
        {/* Free */}
        <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#888", marginBottom: 4 }}>Gratuit</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", marginBottom: 16 }}>0€</p>
          {FREE_FEATURES.map((f) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              {f.included ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              )}
              <span style={{ fontSize: 12, color: f.included ? "#888" : "#444" }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Pro */}
        <div style={{ background: "rgba(200,255,0,0.04)", border: "1px solid rgba(200,255,0,0.2)", borderRadius: 16, padding: 20, position: "relative" }}>
          <div style={{ position: "absolute", top: -10, right: 16, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "#C8FF00", color: "#0d0d0d" }}>Recommande</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#C8FF00", marginBottom: 4 }}>Pro</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", marginBottom: 2 }}>9,99 €<span style={{ fontSize: 13, fontWeight: 400, color: "#555" }}>/mois</span></p>
          <p style={{ fontSize: 11, color: "#555", marginBottom: 16 }}>ou 99,90 €/an — 2 mois offerts</p>
          {PRO_FEATURES.map((f) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              <span style={{ fontSize: 12, color: "#f0f0f0" }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bloc action : boutons d'achat (billing activé / admin) OU liste d'attente (public) */}
      {showCheckout ? (
        <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 }}>
          {isPro ? (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 6 }}>Tu es Pro</h3>
              <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Gère ton abonnement (résiliation, carte, mensuel/annuel) via le portail sécurisé Stripe.</p>
              <button onClick={openPortal} disabled={busy === "portal"} style={{ width: "100%", padding: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#f0f0f0", fontSize: 14, fontWeight: 600, borderRadius: 12, cursor: "pointer", opacity: busy === "portal" ? 0.6 : 1 }}>
                {busy === "portal" ? "Ouverture…" : "Gérer mon abonnement"}
              </button>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 6 }}>Passer à Pro</h3>
              <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Choisis ta formule. Paiement sécurisé par Stripe.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => startCheckout("monthly")} disabled={busy !== null} style={{ width: "100%", padding: 14, background: "#C8FF00", color: "#0d0d0d", fontSize: 14, fontWeight: 600, borderRadius: 12, border: "none", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                  {busy === "monthly" ? "Redirection…" : "Mensuel — 9,99 €/mois"}
                </button>
                <button onClick={() => startCheckout("yearly")} disabled={busy !== null} style={{ width: "100%", padding: 14, background: "transparent", border: "1px solid rgba(200,255,0,0.4)", color: "#C8FF00", fontSize: 14, fontWeight: 600, borderRadius: 12, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                  {busy === "yearly" ? "Redirection…" : "Annuel — 99,90 €/an (2 mois offerts)"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 }}>
          {sent ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <svg style={{ margin: "0 auto 12px" }} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 6 }}>Tu es sur la liste !</p>
              <p style={{ fontSize: 13, color: "#555" }}>On te previent des que Pro est disponible.</p>
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 6 }}>Rejoins la liste d&apos;attente</h3>
              <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Sois parmi les premiers a acceder a Pro.</p>
              <form onSubmit={handleSubmit}>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton nom (optionnel)" style={{ width: "100%", padding: "12px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#f0f0f0", marginBottom: 10, outline: "none" }} />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ton email" style={{ width: "100%", padding: "12px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#f0f0f0", marginBottom: 14, outline: "none" }} />
                <button type="submit" disabled={sending || !email} style={{ width: "100%", padding: 14, background: "#C8FF00", color: "#0d0d0d", fontSize: 14, fontWeight: 600, borderRadius: 10, border: "none", cursor: "pointer", opacity: sending ? 0.6 : 1 }}>
                  {sending ? "Envoi..." : "Rejoindre la liste d'attente"}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <p style={{ textAlign: "center", fontSize: 11, color: "#444", marginTop: 20 }}>
        Des questions ? <Link href="mailto:pro@unkast.com" style={{ color: "#C8FF00", textDecoration: "none" }}>pro@unkast.com</Link>
      </p>
    </div>
  );
}
