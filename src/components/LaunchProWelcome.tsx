"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import { LAUNCH_PRO_UNTIL } from "@/lib/pro-plan";
import { formatDateParis } from "@/lib/utils";

const PERKS = ["Films illimités", "Contacts illimités"];
const EASE = [0.25, 0.1, 0.25, 1] as const;

// Deroule (secondes) : carte 0 -> logo -> cadeau (rebond + couvercle) -> badge PRO
// -> titre -> phrase et date -> Membre fondateur -> avantages -> bouton.
const T = { logo: 0.15, gift: 0.3, pro: 0.6, title: 0.8, text: 1.0, date: 1.5, founder: 1.6, perk1: 1.95, perk2: 2.35, button: 2.7 };

// Apparition d'un element. Reduced motion : fondu seul, sans decalage ni delai.
function enter(reduced: boolean | null, delay: number, y = 14) {
  return reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease: EASE } };
}

// ---- Confettis : particules lime et blanches, sans librairie ----
// Valeurs pseudo-aleatoires deterministes (fonction pure) : memes particules a chaque
// rendu. Une seule pluie, environ 3 secondes, retiree du DOM ensuite.
const rand = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const CONFETTI_COLORS = ["#C8FF00", "#DCFF57", "#B4E600", "#FFFFFF"];
const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  left: rand(i + 1) * 100,
  delay: 0.6 + rand(i + 7) * 0.6,
  duration: 1.8 + rand(i + 13) * 0.6,
  drift: (rand(i + 19) - 0.5) * 140,
  rotate: (rand(i + 23) - 0.5) * 720,
  size: 5 + rand(i + 29) * 5,
  round: rand(i + 31) > 0.6,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

function Confetti() {
  // Conteneur fixe, sans interaction, qui rogne tout ce qui deborde : aucun
  // defilement horizontal, rien ne bloque le bouton ni la lecture.
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.7,
            borderRadius: p.round ? "9999px" : 2,
            backgroundColor: p.color,
          }}
          initial={{ y: "-6vh", x: 0, rotate: 0, opacity: 0 }}
          animate={{ y: "106vh", x: p.drift, rotate: p.rotate, opacity: [0, 1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn", opacity: { duration: p.duration, delay: p.delay, times: [0, 0.1, 0.75, 1] } }}
        />
      ))}
    </div>
  );
}

