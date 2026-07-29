"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

// Page de retour du lien de confirmation d'email (chantier confirmation email).
// Le lien (envoyé via Resend) pointe ici : /auth/confirm?token_hash=...&type=signup
// On appelle verifyOtp CÔTÉ NAVIGATEUR -> ça confirme l'email ET ouvre une session
// (cookies via @supabase/ssr) -> auto-login -> redirection /feed.
export default function ConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [resendEmail, setResendEmail] = useState("");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get("token_hash");
    const type = params.get("type") || "signup";

    if (!token_hash) {
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { error } = await supabase.auth.verifyOtp({
          type: type as "signup" | "email",
          token_hash,
        });
        if (error) {
          setStatus("error");
          return;
        }
        // Session posée -> auto-login. On laisse une seconde pour la lecture.
        setStatus("success");
        setTimeout(() => {
          router.replace("/feed");
          router.refresh();
        }, 1200);
      } catch {
        setStatus("error");
      }
    })();
  }, [router]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail) return;
    setResendState("sending");
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      setResendState(res.ok ? "sent" : "error");
    } catch {
      setResendState("error");
    }
  }

  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.5px", color: "#C8FF00", marginBottom: 24 }}>
          Unkast<span style={{ color: "#C8FF00" }}>.</span>
        </div>

        {status === "loading" && (
          <p style={{ fontSize: 15, color: "#aaa" }}>Activation de ton compte…</p>
        )}

        {status === "success" && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(200,255,0,0.1)", border: "1px solid rgba(200,255,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 }}>Compte activé !</h1>
            <p style={{ fontSize: 14, color: "#888" }}>Tu es connecté·e. Redirection vers l&apos;accueil…</p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 }}>Lien invalide ou expiré</h1>
            <p style={{ fontSize: 14, color: "#888", marginBottom: 20 }}>
              Ce lien de confirmation n&apos;est plus valide. Renvoie-toi un nouvel email pour activer ton compte.
            </p>

            {resendState === "sent" ? (
              <p style={{ fontSize: 14, color: "#C8FF00" }}>Email envoyé ! Vérifie ta boîte de réception.</p>
            ) : (
              <form onSubmit={handleResend} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="email"
                  required
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="ton@email.com"
                  style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#f0f0f0", fontSize: 15 }}
                />
                <button
                  type="submit"
                  disabled={resendState === "sending"}
                  style={{ padding: 13, background: "#C8FF00", color: "#0d0d0d", fontWeight: 700, fontSize: 14, borderRadius: 10, border: "none", cursor: "pointer", opacity: resendState === "sending" ? 0.6 : 1 }}
                >
                  {resendState === "sending" ? "Envoi…" : "Renvoyer l'email de confirmation"}
                </button>
                {resendState === "error" && (
                  <p style={{ fontSize: 13, color: "#ef4444" }}>Une erreur est survenue. Réessaie.</p>
                )}
              </form>
            )}

            <Link href="/connexion" style={{ display: "inline-block", marginTop: 18, fontSize: 13, color: "#666" }}>
              Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
