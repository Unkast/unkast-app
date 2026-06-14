"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Page de retour après un paiement Checkout réussi. PUREMENT informative :
// l'activation du Pro est faite par le webhook, pas par cette page.
export default function ProSuccessPage() {
  const router = useRouter();

  // Le plan est lu au montage des pages via le profil ; on rafraîchit après un
  // court délai pour laisser le webhook poser plan='pro'.
  useEffect(() => {
    const t = setTimeout(() => router.refresh(), 3000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div style={{ padding: "60px 16px", maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", marginBottom: 10, letterSpacing: "-0.5px" }}>Paiement reçu</h1>
      <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6, marginBottom: 24 }}>
        Ton abonnement Unkast Pro est en cours d&apos;activation (quelques secondes). Tu peux déjà retourner sur ton espace.
      </p>
      <Link href="/moi" style={{ display: "inline-block", padding: "12px 24px", background: "#C8FF00", color: "#0d0d0d", fontSize: 14, fontWeight: 600, borderRadius: 12, textDecoration: "none" }}>
        Retour à mon espace
      </Link>
    </div>
  );
}
