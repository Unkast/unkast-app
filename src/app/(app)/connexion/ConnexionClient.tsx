"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { EnterItem, EnterList } from "@/components/motion";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";
import LegalLinks from "@/components/LegalLinks";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function ConnexionClient({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
          {/* Google : bouton officiel sur le web, sélecteur de comptes natif dans l'app */}
          <GoogleSignInButton next={next} onError={(message) => { setNeedsConfirm(false); setError(message); }} />

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

      <EnterItem className="mt-6">
        <LegalLinks className="justify-center" />
      </EnterItem>
    </EnterList>
  );
}
