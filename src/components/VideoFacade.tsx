"use client";

import { useState } from "react";
import Image from "next/image";
import VideoEmbed from "@/components/VideoEmbed";

interface Props {
  url: string;
  title: string;
  /** Poster affiché avant le clic (poster_url ou preview_url du projet). */
  poster?: string | null;
  /** Classes ajoutées à la façade (rayon, bordure…). */
  className?: string;
}

// Façade vidéo : affiche un poster + bouton play, et ne monte le lecteur
// (react-player, chargé en dynamique) qu'au clic. Évite de monter N lecteurs
// simultanés sur une liste de projets (page profil) — gros gain de perf.
export default function VideoFacade({ url, title, poster, className = "" }: Props) {
  const [activated, setActivated] = useState(false);

  if (activated) {
    return <VideoEmbed url={url} title={title} autoplay />;
  }

  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      aria-label={`Lire la vidéo : ${title}`}
      className={`relative block aspect-video w-full cursor-pointer bg-white/[0.04] ${className}`}
    >
      {poster && (
        <Image
          src={poster}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 700px"
          loading="lazy"
          style={{ objectFit: "cover" }}
        />
      )}

      {/* Voile + bouton lecture en verre */}
      <span className="absolute inset-0 bg-black/25" />
      <span className="glass-strong absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill text-lime">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </button>
  );
}
