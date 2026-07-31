"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function SuspendedPage() {
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    // suspended_reason est revoque pour anon/authenticated : lecture via la
    // route serveur, qui authentifie et repond 401 si personne n'est connecte
    // (meme comportement qu'avant : redirection vers l'accueil).
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (res.status === 401) { router.replace("/"); return; }
        if (!res.ok) return;
        const data = await res.json();
        setReason(data.suspended_reason || null);
      } catch {}
    })();
  }, [router]);

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
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", marginBottom: 12 }}>Compte suspendu</h1>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, marginBottom: 16 }}>
          Ton compte a ete suspendu suite a une violation de nos conditions d&apos;utilisation.
        </p>
        {reason && (
          <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#ef4444" }}>Raison : {reason}</p>
          </div>
        )}
        <p style={{ fontSize: 12, color: "#555", marginBottom: 24 }}>
          Pour contester cette decision, contacte-nous a <span style={{ color: "#C8FF00" }}>contact@unkast.com</span>
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
