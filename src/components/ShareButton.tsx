"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";

interface Props {
  /** Titre transmis au partage natif (nom de la personne, titre du film). */
  title: string;
  label?: string;
  className?: string;
}

// Bouton « Partager » d'une fiche ou d'un film.
// Téléphone et app installée : feuille de partage du système (plugin @capacitor/share
// dans l'app, navigator.share dans un navigateur), copie du lien en repli.
// Ordinateur : copie du lien, et le bouton lui-même affiche une coche et « Lien
// copié » pendant 2 s (aucune bulle au-dessus des boutons voisins).
export default function ShareButton({ title, label = "Partager", className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function share() {
    const url = window.location.href;
    const handheld =
      window.matchMedia("(pointer: coarse)").matches || document.documentElement.classList.contains("app-installed");

    if (handheld) {
      try {
        // App Android : la WebView n'a pas navigator.share, le plugin ouvre la feuille
        // de partage du systeme. Charge a la demande, comme les autres plugins.
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { Share } = await import("@capacitor/share");
          await Share.share({ title, url });
          return;
        }
        if (typeof navigator.share === "function") {
          await navigator.share({ title, url });
          return;
        }
      } catch (error) {
        // Partage refermé sans rien choisir : on ne copie pas à la place.
        const reason = error instanceof Error ? `${error.name} ${error.message}` : "";
        if (/abort|cancel/i.test(reason)) return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) : rien à annoncer.
    }
  }

  return (
    <Button variant="glass" onClick={share} className={className} aria-live="polite">
      {copied ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-lime"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          Lien copié
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" /></svg>
          {label}
        </>
      )}
    </Button>
  );
}
