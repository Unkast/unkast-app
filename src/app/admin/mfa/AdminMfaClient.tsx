"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";

type Step =
  | { name: "loading" }
  // Aucun facteur : rien n'est cree tant que la personne ne le demande pas.
  | { name: "setup" }
  // Premiere connexion : QR code a scanner dans l'application d'authentification.
  | { name: "enroll"; factorId: string; qr: string; secret: string }
  // Connexions suivantes : code a 6 chiffres.
  | { name: "challenge"; factorId: string };

export default function AdminMfaClient({ next }: { next: string }) {
  const [supabase] = useState(() =>
    createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  );
  const [step, setStep] = useState<Step>({ name: "loading" });
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    // Une seule fois (le mode strict de React rejoue les effets en developpement).
    if (started.current) return;
    started.current = true;
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError || !data) {
        setError("Impossible de lire la double authentification. Recharge la page.");
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) {
        setStep({ name: "challenge", factorId: verified.id });
        return;
      }
      // Inscription abandonnee en route : on repart d'un facteur neuf.
      for (const factor of data.all.filter((f) => f.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      setStep({ name: "setup" });
    })();
  }, [supabase]);

  async function enroll() {
    setError("");
    setChecking(true);
    const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Unkast admin" });
    setChecking(false);
    if (enrollError || !enrolled) {
      setError(enrollError?.message ?? "Impossible de préparer la double authentification.");
      return;
    }
    setStep({ name: "enroll", factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (step.name === "loading" || step.name === "setup") return;
    setError("");
    setChecking(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: step.factorId, code: code.trim() });
    if (verifyError) {
      setError("Code incorrect ou expiré.");
      setChecking(false);
      return;
    }
    // Navigation complete : le proxy et la garde serveur relisent la session (aal2).
    window.location.assign(next);
  }

  async function signOut() {
    await supabase.auth.signOut();
    await fetch("/api/logout", { method: "POST" });
    window.location.assign("/admin/connexion");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-sheen pb-0.5 text-3xl font-bold tracking-tight">Double authentification</h1>
      <p className="mt-1.5 mb-6 text-sm text-text-secondary">
        {step.name === "setup"
          ? "L'administration demande un second facteur. Configure-le une fois avec une application d'authentification (Google Authenticator, 1Password, Authy)."
          : step.name === "enroll"
          ? "Scanne ce QR code avec ton application d'authentification, puis saisis le code affiché."
          : "Saisis le code à 6 chiffres de ton application d'authentification."}
      </p>
      <GlassCard radius="panel" className="p-5 sm:p-6">
        {step.name === "loading" && !error && <p className="text-sm text-text-secondary">Chargement...</p>}
        {step.name === "enroll" && (
          <div className="mb-5 flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={step.qr} alt="QR code de double authentification" width={184} height={184} className="rounded-card bg-white p-2" />
            <p className="break-all text-center font-mono text-xs text-text-secondary">Saisie manuelle : {step.secret}</p>
          </div>
        )}
        {step.name === "setup" && (
          <Button onClick={enroll} disabled={checking} className="w-full disabled:cursor-not-allowed">
            Configurer la double authentification
          </Button>
        )}
        {(step.name === "enroll" || step.name === "challenge") && (
          <form onSubmit={verify} className="space-y-4">
            <Field
              label="Code à 6 chiffres"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <Button type="submit" disabled={checking || code.length !== 6} className="w-full disabled:cursor-not-allowed">
              {checking ? "Vérification..." : "Valider"}
            </Button>
          </form>
        )}
        {error && (
          <div role="alert" className="mt-4 rounded-card border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </GlassCard>
      <button type="button" onClick={signOut} className="mt-5 text-center text-sm text-text-secondary underline-offset-4 hover:underline">
        Se déconnecter
      </button>
    </main>
  );
}
