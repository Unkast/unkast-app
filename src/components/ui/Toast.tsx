"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const noopSubscribe = () => () => {};

// Message bref, affiche tant que `message` n'est pas vide (c'est l'appelant qui le vide).
// Pose sous l'en-tete d'AppShell, au-dessus de tout (feuilles et recadreur compris).
// Portail sur le body : un ancetre en verre deviendrait sinon le repere du position: fixed.
export default function Toast({ message }: { message: string }) {
  const reduced = useReducedMotion();
  const onClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!onClient) return null;

  const y = reduced ? 0 : -16;
  return createPortal(
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y }}
          transition={{ duration: reduced ? 0.15 : 0.25 }}
          className="glass-strong fixed right-4 top-[calc(68px+env(safe-area-inset-top,16px))] z-[10000] max-w-[calc(100vw-2rem)] rounded-card bg-glass-solid/80 px-4 py-2.5 text-[13px] text-text-primary shadow-2xl shadow-black/50"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
