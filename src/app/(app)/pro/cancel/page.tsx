"use client";

import Link from "next/link";

// Retour après annulation du Checkout (aucun paiement effectué).
export default function ProCancelPage() {
  return (
    <div style={{ padding: "60px 16px", maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", marginBottom: 10, letterSpacing: "-0.5px" }}>Paiement annulé</h1>
      <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6, marginBottom: 24 }}>
        Aucun montant n&apos;a été débité. Tu peux réessayer quand tu veux.
      </p>
      <Link href="/pro" style={{ display: "inline-block", padding: "12px 24px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#f0f0f0", fontSize: 14, fontWeight: 600, borderRadius: 12, textDecoration: "none" }}>
        Revenir à Unkast Pro
      </Link>
    </div>
  );
}
