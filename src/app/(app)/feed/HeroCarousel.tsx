"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";

interface CarouselProject {
  id: string;
  title: string;
  slug: string;
  category: ProjectCategory;
  year: number;
  description: string | null;
  video_url: string;
  director_name: string;
  director_slug: string | null;
  team_size: number;
  poster_url?: string | null;
  preview_url?: string | null;
}

interface HeroCarouselProps {
  projects: CarouselProject[];
}

const POSITIONS = [
  { rotateY: 45, translateX: -200, translateZ: -120, scale: 0.65, opacity: 0.35, zIndex: 1 },
  { rotateY: 28, translateX: -130, translateZ: -60, scale: 0.8, opacity: 0.6, zIndex: 2 },
  { rotateY: 0, translateX: 0, translateZ: 0, scale: 1, opacity: 1, zIndex: 5 },
  { rotateY: -28, translateX: 130, translateZ: -60, scale: 0.8, opacity: 0.6, zIndex: 2 },
  { rotateY: -45, translateX: 200, translateZ: -120, scale: 0.65, opacity: 0.35, zIndex: 1 },
];

// Memes classes que ui/Button, mais sur des liens (Button ne rend qu'un <button>)
const PILL = "glass inline-flex h-7 items-center gap-2 rounded-pill px-3 text-xs text-text-secondary";

