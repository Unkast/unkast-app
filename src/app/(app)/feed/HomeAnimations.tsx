"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cardSpring, enterFade, enterUp } from "@/components/motion";
import type { ReactNode } from "react";

export function HeroContent({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="absolute bottom-0 left-0 right-0 px-5 pb-7 sm:px-8 sm:pb-10 z-10"
    >
      {children}
    </motion.div>
  );
}

// Entree au scroll (une seule fois), memes variantes que EnterItem
export function Section({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={reduced ? enterFade : enterUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
    >
      {children}
    </motion.div>
  );
}

// Legere elevation au survol
export function AnimatedCard({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -4 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={cardSpring}
    >
      {children}
    </motion.div>
  );
}
