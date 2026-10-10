"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

// Connexion Google, sans passer par l'adresse du projet Supabase.
//
//   - Navigateur : bouton officiel « Sign in with Google » (Google Identity
//     Services), rendu par Google. Le jeton recu ouvre la session avec
//     supabase.auth.signInWithIdToken.
//   - App Android (Capacitor) : selecteur de comptes natif (plugin SocialLogin),
//     meme jeton, meme suite. L'utilisateur ne quitte jamais l'app. Un ancien APK
//     sans le plugin n'affiche pas de bouton Google.
//   - NEXT_PUBLIC_GOOGLE_CLIENT_ID absent : ancien flux par redirection
//     (signInWithOAuth puis /auth/callback), tant que la configuration Google
//     n'est pas faite.
//
// Dans tous les cas, POST /api/auth/google (ou /auth/callback) cree le profil
// minimal a la premiere connexion et envoie vers la finalisation.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
// hl=fr : langue du bouton imposee au chargement du script (sinon celle du navigateur).
const GIS_SRC = "https://accounts.google.com/gsi/client?hl=fr";

type GoogleId = {
  initialize(options: { client_id: string; callback: (response: { credential?: string }) => void; nonce?: string; use_fedcm_for_prompt?: boolean }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
};
type GoogleWindow = Window & { google?: { accounts?: { id?: GoogleId } } };

const googleId = () => (window as GoogleWindow).google?.accounts?.id;

function loadGis(): Promise<void> {
  if (googleId()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const script = existing ?? Object.assign(document.createElement("script"), { src: GIS_SRC, async: true });
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("gis")));
    if (!existing) document.head.appendChild(script);
  });
}

// Nonce : Google recoit son empreinte SHA-256, Supabase la valeur d'origine et
// compare. Sans crypto.subtle (page servie en http hors localhost), pas de nonce.
async function makeNonce(): Promise<{ raw: string; hashed: string } | null> {
  if (!window.crypto?.subtle) return null;
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

const LOGO = (
  <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

interface Props {
  /** Page où aller après la connexion (chemin interne). */
  next?: string;
  /** Version des CGU cochée avant le clic (inscription) : enregistrée à la création du profil. */
  terms?: string;
  /** Case des CGU non cochée : le bouton reste visible mais inactif. */
  disabled?: boolean;
  onError: (message: string) => void;
}

type Mode = "pending" | "web" | "native" | "redirect" | "none";

export default function GoogleSignInButton({ next = "/feed", terms, disabled = false, onError }: Props) {
  const [mode, setMode] = useState<Mode>("pending");
  const [busy, setBusy] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  // Le jeton Google ouvre la session, puis le serveur dit où aller.
  async function finish(token: string, nonce: string | undefined) {
    const { next, terms, onError } = latest.current;
    setBusy(true);
    try {
      const { error } = await createClient().auth.signInWithIdToken({ provider: "google", token, nonce });
      if (error) throw error;
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next, terms }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.redirect !== "string") throw new Error("landing");
      // Rechargement complet : le serveur lit la nouvelle session.
      window.location.assign(data.redirect);
    } catch (e) {
      console.error("[google] connexion:", e);
      onError("La connexion avec Google a échoué. Réessaie.");
      setBusy(false);
    }
  }

  const latest = useRef({ next, terms, disabled, onError, finish });
  useEffect(() => { latest.current = { next, terms, disabled, onError, finish }; });

  // Choix du chemin, côté navigateur uniquement (Capacitor n'existe pas au rendu serveur).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (cancelled) return;
      if (Capacitor.isNativePlatform()) {
        setMode(CLIENT_ID && Capacitor.isPluginAvailable("SocialLogin") ? "native" : "none");
      } else {
        setMode(CLIENT_ID ? "web" : "redirect");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Navigateur : bouton officiel, sombre, en pilule, à la largeur du conteneur.
  useEffect(() => {
    if (mode !== "web" || !CLIENT_ID) return;
    let cancelled = false;
    (async () => {
      try {
        const [nonce] = await Promise.all([makeNonce(), loadGis()]);
        const id = googleId();
        if (cancelled || !id || !holder.current) return;
        id.initialize({
          client_id: CLIENT_ID,
          nonce: nonce?.hashed,
          use_fedcm_for_prompt: true,
          callback: ({ credential }) => {
            if (credential && !latest.current.disabled) latest.current.finish(credential, nonce?.raw);
          },
        });
        id.renderButton(holder.current, {
          type: "standard",
          theme: "filled_black",
          shape: "pill",
          size: "large",
          text: "signin_with",
          logo_alignment: "center",
          locale: "fr",
          width: Math.max(200, Math.min(400, holder.current.offsetWidth)),
        });
      } catch {
        if (!cancelled) latest.current.onError("Le bouton Google n'a pas pu se charger. Recharge la page ou connecte-toi par email.");
      }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  // App Android : sélecteur de comptes natif.
  async function nativeSignIn() {
    setBusy(true);
    try {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      const nonce = await makeNonce();
      await SocialLogin.initialize({ google: { webClientId: CLIENT_ID } });
      const { result } = await SocialLogin.login({ provider: "google", options: { nonce: nonce?.hashed } });
      const token = "idToken" in result ? result.idToken : null;
      if (!token) throw new Error("no_id_token");
      await finish(token, nonce?.raw);
    } catch (e) {
      setBusy(false);
      // Sélecteur fermé sans choisir de compte : rien à signaler.
      if (/cancel/i.test(e instanceof Error ? e.message : String(e))) return;
      console.error("[google] connexion native:", e);
      latest.current.onError("La connexion avec Google a échoué. Réessaie.");
    }
  }

  // Ancien flux par redirection (configuration Google pas encore faite).
  async function redirectSignIn() {
    setBusy(true);
    const query = new URLSearchParams({ next, ...(terms ? { terms } : {}) });
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?${query}` },
    });
    if (error) {
      onError(error.message);
      setBusy(false);
    }
  }

  if (mode === "none") return null;

  if (mode === "web") {
    return (
      // Bouton rendu par Google dans un cadre : il ne se désactive pas, on le rend inerte.
      <div
        ref={holder}
        inert={disabled || busy}
        className={`flex min-h-11 justify-center [color-scheme:light] transition-opacity duration-fast ${disabled || busy ? "pointer-events-none opacity-50" : ""}`}
      />
    );
  }

  return (
    <Button
      variant="glass"
      onClick={mode === "native" ? nativeSignIn : redirectSignIn}
      disabled={mode === "pending" || disabled || busy}
      className="w-full"
    >
      {LOGO}
      {busy ? "Connexion..." : "Se connecter avec Google"}
    </Button>
  );
}