export default function HeroCarousel({ projects }: HeroCarouselProps) {
  const reduced = useReducedMotion();
  const count = Math.min(projects.length, 5);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % count);
    }, 5000);
  }, [count]);

  useEffect(() => {
    resetAuto();
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [resetAuto]);

  const goTo = useCallback((i: number) => {
    setActiveIndex(((i % count) + count) % count);
    resetAuto();
  }, [count, resetAuto]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta > 40) goTo(activeIndex - 1);
    else if (delta < -40) goTo(activeIndex + 1);
  };

  if (count === 0) return null;

  const active = projects[activeIndex];

  function getSlotIndex(i: number): number {
    const offset = ((i - activeIndex) % count + count) % count;
    if (offset === 0) return 2; // center
    if (offset === 1) return 3; // right +1
    if (offset === 2) return 4; // right +2
    if (offset === count - 1) return 1; // left -1
    if (offset === count - 2) return 0; // left -2
    return -1; // hidden
  }

  const activeColor = CATEGORY_COLORS[active.category];

  return (
    <>
    {/* ============ MOBILE / TABLET — carrousel 3D en éventail (inchangé) ============ */}
    <div
      className="w-full select-none lg:hidden"
      style={{ overflowX: "hidden", overflowY: "visible" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 3D Fan carousel */}
      <div
        style={{
          height: 320,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: 1000,
          perspectiveOrigin: "50% 50%",
        }}
      >
        {projects.slice(0, count).map((project, i) => {
          const slot = getSlotIndex(i);
          if (slot < 0) return null;
          const pos = POSITIONS[slot];
          const isCenter = slot === 2;

          return (
            <motion.div
              key={project.id}
              onClick={() => {
                if (isCenter) return;
                if (slot < 2) goTo(activeIndex - (2 - slot));
                else goTo(activeIndex + (slot - 2));
              }}
              animate={{
                rotateY: pos.rotateY,
                x: pos.translateX,
                z: pos.translateZ,
                scale: pos.scale,
                opacity: pos.opacity,
                zIndex: pos.zIndex,
              }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
              style={{
                position: "absolute",
                width: 180,
                height: 260,
                borderRadius: "var(--radius-media)",
                overflow: "hidden",
                // Opaque : les cartes de l'eventail se chevauchent
                backgroundColor: "var(--color-glass-solid)",
                cursor: isCenter ? "default" : "pointer",
                transformStyle: "preserve-3d",
                border: `1px solid var(${isCenter ? "--glass-border-strong" : "--glass-border"})`,
                boxShadow: isCenter ? "0 30px 80px rgba(0,0,0,0.7)" : "none",
              }}
            >
              {/* Poster image or play icon placeholder */}
              {project.poster_url ? (
                <Image
                  src={project.poster_url}
                  alt={project.title}
                  fill
                  sizes="180px"
                  priority={isCenter}
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="40" height="40" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.2 }}>
                    <polygon points="16,10 40,24 16,38" fill="#C8FF00" />
                  </svg>
                </div>
              )}

              {/* Center card link overlay */}
              {isCenter && (
                <Link
                  href={`/projet/${project.slug}`}
                  style={{ position: "absolute", inset: 0, display: "block" }}
                  aria-label={`Voir ${project.title}`}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Dots */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
        {projects.slice(0, count).map((_, i) => (
          <motion.button
            key={i}
            onClick={() => goTo(i)}
            animate={{
              width: i === activeIndex ? 20 : 6,
              backgroundColor: i === activeIndex ? "rgba(200,255,0,1)" : "rgba(255,255,255,0.16)",
            }}
            transition={{ duration: 0.3 }}
            style={{ height: 6, borderRadius: 4, border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}
          />
        ))}
      </div>

      {/* Info section */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -8 }}
          transition={{ duration: 0.25 }}
          className="px-5 pt-3.5"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary mb-1">
            {active.year}
          </p>
          <h2 className="text-sheen text-[26px] font-bold tracking-[-0.5px] leading-[1.15] pb-0.5 mb-2">
            {active.title}
          </h2>

          <div className="flex flex-wrap gap-1.5 mb-3.5">
            <span className={PILL}>
              <span className="size-1.5 rounded-full" style={{ backgroundColor: activeColor, boxShadow: `0 0 8px ${activeColor}` }} />
              {CATEGORY_LABELS[active.category]}
            </span>
            {active.team_size > 0 && (
              <span className={PILL}>
                {active.team_size} talent{active.team_size > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Button href={`/projet/${active.slug}`} className="flex-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Voir le film
            </Button>
            {/* Réalisateur (crédits de réalisation). Plusieurs noms ou pas de profil : le lien mène au film. */}
            {active.director_name && (
              <Button variant="glass" href={active.director_slug ? `/profil/${active.director_slug}` : `/projet/${active.slug}`} className="max-w-[160px]">
                <span className="truncate">{active.director_name}</span>
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>

    {/* ============ DESKTOP — billboard façon Netflix ============ */}
    <div className="hidden lg:block px-12 xl:px-16 pt-2">
      <div className="relative w-full overflow-hidden glass rounded-panel shadow-2xl shadow-black/60 h-[460px] xl:h-[540px]">
        {/* Backdrop (crossfade sur le projet actif) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, scale: reduced ? 1 : 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute inset-0"
          >
            {active.preview_url || active.poster_url ? (
              <Image
                src={(active.preview_url || active.poster_url) as string}
                alt={active.title}
                fill
                priority
                sizes="(max-width: 1600px) 100vw, 1600px"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="72" height="72" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.12 }}>
                  <polygon points="16,10 40,24 16,38" fill="#C8FF00" />
                </svg>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Scrims pour la lisibilité du texte */}
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-canvas/80 via-canvas/10 to-transparent" />

        {/* Bloc texte + actions (largeur intrinsèque, aligné à gauche) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id + "-info"}
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -8 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute left-0 bottom-0 p-10 xl:p-12 max-w-[620px]"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary mb-3">{active.year}</p>
            <h2 className="text-sheen text-4xl xl:text-5xl font-bold tracking-tight leading-[1.05] pb-1.5 mb-2.5">
              {active.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mb-7">
              <span className={PILL}>
                <span className="size-1.5 rounded-full" style={{ backgroundColor: activeColor, boxShadow: `0 0 8px ${activeColor}` }} />
                {CATEGORY_LABELS[active.category]}
              </span>
              {active.team_size > 0 && (
                <span className={PILL}>
                  {active.team_size} talent{active.team_size > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button href={`/projet/${active.slug}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                Voir le film
              </Button>
              {active.director_name && (
                <Button variant="glass" href={active.director_slug ? `/profil/${active.director_slug}` : `/projet/${active.slug}`} className="max-w-[220px]">
                  <span className="truncate">{active.director_name}</span>
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Rail de vignettes — sélecteur (remplace les dots sur desktop) */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2.5">
          {projects.slice(0, count).map((p, i) => {
            const isActive = i === activeIndex;
            return (
              <motion.button
                key={p.id}
                onClick={() => goTo(i)}
                aria-label={`Voir ${p.title}`}
                animate={{ width: isActive ? 132 : 104, height: isActive ? 74 : 60 }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
                className="relative overflow-hidden rounded-media flex-shrink-0"
                style={{
                  border: isActive ? "2px solid #C8FF00" : "1px solid var(--glass-border)",
                  boxShadow: isActive ? "0 12px 30px rgba(0,0,0,0.5)" : "none",
                  cursor: isActive ? "default" : "pointer",
                }}
              >
                {p.preview_url || p.poster_url ? (
                  <Image src={(p.preview_url || p.poster_url) as string} alt={p.title} fill sizes="132px" style={{ objectFit: "cover" }} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-glass-solid">
                    <svg width="20" height="20" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.25 }}>
                      <polygon points="16,10 40,24 16,38" fill="#C8FF00" />
                    </svg>
                  </div>
                )}
                {!isActive && <div className="absolute inset-0 bg-black/40 hover:bg-black/10 transition-colors" />}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}
