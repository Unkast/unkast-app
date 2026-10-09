"use client";

import { ViewTransition, useLayoutEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FILM_POSTER_NAME, FILM_SHARE_CLASS, markFilmClick, takeSavedScroll } from "@/lib/film-transition";

interface FilmLinkProps {
  slug: string;
  /** Cle de la vignette (unique sur la page) qui s'agrandit vers le lecteur : la meme que son FilmPoster. */
  shareKey?: string;
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
}

// Lien vers la page d'un film : marque la vignette cliquee (transition partagee)
// et precharge la page au survol.
export default function FilmLink({ slug, shareKey, className, children, ...rest }: FilmLinkProps) {
  const router = useRouter();
  const href = `/projet/${slug}`;
  return (
    <Link
      href={href}
      className={className}
      onClick={() => { if (shareKey) markFilmClick(shareKey); }}
      onMouseEnter={() => router.prefetch(href)}
      {...rest}
    >
      {children}
    </Link>
  );
}

// Cadre du lecteur en cours de lecture et de son squelette : arrivee de la vignette.
// Avant la lecture, c'est l'affiche elle-meme qui porte le nom (FilmPoster player).
export function FilmPlayerFrame({ children }: { children: ReactNode }) {
  return (
    <ViewTransition name={FILM_POSTER_NAME} default="none" share={FILM_SHARE_CLASS}>
      {children}
    </ViewTransition>
  );
}

// A poser sur une page qui contient des vignettes : au retour depuis un film, remet
// le defilement du <main> d'AppShell avant la capture de la transition.
export function RestoreFilmScroll() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const top = takeSavedScroll(pathname);
    const main = document.querySelector("main");
    if (top != null && main) main.scrollTop = top;
  }, [pathname]);
  return null;
}
