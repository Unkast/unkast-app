"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// react-player est lourd : on le charge en dynamique (hors bundle initial).
// Le chunk n'est téléchargé que lorsque ce composant est réellement monté
// (modale projet ouverte, ou façade vidéo activée au clic).
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

interface Props {
  url: string;
  title: string;
  /** Démarre la lecture immédiatement (ex. après un clic sur une façade / ouverture de modale). */
  autoplay?: boolean;
}

export default function VideoEmbed({ url, title, autoplay = false }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="relative w-full bg-card" style={{ aspectRatio: "16 / 9" }} />;
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
      <ReactPlayer
        src={url}
        width="100%"
        height="100%"
        controls
        light={!autoplay}
        playing={autoplay}
        style={{ position: "absolute", top: 0, left: 0 }}
        previewAriaLabel={`Video: ${title}`}
      />
    </div>
  );
}
