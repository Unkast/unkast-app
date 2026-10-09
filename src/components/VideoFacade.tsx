"use client";

import { useState } from "react";
import FilmPoster from "@/components/FilmPoster";
import VideoEmbed, { VIDEO_COOKIE_NOTICE } from "@/components/VideoEmbed";

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
    <>
    <button
      type="button"
      onClick={() => setActivated(true)}
      aria-label={`Lire la vidéo : ${title}`}
      className={`block w-full cursor-pointer overflow-hidden ${className}`}
    >
      {/* Cadre 16:9 (celui du lecteur) : affiche entière, voile + bouton lecture en verre */}
      <FilmPoster src={poster} alt={title} sizes="(max-width: 768px) 100vw, 700px" framed>
        <span className="absolute inset-0 bg-black/25" />
        <span className="glass-strong absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill text-lime">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </FilmPoster>
    </button>
    {/* Mention cookies, visible avant le clic : sous la vignette, jamais dessus */}
    <p className="px-3 pt-2 text-left text-[11px] leading-snug text-text-tertiary">{VIDEO_COOKIE_NOTICE}</p>
    </>
  );
}
