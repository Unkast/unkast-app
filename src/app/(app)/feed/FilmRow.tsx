"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import FilmLink from "@/components/FilmLink";
import FilmMeta from "@/components/FilmMeta";
import FilmPoster from "@/components/FilmPoster";
import type { ProjectCategory } from "@/types/database";
import { AnimatedCard } from "./HomeAnimations";

export interface FilmRowItem {
  id: string;
  title: string;
  slug: string;
  category: ProjectCategory;
  year: number;
  director_name: string;
  team_size: number;
  image: string | null;
  /** Série : nombre d'épisodes, affiché sous l'affiche. */
  episode_count?: number | null;
}

interface Props {
  title: string;
  href: string;
  items: FilmRowItem[];
}

// Rangee de films du feed : fleches a cote de « Tout voir », fondu sombre sur le bord
// droit tant qu'il reste des films a faire defiler. Toutes les affiches ont la meme
// hauteur ; toutes les cartes ont la meme taille (cadre 16:9).
export default function FilmRow({ title, href, items }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft <= 1;
      const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length]);

  const scrollBy = (direction: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const fade = edges.end ? undefined : "linear-gradient(90deg, #000 calc(100% - var(--row-fade)), transparent)";

  return (
    <section className="px-5 sm:px-8 lg:px-12 xl:px-16">
      <div className="mb-3 flex items-center justify-between lg:mb-4">
        <h2 className="text-[15px] font-bold tracking-tight text-text-primary lg:text-xl">{title}</h2>
        <div className="flex items-center gap-3.5">
          <Link href={href} className="group/all inline-flex items-center gap-1 text-[11px] text-text-tertiary transition-colors duration-300 hover:text-lime lg:text-xs">
            Tout voir
            <span className="transition-transform duration-300 group-hover/all:translate-x-0.5">→</span>
          </Link>
          <div className="hidden gap-2 lg:flex">
            <Button variant="icon" size="sm" aria-label="Défiler à gauche" disabled={edges.start} onClick={() => scrollBy(-1)}>
              <Chevron d="M15 5l-7 7 7 7" />
            </Button>
            <Button variant="icon" size="sm" aria-label="Défiler à droite" disabled={edges.end} onClick={() => scrollBy(1)}>
              <Chevron d="M9 5l7 7-7 7" />
            </Button>
          </div>
        </div>
      </div>
      <div
        ref={scroller}
        className="no-scrollbar -mx-5 -mb-5 -mt-2 flex gap-3 overflow-x-auto px-5 pb-6 pt-2 [--row-fade:48px] sm:-mx-8 sm:px-8 lg:-mx-12 lg:gap-4 lg:px-12 lg:[--row-fade:120px] xl:-mx-16 xl:px-16"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      >
        {items.map((film) => {
          const shareKey = `${title}:${film.id}`;
          return (
            <AnimatedCard key={film.id}>
              <FilmLink slug={film.slug} shareKey={shareKey} className="press-spring group flex w-fit flex-shrink-0 flex-col items-start">
                  <FilmPoster
                    src={film.image}
                    alt={film.title}
                    shareKey={shareKey}
                    sizes="(max-width: 640px) 240px, (max-width: 1024px) 288px, 320px"
                    className="h-[135px] rounded-media sm:h-[162px] lg:h-[180px] border border-white/[0.11] shadow-xl shadow-black/50 transition-[border-color,box-shadow] duration-base ease-glass group-hover:border-white/20 group-hover:shadow-2xl group-hover:shadow-black/70"
                  >
                    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-base group-hover:opacity-100">
                      <span className="glass-strong flex size-11 items-center justify-center rounded-pill bg-black/35">
                        <svg className="ml-0.5 size-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </span>
                    </span>
                  </FilmPoster>
                {/* w-0 min-w-full : le texte ne fixe pas la largeur de la carte, c'est l'affiche */}
                <div className="mt-2.5 w-0 min-w-full px-0.5">
                  <h3 className="truncate text-[13px] font-semibold leading-tight text-text-primary transition-colors duration-300 group-hover:text-lime lg:text-[15px]">
                    {film.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <FilmMeta category={film.category} author={film.director_name} year={film.year} episodes={film.episode_count} />
                    {film.team_size > 0 && (
                      <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-text-tertiary/50">
                        <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {film.team_size}
                      </span>
                    )}
                  </div>
                </div>
              </FilmLink>
            </AnimatedCard>
          );
        })}
      </div>
    </section>
  );
}

function Chevron({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
