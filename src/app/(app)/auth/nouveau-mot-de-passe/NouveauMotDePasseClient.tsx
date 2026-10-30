"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EnterItem, EnterList } from "@/components/motion";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import PasswordFields from "@/components/PasswordFields";
import { passwordError } from "@/lib/password";

const TITLE = "text-sheen pb-0.5 text-[26px] font-bold tracking-tight";

// Retour du lien « mot de passe oublie » : /auth/nouveau-mot-de-passe?token_hash=...
// (jeton lu par page.tsx). verifyOtp(recovery) cote navigateur ouvre la session (cookies @supabase/ssr), puis
// le nouveau mot de passe part a /api/auth/update-password, qui refait le controle.
export default function NouveauMotDePasseClient({ tokenHash }: { tokenHash: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "invalid" | "done">(tokenHash ? "loading" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Le jeton ne sert qu'une fois : pas de second appel (double effet en dev).
  const verified = useRef(false);

  useEffect(() => {
    if (!tokenHash || verified.current) return;
    verified.current = true;
    createClient()
      .auth.verifyOtp({ type: "recovery", token_hash: tokenHash })
      .then(({ error }) => setStatus(error ? "invalid" : "ready"))
      .catch(() => setStatus("invalid"));
  }, [tokenHash]);

  const canSubmit = !passwordError(password) && password === confirm && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Enregistrement impossible. Réessaie dans un instant.");
        return;
      }
      setStatus("done");
      setTimeout(() => {
        router.replace("/feed");
        router.refresh();
      }, 1200);
    } catch {
      setError("Enregistrement impossible. Réessaie dans un instant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EnterList className="flex min-h-[70vh] items-center justify-center px-4 py-6">
      <EnterItem className="w-full max-w-[420px]">
        <GlassCard radius="panel" className="px-5 py-8 sm:px-8 sm:py-10">
          <div className="mb-6 text-center text-xl font-bold tracking-tight text-lime">Unkast.</div>

          {status === "loading" && (
            <div role="status" className="text-center">
              <div className="mx-auto mb-5 size-16 animate-pulse rounded-card border border-white/10 bg-white/10" />
              <p className="text-[15px] text-text-secondary">Vérification du lien…</p>
            </div>
          )}

          {status === "ready" && (
            <>
              <h1 className={`${TITLE} text-center`}>Nouveau mot de passe</h1>
              <p className="mt-2 mb-6 text-center text-sm text-text-secondary">Choisis ton nouveau mot de passe.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <PasswordFields
                  label="Nouveau mot de passe"
                  password={password}
                  confirm={confirm}
                  onPasswordChange={setPassword}
                  onConfirmChange={setConfirm}
                />
                {error && (
                  <div role="alert" className="rounded-card border border-red-500/30 bg-red-500/10 p-3">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}
                <Button type="submit" disabled={!canSubmit} className="w-full disabled:cursor-not-allowed">
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </form>
            </>
          )}

          {status === "done" && (
            <div role="status" className="text-center">
              <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-card border border-lime/30 bg-lime/10 shadow-[0_0_24px_rgba(200,255,0,0.2)]">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
              </div>
              <h1 className={TITLE}>Mot de passe changé</h1>
              <p className="mt-2 text-sm text-text-secondary">Tu es connecté·e. Redirection vers l&apos;accueil…</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="text-center">
              <h1 className={TITLE}>Lien invalide ou expiré</h1>
              <p className="mt-2 mb-5 text-sm text-text-secondary">
                Ce lien n&apos;est plus valable. Demande un nouveau lien pour changer ton mot de passe.
              </p>
              <Button href="/mot-de-passe-oublie" className="w-full text-center">Demander un nouveau lien</Button>
              <div className="mt-4">
                <Button variant="glass" size="sm" href="/connexion">Retour à la connexion</Button>
              </div>
            </div>
          )}
        </GlassCard>
      </EnterItem>
    </EnterList>
  );
}
