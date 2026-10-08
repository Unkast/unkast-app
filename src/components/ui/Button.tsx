"use client";

import Link from "next/link";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

const MotionLink = motion.create(Link);

const VARIANTS = {
  accent: "btn-accent",
  light: "bg-white text-canvas font-semibold hover:bg-white/90",
  glass: "glass text-text-primary font-semibold hover:border-white/20",
  dashed: "glass border-dashed border-lime/30 text-lime hover:border-lime/50",
  icon: "glass text-text-primary hover:border-white/20",
} as const;

// sm (36 px) et compact (40 px) : cible tactile etendue a 44 px (after:).
const SIZES = {
  sm: { box: "relative min-h-9 min-w-9 text-[13px] after:absolute after:inset-x-0 after:-inset-y-1", pad: "px-4" },
  compact: { box: "relative min-h-10 min-w-10 text-sm after:absolute after:inset-x-0 after:-inset-y-0.5", pad: "px-5" },
  md: { box: "min-h-11 min-w-11 text-sm", pad: "px-5" },
  lg: { box: "min-h-12 min-w-12 text-[15px]", pad: "px-6" },
} as const;

// L'icone seule n'a pas de texte : aria-label obligatoire.
// Avec href, le bouton est rendu en lien next/link (memes styles, meme appui).
// fullWidth : le bouton prend toute la largeur de son conteneur.
type ButtonProps = { size?: keyof typeof SIZES; fullWidth?: boolean } & (
  | { variant?: "accent" | "light" | "glass" | "dashed" }
  | { variant: "icon"; "aria-label": string }
) &
  ((HTMLMotionProps<"button"> & { href?: undefined }) | (Omit<HTMLMotionProps<"a">, "href"> & { href: string }));

export default function Button({ variant = "accent", size = "md", fullWidth = false, className = "", ...props }: ButtonProps) {
  const reduced = useReducedMotion();
  const s = SIZES[size];
  const shared = {
    whileTap: reduced ? undefined : { scale: 0.96 },
    transition: { type: "spring", stiffness: 500, damping: 30 } as const,
    className: `press-spring inline-flex items-center justify-center gap-2 rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:pointer-events-none disabled:opacity-50 ${s.box} ${variant === "icon" ? "" : s.pad} ${fullWidth ? "w-full" : ""} ${VARIANTS[variant]} ${className}`,
  };

  if (props.href !== undefined) return <MotionLink {...shared} {...props} />;
  return <motion.button type="button" {...shared} {...props} />;
}