// ---- Cadeau : le couvercle s'ouvre et retombe, le noeud rebondit ----
function Gift({ reduced }: { reduced: boolean | null }) {
  const lid = reduced
    ? {}
    : { animate: { y: [0, -9, -2, 0], rotate: [0, -9, 3, 0] }, transition: { duration: 1.1, delay: T.gift + 0.6, times: [0, 0.35, 0.7, 1], ease: "easeInOut" as const } };

  return (
    <div className="relative mx-auto mb-4 size-20">
      {/* Halo violet tres leger, fixe, derriere celui du lime */}
      <span
        aria-hidden="true"
        className="absolute -inset-12 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.16),transparent_70%)]"
      />
      {/* Halo lime qui pulse doucement derriere l'icone */}
      <motion.span
        aria-hidden="true"
        className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgba(200,255,0,0.4),transparent_65%)]"
        initial={{ opacity: reduced ? 0.4 : 0, scale: 0.8 }}
        animate={reduced ? { opacity: 0.4 } : { opacity: [0.35, 0.8, 0.35], scale: [0.95, 1.2, 0.95] }}
        transition={reduced ? { duration: 0.2 } : { duration: 2.8, delay: T.gift, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative flex size-20 items-center justify-center rounded-card border border-lime/30 bg-lime/10 shadow-[0_0_28px_rgba(200,255,0,0.25)]"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.3, rotate: -14 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
        transition={reduced ? { duration: 0.2 } : { type: "spring", stiffness: 260, damping: 11, delay: T.gift }}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="overflow-visible">
          {/* Boite */}
          <path d="M4.5 12v9h15v-9M12 12v9" />
          {/* Couvercle + noeud */}
          <motion.g style={{ transformBox: "fill-box", transformOrigin: "left bottom" }} {...lid}>
            <path d="M3 8h18v4H3zM12 8v4" />
            <path d="M12 8H7.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8zM12 8h4.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8z" />
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}

// ---- Grand badge PRO avec reflet qui passe de temps en temps ----
function ProBadge({ reduced }: { reduced: boolean | null }) {
  return (
    <motion.div
      className="relative mx-auto mb-4 inline-flex h-10 items-center overflow-hidden rounded-pill border border-lime/40 bg-lime/15 px-6 text-lg font-extrabold uppercase leading-none tracking-[0.28em] text-lime shadow-[0_0_24px_rgba(200,255,0,0.3)]"
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={reduced ? { duration: 0.2 } : { type: "spring", stiffness: 300, damping: 14, delay: T.pro }}
    >
      <span className="pl-[0.28em]">Pro</span>
      {!reduced && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1/2 -skew-x-[20deg] bg-linear-to-r from-transparent via-white/60 to-transparent"
          initial={{ x: "-160%" }}
          animate={{ x: "340%" }}
          transition={{ duration: 1.1, delay: T.pro + 0.5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
        />
      )}
    </motion.div>
  );
}

// ---- Un avantage qui s'allume, coche dessinee ----
function Perk({ label, delay, reduced }: { label: string; delay: number; reduced: boolean | null }) {
  const lit = { color: "#E8E8E8" };
  return (
    <motion.li
      className="flex items-center gap-2.5 text-sm font-medium"
      initial={reduced ? false : { opacity: 0.4, color: "#868686" }}
      animate={reduced ? lit : { opacity: 1, ...lit }}
      transition={{ duration: 0.45, delay }}
    >
      <motion.span
        className="flex size-5 shrink-0 items-center justify-center rounded-full border border-lime/40"
        initial={reduced ? false : { scale: 0.7, backgroundColor: "rgba(255,255,255,0.06)" }}
        animate={reduced ? { backgroundColor: "rgba(200,255,0,0.18)" } : { scale: [0.7, 1.25, 1], backgroundColor: "rgba(200,255,0,0.18)" }}
        transition={{ duration: 0.5, delay }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="text-lime">
          <motion.path
            d="M2.5 6.2 5 8.7l4.5-5.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: delay + 0.15, ease: "easeOut" }}
          />
        </svg>
      </motion.span>
      {label}
    </motion.li>
  );
}

// Ecran de bienvenue au premier acces apres l'inscription : /auth/confirm (email)
// et /rejoindre/finaliser (Google), le meme pour les deux. L'appelant ne l'affiche
// que si l'inscription a lieu avant la fin de l'offre (isLaunchOfferOpen, lib/pro-plan.ts).
// Reduced motion : apparition simple, sans confettis, pulsation, reflet ni rebond.
export default function LaunchProWelcome({ onContinue }: { onContinue: () => void }) {
  const reduced = useReducedMotion();
  const [confetti, setConfetti] = useState(!reduced);

  // Une seule pluie : retiree du DOM une fois finie.
  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => setConfetti(false), 4200);
    return () => clearTimeout(id);
  }, [reduced]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-6">
      {confetti && !reduced && <Confetti />}
      <motion.div
        className="w-full max-w-[420px]"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={reduced ? { duration: 0.2 } : { type: "spring", stiffness: 170, damping: 20 }}
      >
        <GlassCard radius="panel" className="glass-violet overflow-hidden px-5 py-8 text-center sm:px-8 sm:py-10">
          <motion.div className="mb-6 text-xl font-bold tracking-tight text-lime" {...enter(reduced, T.logo, 8)}>
            Unkast.
          </motion.div>

          <Gift reduced={reduced} />
          <ProBadge reduced={reduced} />

          <motion.h1 className="text-sheen pb-0.5 text-[26px] font-bold tracking-tight" {...enter(reduced, T.title)}>
            Bienvenue sur Unkast
          </motion.h1>

          <motion.p className="mx-auto mt-3 max-w-[340px] text-[15px] leading-relaxed text-text-primary" {...enter(reduced, T.text)}>
            Ton Unkast Pro est offert jusqu&apos;au{" "}
            <motion.span
              className="inline-block text-[17px] font-bold text-lime [text-shadow:0_0_18px_rgba(200,255,0,0.5)]"
              animate={reduced ? undefined : { scale: [1, 1.14, 1] }}
              transition={{ duration: 0.6, delay: T.date, ease: "easeInOut" }}
            >
              {formatDateParis(LAUNCH_PRO_UNTIL)}
            </motion.span>
            .
          </motion.p>

          {/* Membre fondateur : acquis pour de bon, il apparait en « tampon » */}
          <div className="relative mt-4 flex justify-center">
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, rotate: -8 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
              transition={reduced ? { duration: 0.2 } : { type: "spring", stiffness: 380, damping: 13, delay: T.founder }}
            >
              <Badge variant="founder" />
            </motion.div>
            {!reduced && (
              <motion.span
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 h-6 w-36 -translate-x-1/2 -translate-y-1/2 rounded-pill border border-violet/50"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0, 0.7, 0], scale: [0.8, 1.5, 1.7] }}
                transition={{ duration: 0.8, delay: T.founder + 0.1, ease: "easeOut" }}
              />
            )}
          </div>

          <ul className="mx-auto mt-6 mb-7 flex max-w-[260px] flex-col gap-2.5 text-left">
            <Perk label={PERKS[0]} delay={T.perk1} reduced={reduced} />
            <Perk label={PERKS[1]} delay={T.perk2} reduced={reduced} />
          </ul>

          <motion.div {...enter(reduced, T.button, 10)}>
            <Button
              onClick={onContinue}
              className="relative w-full overflow-hidden"
              whileHover={reduced ? undefined : { y: -2, scale: 1.02 }}
            >
              Découvrir Unkast
              {!reduced && (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-[20deg] bg-linear-to-r from-transparent via-white/55 to-transparent"
                  initial={{ x: "-160%" }}
                  animate={{ x: "420%" }}
                  transition={{ duration: 0.9, delay: T.button + 0.8, repeat: Infinity, repeatDelay: 4.5, ease: "easeInOut" }}
                />
              )}
            </Button>
          </motion.div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
