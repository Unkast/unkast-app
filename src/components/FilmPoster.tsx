"use client";

import { ViewTransition, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { FILM_POSTER_NAME, FILM_SHARE_CLASS, getActiveFilmKey, subscribeFilmClick } from "@/lib/film-transition";

interface Props {
  src?: string | null;
  alt: string;
  /** Attribut sizes de l'image (largeur affichee). */
  sizes: string;
  priority?: boolean;
  /** Le cadre prend toute la largeur de son conteneur. Sinon l'appelant fixe la hauteur (classe h-*). */
  framed?: boolean;
  /** Vignette qui s'agrandit vers le lecteur : cle unique sur la page (voir FilmLink). */
  shareKey?: string;
  /** Affiche du lecteur de la page film : arrivee de la vignette cliquee. */
  player?: boolean;
  /** Rayon, bordure, ombre du cadre (et sa hauteur, sans `framed`). */
  className?: string;
  /** Bouton lecture ou cadenas. Jamais de texte ni de badge sur une affiche. */
  children?: ReactNode;
}

const FRAME = 16 / 9;
// Format d'une image deja vue (evite un changement d'affichage au retour sur une page).
const seenRatios = new Map<string, number>();
// Vignettes YouTube en 4:3 avec bandes noires integrees (hqdefault, sddefault, default) :
// recadrees en 16:9, ce qui retire exactement les bandes.
const YOUTUBE_LETTERBOXED = /(?:ytimg\.com|img\.youtube\.com)\/vi\/[^/]+\/(?:hq|sd)?default\.jpg/;

// Affiche d'un film dans un cadre toujours 16:9 : toutes les cartes d'une rangee ont la
// meme taille. Une image 16:9 remplit le cadre. Un autre format est montre en entier,
// jamais rogne, les espaces combles par la meme image floutee et assombrie.
export default function FilmPoster({
  src, alt, sizes, priority = false, framed = false, shareKey, player = false, className = "", children,
}: Props) {
  const [loaded, setLoaded] = useState<{ src: string; ratio: number } | null>(null);
  const active = useSyncExternalStore(subscribeFilmClick, () => shareKey != null && getActiveFilmKey() === shareKey, () => false);

  const letterboxed = src ? YOUTUBE_LETTERBOXED.test(src) : false;
  const ratio = src && !letterboxed ? seenRatios.get(src) ?? (loaded?.src === src ? loaded.ratio : undefined) : undefined;
  // Format pas encore connu : image entiere (identique au remplissage pour une image 16:9).
  // A 3 % pres du 16:9, on remplit le cadre plutot que de laisser un filet sur un bord.
  const fills = letterboxed || (ratio != null && Math.abs(ratio / FRAME - 1) < 0.03);

  let poster = (
    <div
      data-film-share={active ? "" : undefined}
      data-film-player={player ? "" : undefined}
      className={`relative aspect-video shrink-0 overflow-hidden bg-glass-solid ${framed ? "w-full" : ""} ${className}`}
    >
      {src ? (
        <>
          {/* Fond des espaces vides : la meme image, demandee en petit (le flou n'a pas
              besoin de definition), agrandie, floutee et assombrie. Decorative. */}
          {ratio != null && !fills && (
            <Image src={src} alt="" fill sizes="96px" aria-hidden="true" className="scale-125 object-cover blur-xl brightness-50" />
          )}
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            className={fills ? "object-cover" : "object-contain"}
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              if (!naturalWidth || !naturalHeight || letterboxed) return;
              const next = naturalWidth / naturalHeight;
              seenRatios.set(src, next);
              setLoaded({ src, ratio: next });
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="size-1/6 text-lime opacity-15" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
      {children}
    </div>
  );

  // Seule la vignette cliquee (ou le lecteur) porte le nom de transition ; les autres
  // affiches ne s'animent pas (fondu de la page).
  if (shareKey != null || player) {
    const named = player || active;
    poster = (
      <ViewTransition name={named ? FILM_POSTER_NAME : undefined} default="none" share={named ? FILM_SHARE_CLASS : "none"}>
        {poster}
      </ViewTransition>
    );
  }

  return poster;
}
