"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { EnterItem, EnterList } from "@/components/motion";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";

export default function ConnexionClient({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  async function resendConfirmation() {
    if (!email || resendState === "sending") return;
    setResendState("sending");
    try {
      await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* réponse générique de toute façon */
    }
    setResendState("sent");
  }

  function getSupabase() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNeedsConfirm(false);
    setLoading(true);

    try {
      const { error: authError } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        const msg = authError.message.toLowerCase();
        if (msg.includes("not confirmed")) {
          // Compte non confirmé : message clair + bouton de renvoi.
          setNeedsConfirm(true);
          setError("Ton email n'est pas encore confirmé. Clique sur le lien reçu par email pour activer ton compte.");
        } else if (msg.includes("invalid login")) {
          setError("Email ou mot de passe incorrect.");
        } else {
          setError(authError.message);
        }
        return;
      }

      router.replace(next ?? "/feed");
      router.refresh();
    } catch {
      setError("Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");

    const { error: authError } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? "/dashboard")}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setGoogleLoading(false);
    }
  }

  return (
    <EnterList className="mx-auto w-full max-w-sm px-4 py-10 sm:px-0 sm:py-20">
      <EnterItem>
        <h1 className="text-sheen pb-0.5 text-4xl font-bold tracking-tight">Connexion</h1>
        <p className="mt-1.5 mb-6 text-sm text-text-secondary">
          Entre tes identifiants pour accéder à ton compte.
        </p>
      </EnterItem>

      <EnterItem>
        <GlassCard radius="panel" className="p-5 sm:p-6">
          {/* Google button */}
          <Button variant="glass" onClick={handleGoogle} disabled={googleLoading} className="w-full">
            <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleLoading ? "Redirection..." : "Continuer avec Google"}
          </Button>

          {/* Separator */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] text-text-tertiary">ou</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Email form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Field
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="lucas@example.com"
            />

            <Field
              label="Mot de passe"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ton mot de passe"
            />

            {error && (
              <div
                role="alert"
                className={`rounded-card border p-3 ${needsConfirm ? "border-yellow-500/30 bg-yellow-500/10" : "border-red-500/30 bg-red-500/10"}`}
              >
                <p className={`text-sm ${needsConfirm ? "text-yellow-400" : "text-red-400"}`}>{error}</p>
                {needsConfirm && (
                  resendState === "sent" ? (
                    <p className="mt-2 text-xs text-lime">Email renvoyé ✓ Pense à vérifier tes spams.</p>
                  ) : (
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={resendConfirmation}
                      disabled={resendState === "sending"}
                      className="mt-3"
                    >
                      {resendState === "sending" ? "Envoi…" : "Renvoyer l'email de confirmation"}
                    </Button>
                  )
                )}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full disabled:cursor-not-allowed">
              {loading ? "Connexion..." : "Se connecter avec email"}
            </Button>
          </form>
        </GlassCard>
      </EnterItem>

      {/* Create account CTA */}
      <EnterItem className="mt-4">
        <Button variant="glass" href="/rejoindre" className="w-full text-center">
          Je n&apos;ai pas de compte : créer un compte
        </Button>
      </EnterItem>
    </EnterList>
  );
}
