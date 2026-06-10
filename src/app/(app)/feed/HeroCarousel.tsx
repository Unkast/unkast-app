"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";

interface CarouselProject {
  id: string;
  title: string;
  slug: string;
  category: ProjectCategory;
  year: number;
  description: string | null;
  video_url: string;
  owner_name: string;
  owner_slug: string;
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

export default function HeroCarousel({ projects }: HeroCarouselProps) {
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

  return (
    <div
      className="w-full select-none"
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
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                position: "absolute",
                width: 180,
                height: 260,
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: "#1a1a1a",
                cursor: isCenter ? "default" : "pointer",
                transformStyle: "preserve-3d",
                border: isCenter ? "1px solid rgba(200,255,0,0.15)" : "1px solid rgba(255,255,255,0.06)",
                boxShadow: isCenter ? "0 30px 80px rgba(0,0,0,0.9)" : "none",
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
              backgroundColor: i === activeIndex ? "#C8FF00" : "#2a2a2a",
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          style={{ padding: "14px 20px 0" }}
        >
          <p className="font-mono" style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", marginBottom: 4, textTransform: "uppercase" }}>
            {active.year}
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", color: "#f0f0f0", margin: "0 0 10px", lineHeight: 1.15 }}>
            {active.title}
          </h2>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            <span style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#888", fontSize: 12, borderRadius: 20, padding: "5px 12px" }}>
              {CATEGORY_LABELS[active.category]}
            </span>
            {active.team_size > 0 && (
              <span style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#888", fontSize: 12, borderRadius: 20, padding: "5px 12px" }}>
                {active.team_size} talent{active.team_size > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href={`/projet/${active.slug}`}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#C8FF00", color: "#0d0d0d", fontWeight: 600, fontSize: 14, borderRadius: 10, padding: "12px 24px", textDecoration: "none" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Voir le film
            </Link>
            <Link
              href={`/profil/${active.owner_slug}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#f0f0f0", fontSize: 14, borderRadius: 10, padding: "12px 16px", textDecoration: "none", whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {active.owner_name}
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
