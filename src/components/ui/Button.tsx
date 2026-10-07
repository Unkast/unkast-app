"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

const VARIANTS = {
  accent: "btn-accent px-5",
  light: "bg-white text-canvas px-5 hover:bg-white/90",
  glass: "glass text-text-primary px-5 hover:border-white/20",
  icon: "glass text-text-primary hover:border-white/20",
} as const;

// L'icone seule n'a pas de texte : aria-label obligatoire.
type ButtonProps = HTMLMotionProps<"button"> &
  ({ variant?: "accent" | "light" | "glass" } | { variant: "icon"; "aria-label": string });

export default function Button({ variant = "accent", className = "", type = "button", ...props }: ButtonProps) {
  const reduced = useReducedMotion();

  return (
    <motion.button
      type={type}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`press-spring inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-pill text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
