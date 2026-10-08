"use client";

import { useState } from "react";
import ReactPlayer from "react-player";
import { playerSrc, VIDEO_COOKIE_NOTICE } from "@/components/VideoEmbed";

interface Props {
  url: string;
}

// Rien ne part vers YouTube ni Vimeo avant le clic : le lecteur n'est monté
// qu'une fois la lecture demandée (l'image du film est affichée par le parent).
export default function HeroPlayer({ url }: Props) {
  const [playing, setPlaying] = useState(false);

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label="Lire la vidéo"
        className="absolute inset-0 flex h-full w-full cursor-pointer items-center justify-center"
      >
        <span className="glass-strong flex size-14 items-center justify-center rounded-pill text-lime">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="absolute inset-x-0 bottom-0 px-3 pb-2 text-left text-[11px] leading-snug text-white/80">
          {VIDEO_COOKIE_NOTICE}
        </span>
      </button>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactPlayer
        src={playerSrc(url)}
        width="100%"
        height="100%"
        playing
        muted
        loop
        style={{ position: "absolute", top: 0, left: 0 }}
      />
    </div>
  );
}
