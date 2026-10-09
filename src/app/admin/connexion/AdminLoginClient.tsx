"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import GlassCard from "@/components/ui/GlassCard";
import { VIEW_COOKIE } from "@/lib/adminSession";

export default function AdminLoginClient({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Une vue « visiteur » restee ouverte n'a plus lieu d'etre a la connexion.
  useEffect(() => {
    document.cookie = `${VIEW_COOKIE}=; path=/; max-age=0`;
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message.toLowerCase().includes("invalid login") ? "Email ou mot de passe incorrect." : authError.message);
        setLoading(false);
        return;
      }
      // Navigation complete : le proxy verifie le compte et envoie vers la double authentification.
      window.location.assign(`/admin/mfa?next=${encodeURIComponent(next)}`);
    } catch {
      setError("Erreur de connexion.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-sheen pb-0.5 text-3xl font-bold tracking-tight">Administration</h1>
      <p className="mt-1.5 mb-6 text-sm text-text-secondary">Compte admin uniquement. Email, mot de passe, puis code à 6 chiffres.</p>
      <GlassCard radius="panel" className="p-5 sm:p-6">
        <form onSubmit={handleLogin} className="space-y-4">
          <Field label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Mot de passe" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && (
            <div role="alert" className="rounded-card border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full disabled:cursor-not-allowed">
            {loading ? "Connexion..." : "Continuer"}
          </Button>
        </form>
      </GlassCard>
    </main>
  );
}
