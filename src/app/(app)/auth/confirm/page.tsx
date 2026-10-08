"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { EnterItem, EnterList } from "@/components/motion";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";

const TITLE = "text-sheen pb-0.5 text-[26px] font-bold tracking-tight";

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
    <EnterList className="flex min-h-[70vh] items-center justify-center px-4 py-6">
      <EnterItem className="w-full max-w-[420px]">
        <GlassCard radius="panel" className="px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mb-6 text-xl font-bold tracking-tight text-lime">Unkast.</div>

          {status === "loading" && (
            <div role="status">
              <div className="mx-auto mb-5 size-16 animate-pulse rounded-card border border-white/10 bg-white/10" />
              <p className="text-[15px] text-text-secondary">Activation de ton compte…</p>
            </div>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-card border border-lime/30 bg-lime/10 shadow-[0_0_24px_rgba(200,255,0,0.2)]">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
              </div>
              <h1 className={TITLE}>Compte activé !</h1>
              <p className="mt-2 text-sm text-text-secondary">Tu es connecté·e. Redirection vers l&apos;accueil…</p>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className={TITLE}>Lien invalide ou expiré</h1>
              <p className="mt-2 mb-5 text-sm text-text-secondary">
                Ce lien de confirmation n&apos;est plus valide. Renvoie-toi un nouvel email pour activer ton compte.
              </p>

              {resendState === "sent" ? (
                <p className="text-sm text-lime" role="status">Email envoyé ! Vérifie ta boîte de réception.</p>
              ) : (
                <form onSubmit={handleResend} className="flex flex-col gap-3 text-left">
                  <Field
                    aria-label="Email"
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="ton@email.com"
                  />
                  <Button type="submit" disabled={resendState === "sending"} className="w-full text-center">
                    {resendState === "sending" ? "Envoi…" : "Renvoyer l'email de confirmation"}
                  </Button>
                  {resendState === "error" && (
                    <p className="text-center text-[13px] text-red-400" role="alert">Une erreur est survenue. Réessaie.</p>
                  )}
                </form>
              )}

              <div className="mt-4">
                <Button variant="glass" size="sm" href="/connexion">Retour à la connexion</Button>
              </div>
            </>
          )}
        </GlassCard>
      </EnterItem>
    </EnterList>
  );
}
