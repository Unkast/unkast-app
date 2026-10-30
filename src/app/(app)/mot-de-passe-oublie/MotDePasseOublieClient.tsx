"use client";

import { useState } from "react";
import { EnterItem, EnterList } from "@/components/motion";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";

// Demande du lien de reinitialisation. Le message de confirmation est le meme que
// le compte existe ou non (la route ne le revele jamais).
export default function MotDePasseOublieClient() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("sending");
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Une erreur est survenue. Réessaie.");
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("Une erreur est survenue. Réessaie.");
      setState("idle");
    }
  }

  return (
    <EnterList className="mx-auto w-full max-w-sm px-4 py-10 sm:px-0 sm:py-20">
      <EnterItem>
        <h1 className="text-sheen pb-0.5 text-4xl font-bold tracking-tight">Mot de passe oublié</h1>
        <p className="mt-1.5 mb-6 text-sm text-text-secondary">
          Entre l&apos;email de ton compte : on t&apos;envoie un lien pour choisir un nouveau mot de passe.
        </p>
      </EnterItem>

      <EnterItem>
        <GlassCard radius="panel" className="p-5 sm:p-6">
          {state === "sent" ? (
            <div role="status">
              <p className="text-sm leading-relaxed text-text-primary">
                Si un compte existe avec l&apos;adresse <span className="break-all font-semibold text-lime">{email}</span>, tu vas recevoir un email avec un lien pour changer ton mot de passe.
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">
                Le lien est valable 1 heure. Pense à vérifier tes spams.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lucas@example.com"
              />
              {error && (
                <div role="alert" className="rounded-card border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              <Button type="submit" disabled={state === "sending"} className="w-full disabled:cursor-not-allowed">
                {state === "sending" ? "Envoi…" : "Recevoir le lien"}
              </Button>
            </form>
          )}
        </GlassCard>
      </EnterItem>

      <EnterItem className="mt-4">
        <Button variant="glass" href="/connexion" className="w-full text-center">
          Retour à la connexion
        </Button>
      </EnterItem>
    </EnterList>
  );
}
