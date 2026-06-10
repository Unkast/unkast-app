"use client";

import { useState } from "react";
import Image from "next/image";
import VideoEmbed from "@/components/VideoEmbed";

interface Props {
  url: string;
  title: string;
  /** Poster affiché avant le clic (poster_url ou preview_url du projet). */
  poster?: string | null;
}

// Façade vidéo : affiche un poster + bouton play, et ne monte le lecteur
// (react-player, chargé en dynamique) qu'au clic. Évite de monter N lecteurs
// simultanés sur une liste de projets (page profil) — gros gain de perf.
export default function VideoFacade({ url, title, poster }: Props) {
  const [activated, setActivated] = useState(false);

  if (activated) {
    return <VideoEmbed url={url} title={title} autoplay />;
  }

  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      aria-label={`Lire la vidéo : ${title}`}
      className="relative w-full block bg-card group"
      style={{ aspectRatio: "16 / 9", border: "none", padding: 0, cursor: "pointer" }}
    >
      {poster ? (
        <Image
          src={poster}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 700px"
          loading="lazy"
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div
          style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a1a" }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#C8FF00" style={{ opacity: 0.15 }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}

      {/* Overlay + bouton play */}
      <span style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", transition: "background 0.2s" }} />
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(13,13,13,0.7)",
          border: "1px solid rgba(200,255,0,0.3)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#C8FF00">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </button>
  );
}
