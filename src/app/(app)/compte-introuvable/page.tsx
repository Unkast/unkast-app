"use client";

import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Compte Auth sans ligne `profiles` (orphelin) — cible du fail-closed de
// src/lib/supabase/middleware.ts sur PGRST116 (voir aussi lib/auth-guard.ts,
// meme diagnostic cote API). Etat PERMANENT, pas de fetch dynamique possible :
// il n'y a litteralement aucune ligne profiles a lire (contrairement a
// /suspended, qui affiche suspended_reason via /api/me).
export default function CompteIntrouvablePage() {
  const router = useRouter();

  async function handleSignOut() {
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await sb.auth.signOut();
    router.replace("/");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", marginBottom: 12 }}>Compte introuvable</h1>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, marginBottom: 16 }}>
          Ton compte existe mais son profil n&apos;a pas pu etre cree. Ce n&apos;est pas grave, mais on doit intervenir manuellement pour le reparer.
        </p>
        <p style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>
          Ecris-nous a <Link href="mailto:pro@unkast.com" style={{ color: "#C8FF00", textDecoration: "none" }}>pro@unkast.com</Link> pour qu&apos;on repare ton acces.
        </p>
        <p style={{ fontSize: 12, color: "#555", marginBottom: 24 }}>
          Si tu t&apos;es inscrit avec Google, te deconnecter puis te reconnecter peut suffire a reparer ton acces.
        </p>
        <button
          onClick={handleSignOut}
          style={{ padding: "12px 24px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, color: "#ef4444", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          Se deconnecter
        </button>
      </div>
    </div>
  );
}
