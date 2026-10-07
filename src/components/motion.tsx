"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

// ---- Fade-in with stagger for lists ----
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
};

// ---- Card hover preset ----
export const cardHover = {
  whileHover: {
    scale: 1.02,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const },
  },
  whileTap: { scale: 0.98 },
} as const;

// ---- Scroll reveal ----
export function FadeInView({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---- Modal backdrop + content ----
export function ModalBackdrop({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[20px] p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="glass-strong bg-glass-solid/80 rounded-panel w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ---- Verre liquide (refonte visuelle) ----
export const cardSpring = { type: "spring", stiffness: 260, damping: 28 } as const;

export const listStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

// transitionEnd : l'entree finit sur filter: none. Un blur(0px) residuel ferait de
// l'element un fond isole, et le backdrop-filter d'un .glass enfant ne verrait plus les halos.
export const enterUp: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" }, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } },
};

// Reduced motion : fondu seul. Memes cles que enterUp pour que framer reecrive
// transform/filter si le HTML serveur a ete rendu avec l'etat cache de enterUp.
export const enterFade: Variants = {
  hidden: { opacity: 0, y: 0, filter: "blur(0px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" }, transition: { duration: 0.15 } },
};

// Liste dont les EnterItem entrent avec 80 ms de decalage
export function EnterList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

// A placer dans un EnterList (c'est lui qui declenche l'entree)
export function EnterItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div variants={reduced ? enterFade : enterUp} className={className}>
      {children}
    </motion.div>
  );
}

// Re-export motion for convenience
export { motion };
