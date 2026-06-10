"use client";

import { motion } from "framer-motion";
import { FadeInView } from "@/components/motion";
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

export function Section({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <FadeInView delay={delay}>
      {children}
    </FadeInView>
  );
}

export function AnimatedCard({ children }: { children: ReactNode }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
