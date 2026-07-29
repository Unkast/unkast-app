"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";

export default function ConnexionClient() {
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

      router.replace("/feed");
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
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (authError) {
      setError(authError.message);
      setGoogleLoading(false);
    }
  }

  const inputClass =
    "w-full px-4 py-3 bg-white/[0.03] border border-white/5 rounded-xl text-text-primary text-base placeholder:text-text-tertiary focus:outline-none focus:border-lime/50 transition";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="pb-16 lg:pb-0">
        <main className="max-w-sm mx-auto w-full px-4 sm:px-6 py-12 sm:py-20">
          <h1 className="text-2xl font-extrabold tracking-tight text-text-primary mb-1">
            Connexion
          </h1>
          <p className="text-sm text-text-secondary mb-8">
            Entre tes identifiants pour accéder à ton compte.
          </p>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 bg-[#1a1a1a] text-[#f0f0f0] font-semibold text-sm rounded-lg border border-white/[0.12] hover:border-white/25 transition disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleLoading ? "Redirection..." : "Continuer avec Google"}
          </button>

          {/* Separator */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[11px] text-text-tertiary">ou</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Email form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="lucas@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Ton mot de passe"
              />
            </div>

            {error && (
              <div className={`p-3 rounded-lg ${needsConfirm ? "bg-[rgba(255,180,0,0.08)] border border-[rgba(255,180,0,0.3)]" : "bg-red-500/10 border border-red-500/30"}`}>
                <p className={`text-sm ${needsConfirm ? "text-[#e0b020]" : "text-red-400"}`}>{error}</p>
                {needsConfirm && (
                  resendState === "sent" ? (
                    <p className="text-xs text-lime mt-2">Email renvoyé ✓ Pense à vérifier tes spams.</p>
                  ) : (
                    <button
                      type="button"
                      onClick={resendConfirmation}
                      disabled={resendState === "sending"}
                      className="mt-2 text-xs font-semibold text-lime underline disabled:opacity-50"
                    >
                      {resendState === "sending" ? "Envoi…" : "Renvoyer l'email de confirmation"}
                    </button>
                  )
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-lime text-[#0d0d0d] font-bold text-sm rounded-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Connexion..." : "Se connecter avec email"}
            </button>
          </form>

          {/* Separator */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Create account CTA */}
          <Link
            href="/rejoindre"
            className="block w-full py-3 text-center border border-white/10 text-[#f0f0f0] text-sm font-semibold rounded-lg hover:border-lime/30 hover:text-lime transition"
          >
            Je n&apos;ai pas de compte — Créer un compte
          </Link>
        </main>
      </div>
    </motion.div>
  );
}
