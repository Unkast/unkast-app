"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Avatar from "@/components/Avatar";
import Button from "@/components/ui/Button";
import FilmLink from "@/components/FilmLink";
import FilmMeta from "@/components/FilmMeta";
import FilmPoster from "@/components/FilmPoster";
import { CATEGORY_LABELS } from "@/lib/constants";
import { markFilmClick } from "@/lib/film-transition";
import type { ProjectCategory } from "@/types/database";

interface CarouselProject {
  id: string;
  title: string;
  slug: string;
  category: ProjectCategory;
  year: number;
  description: string | null;
  director_name: string;
  team_size: number;
  team_preview: { name: string; avatar_url: string | null }[];
  poster_url?: string | null;
  preview_url?: string | null;
}

interface HeroCarouselProps {
  projects: CarouselProject[];
}

// Duree d'affichage d'un film a la une. Meme valeur que .hero-progress (globals.css).
const SLIDE_MS = 8000;
const PLAY_ICON = "M8 5v14l11-7z";

const image = (p: CarouselProject) => p.preview_url || p.poster_url || null;
const two = (n: number) => String(n).padStart(2, "0");

// Bloc « À la une » : texte à gauche, affiche à droite, lumière de l'affiche en fond,
// puis les films à la une en vignettes. Rien n'est posé sur une affiche.
// La hauteur du bloc ne change jamais d'un film à l'autre : chaque élément du texte a
// une hauteur réservée (titre et description sur 2 lignes, ligne équipe toujours
// présente) et l'affiche tient entière dans un cadre fixe en 16:9.
export default function HeroCarousel({ projects }: HeroCarouselProps) {
  const reduced = useReducedMotion();
  const films = projects.slice(0, 5);
  const count = films.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Film suivant apres 8 s ; le minuteur repart a chaque changement de film.
  useEffect(() => {
    if (count < 2) return;
    const timer = setTimeout(() => setActiveIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [activeIndex, count]);

  if (count === 0) return null;

  const goTo = (i: number) => setActiveIndex(((i % count) + count) % count);
  const active = films[activeIndex];
  const shareKey = `une:${active.id}`;
  const fade = { duration: reduced ? 0.15 : 0.3 };

  return (
    <section aria-label="À la une" className="px-4 pt-4 lg:px-10 lg:pt-7">
      <div className="relative isolate overflow-hidden rounded-panel-lg border border-white/[0.11] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_40px_110px_rgba(0,0,0,0.55)] sm:p-[22px] xl:px-11 xl:pb-[26px] xl:pt-11">
        {/* Lumiere : l'affiche de chaque film, tres floutee ; seule celle du film en cours est visible */}
        {films.map((p, i) => {
          const src = image(p);
          return src ? (
            <div
              key={p.id}
              aria-hidden="true"
              className={`film-ambient pointer-events-none absolute -left-[15%] -top-[25%] -z-20 h-[150%] w-[130%] transition-opacity duration-slow ease-glass ${i === activeIndex ? "opacity-60" : "opacity-0"}`}
            >
              <Image src={src} alt="" fill sizes="64px" className="object-cover" />
            </div>
          ) : null;
        })}
        {/* Voile sombre, plus fort a gauche (lisibilite du texte) */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(10,10,12,0.94)_0%,rgba(10,10,12,0.7)_38%,rgba(10,10,12,0.25)_100%)]" />

        <div className="grid items-center gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-12">
          {/* Texte. @container : les boutons s'allegent quand la colonne est etroite, pour
              que les fleches restent sur leur ligne. */}
          <div className="@container flex min-w-0 flex-col gap-[18px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fade}
                className="flex min-w-0 flex-col gap-[18px]"
              >
                <p className="flex items-center gap-2.5 text-xs font-semibold tracking-[0.16em] text-text-secondary">
                  <span className="text-text-primary">À LA UNE</span>
                  <span className="font-mono">{two(activeIndex + 1)} / {two(count)}</span>
                </p>
                {/* Titre : 2 lignes au plus, hauteur de 2 lignes toujours reservee */}
                <h2 className="text-sheen line-clamp-2 h-[2.2em] text-[34px] font-extrabold leading-[1.1] tracking-[-0.035em] sm:text-[40px] xl:text-5xl 2xl:text-[64px]">
                  {active.title}
                </h2>
                <FilmMeta size="md" category={active.category} author={active.director_name} year={active.year} />
                {/* Description : 2 lignes reservees, meme sans texte */}
                <p className="line-clamp-2 h-[3.1em] max-w-[440px] text-[17px] leading-[1.55] text-text-primary/85">{active.description}</p>
                {/* Ligne equipe : toujours presente, vide si personne n'est au generique */}
                <div className="flex h-[30px] items-center gap-2.5 text-[13px] text-text-secondary">
                  {active.team_size > 0 && (
                    <>
                      <div className="flex">
                        {active.team_preview.map((member, i) => (
                          <Avatar
                            key={i}
                            url={member.avatar_url}
                            name={member.name}
                            size={30}
                            style={{ marginLeft: i === 0 ? 0 : -10, boxShadow: "0 0 0 2px #0f0f13", background: "var(--color-glass-solid)", fontSize: 11 }}
                          />
                        ))}
                      </div>
                      {active.team_size} talent{active.team_size > 1 ? "s" : ""} au générique
                    </>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Boutons et fleches sur une seule ligne, fleches calees a droite */}
            <div className="mt-1.5 flex items-center gap-2">
              <Button size="sm" href={`/projet/${active.slug}`} onClick={() => markFilmClick(shareKey)} className="shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="hidden @[350px]:block"><path d={PLAY_ICON} /></svg>
                Voir le film
              </Button>
              <Button size="sm" variant="glass" href={`/projet/${active.slug}#equipe`} aria-label="Voir l'équipe" className="shrink-0">
                <span className="@[320px]:hidden">Équipe</span>
                <span className="hidden @[320px]:inline">Voir l&apos;équipe</span>
              </Button>
              {count > 1 && (
                <div className="ml-auto flex shrink-0 gap-2">
                  <Button variant="icon" size="sm" aria-label="Film précédent" onClick={() => goTo(activeIndex - 1)}>
                    <Chevron d="M15 5l-7 7 7 7" />
                  </Button>
                  <Button variant="icon" size="sm" aria-label="Film suivant" onClick={() => goTo(activeIndex + 1)}>
                    <Chevron d="M9 5l7 7-7 7" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Cadre fixe en 16:9 (en haut sur mobile) : l'affiche y tient entiere.
              Glisser du doigt pour changer de film. */}
          <div
            className="relative aspect-video max-xl:order-first"
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const delta = e.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (delta > 40) goTo(activeIndex - 1);
              else if (delta < -40) goTo(activeIndex + 1);
            }}
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={active.id}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(8px)" }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.04, filter: "blur(8px)" }}
                transition={{ duration: reduced ? 0.15 : 0.45, ease: [0.65, 0, 0.35, 1] }}
                className="absolute inset-0"
              >
                <FilmLink slug={active.slug} shareKey={shareKey} aria-label={`Voir ${active.title}`} className="press-spring group block">
                  <FilmPoster
                    src={image(active)}
                    alt={active.title}
                    framed
                    shareKey={shareKey}
                    sizes="(max-width: 1280px) 100vw, 60vw"
                    priority={activeIndex === 0}
                    className="rounded-[20px] shadow-[0_50px_120px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.16)]"
                  >
                    <span aria-hidden="true" className="glass-strong absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill bg-black/35 transition-transform duration-base ease-glass group-hover:scale-105 xl:size-[68px]">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 3 }}><path d={PLAY_ICON} /></svg>
                    </span>
                  </FilmPoster>
                </FilmLink>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Les films a la une : chaque affiche dans un cadre 16:9, barre de
            progression sur le film en cours */}
        {count > 1 && (
          <div className="mt-6 grid grid-cols-2 gap-3.5 border-t border-white/[0.08] pt-[22px] sm:grid-cols-3 lg:grid-cols-5 xl:mt-[34px]">
            {films.map((p, i) => {
              const isActive = i === activeIndex;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`À la une : ${p.title}`}
                  aria-current={isActive}
                  className={`flex min-w-0 flex-col gap-2 text-left transition-opacity duration-base ease-glass hover:opacity-100 ${isActive ? "opacity-100" : "opacity-55"}`}
                >
                  <span className="block h-[3px] w-full overflow-hidden rounded-sm bg-white/[0.14]">
                    {isActive && <span key={activeIndex} className="hero-progress block h-full bg-lime shadow-[0_0_10px_var(--color-lime)]" />}
                  </span>
                  <FilmPoster src={image(p)} alt="" framed sizes="(max-width: 1024px) 50vw, 220px" className="rounded-[10px]" />
                  <span className="w-full min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-text-primary">{p.title}</span>
                    <span className="block truncate text-xs text-text-secondary">{CATEGORY_LABELS[p.category]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
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
