import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { SITE_URL } from "@/lib/site";
import s from "./site.module.css";

// Liens vers l'app (app.unkast.com en production, voir lib/site.ts).
export const APP = {
  join: `${SITE_URL}/rejoindre`,
  login: `${SITE_URL}/connexion`,
  feed: `${SITE_URL}/feed`,
  film: (slug: string) => `${SITE_URL}/projet/${slug}`,
  page: (path: string) => `${SITE_URL}${path}`,
  // Paiement ouvert : page /pro. Sinon l'inscription (Pro offert au lancement).
  pro: process.env.NEXT_PUBLIC_BILLING_ENABLED === "true" ? `${SITE_URL}/pro` : `${SITE_URL}/rejoindre`,
};

// Film public et approuve, prepare cote serveur (page.tsx). `team` = initiales,
// comme un visiteur les voit dans l'app ; `director` = credit de realisation.
export type SiteFilm = {
  slug: string;
  title: string;
  category: string;
  year: number | null;
  poster: string | null;
  director: string | null;
  team: string[];
  teamCount: number;
  /** Film fictif (exemples.ts) : jamais de lien vers l'app, mention « Exemple ». */
  example?: boolean;
};

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// Proprietes CSS personnalisees (--r) : absentes du type CSSProperties.
export const vars = (v: Record<string, string>) => v as CSSProperties;

// Fond degrade de la maquette tant qu'aucune affiche n'est disponible.
export const TONES = [s.tone1, s.tone2, s.tone3, s.tone4];

// Second ton des pastilles citron (la maquette utilisait un jaune #E0A800).
export const LIME_DEEP = "#8FB800";

export function Arrow() {
  return (
    <svg className={s.arr} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg>
  );
}

export function Check({ size = 16, stroke = "var(--y)", width = "2.4" }: { size?: number; stroke?: string; width?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"></path></svg>
  );
}

export function Play({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>
  );
}

// Surtitre violet a trait (« Le concept », « Comment ça marche »...).
export function Eyebrow({ children, both, className, style }: { children: ReactNode; both?: boolean; className?: string; style?: CSSProperties }) {
  const bar = <span style={{ width: "32px", height: "1px", background: "currentColor" }}></span>;
  return (
    <div className={cx(s.rv, className)} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", fontWeight: "600", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--vl)", ...style }}>
      {bar}{children}{both && bar}
    </div>
  );
}

// Affiche d'un film dans un cadre de la maquette (bandes noires .lbox par-dessus).
export function Poster({ film, sizes }: { film: SiteFilm; sizes: string }) {
  if (!film.poster) return null;
  const alt = film.example ? `Exemple d'affiche, film fictif : ${film.title}` : "";
  return <Image src={film.poster} alt={alt} fill sizes={sizes} style={{ objectFit: "cover" }} />;
}

// Puce « Exemple » discrete : en coin d'une affiche, ou `inline` dans une legende.
export function ExampleChip({ inline }: { inline?: boolean }) {
  const place: CSSProperties = inline ? { flexShrink: "0" } : { position: "absolute", left: "10px", top: "10px", zIndex: "2" };
  return (
    <span className={cx(s.mono, s.exChip)} style={{ ...place, padding: "3px 9px", borderRadius: "999px", background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.18)", fontSize: "10px", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.78)" }}>Exemple</span>
  );
}
