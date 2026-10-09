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
  /**
   * Cadre fixe en 16:9 : l'affiche y tient a son format reel, sans bandes ni fond.
   * Sans `framed`, l'appelant fixe la hauteur (classe h-*) et la largeur suit le format.
   */
  framed?: boolean;
  /** Avec `framed` : affiche centree (defaut) ou calee a gauche dans son cadre. */
  align?: "center" | "start";
  /** Vignette qui s'agrandit vers le lecteur : cle unique sur la page (voir FilmLink). */
  shareKey?: string;
  /** Affiche du lecteur de la page film : arrivee de la vignette cliquee. */
  player?: boolean;
  /** Rayon, bordure, ombre de l'affiche (et sa hauteur, sans `framed`). */
  className?: string;
  /** Bouton lecture ou cadenas. Jamais de texte ni de badge sur une affiche. */
  children?: ReactNode;
}

const FRAME = 16 / 9;
// Format d'une image deja vue (evite un saut de mise en page au retour sur une page).
const seenRatios = new Map<string, number>();
// Vignettes YouTube en 4:3 avec bandes noires integrees (hqdefault, sddefault, default) :
// recadrees en 16:9, ce qui retire exactement les bandes.
const YOUTUBE_LETTERBOXED = /(?:ytimg\.com|img\.youtube\.com)\/vi\/[^/]+\/(?:hq|sd)?default\.jpg/;

function knownRatio(src: string): number | undefined {
  return YOUTUBE_LETTERBOXED.test(src) ? FRAME : seenRatios.get(src);
}

// Affiche d'un film, toujours entiere et a son format reel (lu au chargement de
// l'image, 16:9 en attendant). Aucune bande, aucun fond de remplissage.
export default function FilmPoster({
  src, alt, sizes, priority = false, framed = false, align = "center", shareKey, player = false, className = "", children,
}: Props) {
  const [loaded, setLoaded] = useState<{ src: string; ratio: number } | null>(null);
  const active = useSyncExternalStore(subscribeFilmClick, () => shareKey != null && getActiveFilmKey() === shareKey, () => false);

  const ratio = (src ? knownRatio(src) ?? (loaded?.src === src ? loaded.ratio : undefined) : undefined) ?? FRAME;
  // Dans un cadre 16:9 : pleine largeur si l'image est plus large que le cadre, sinon pleine hauteur.
  const width = framed ? `${Math.min(1, ratio / FRAME) * 100}%` : undefined;

  let poster = (
    <div
      data-film-share={active ? "" : undefined}
      data-film-player={player ? "" : undefined}
      className={`relative shrink-0 overflow-hidden bg-glass-solid ${className}`}
      style={{ aspectRatio: ratio, width }}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (!naturalWidth || !naturalHeight || YOUTUBE_LETTERBOXED.test(src)) return;
            // Bornes : une image tres etroite ou tres large ne casse pas une rangee.
            const next = Math.min(2.6, Math.max(0.5, naturalWidth / naturalHeight));
            seenRatios.set(src, next);
            setLoaded({ src, ratio: next });
          }}
        />
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

  if (!framed) return poster;
  return (
    <div className={`flex aspect-video w-full items-center ${align === "start" ? "justify-start" : "justify-center"}`}>
      {poster}
    </div>
  );
}
