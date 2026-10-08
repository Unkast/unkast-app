"use client";

import dynamic from "next/dynamic";
import { extractVideoKey } from "@/lib/utils";

// react-player est lourd : on le charge en dynamique (hors bundle initial).
// Le chunk n'est téléchargé que lorsque ce composant est réellement monté
// (modale projet ouverte, ou façade vidéo activée au clic).
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

// Mention affichée avant le clic, partout où une vidéo peut être lancée.
export const VIDEO_COOKIE_NOTICE = "En lançant la vidéo, YouTube ou Vimeo peut déposer des cookies.";

// YouTube : on passe l'adresse du domaine sans cookies. youtube-video-element
// (le lecteur YouTube de react-player 3) sert l'iframe depuis
// www.youtube-nocookie.com dès que la source contient « -nocookie ».
// Le point de départ (?t=) est conservé. Vimeo : adresse inchangée.
export function playerSrc(url: string): string {
  const key = extractVideoKey(url);
  if (!key?.startsWith("youtube:")) return url;
  const start = url.match(/[?&]t=([\dms]+)/i);
  return `https://www.youtube-nocookie.com/embed/${key.slice(8)}${start ? `?t=${start[1]}` : ""}`;
}

interface Props {
  url: string;
  title: string;
  /** Démarre la lecture immédiatement (ex. après un clic sur une façade / ouverture de modale). */
  autoplay?: boolean;
}

// À ne monter qu'après un clic : dès qu'il est monté, le lecteur contacte
// YouTube ou Vimeo. Avant le clic, afficher une image (voir VideoFacade).
export default function VideoEmbed({ url, title, autoplay = false }: Props) {
  // Pas de fond avant le chargement du lecteur : le conteneur reste transparent
  // (ssr: false suffit, rien n'est rendu cote serveur).
  return (
    <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
      <ReactPlayer
        src={playerSrc(url)}
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
