"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";
import Button from "@/components/ui/Button";

export default function ConversionBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();
  const reduced = useReducedMotion();

  useEffect(() => {
    // Don't show if already dismissed this session
    if (sessionStorage.getItem("unkast_banner_dismissed")) {
      return;
    }

    // Don't show if user is logged in
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // C'est le <main> d'AppShell qui defile (premier <main> du document), pas window
    const scroller = document.querySelector("main");
    if (!scroller) return;

    function handleScroll() {
      if (scroller!.scrollTop > 300 && !sessionStorage.getItem("unkast_banner_dismissed")) {
        setVisible(true);
      }
    }

    // Listen for scroll after auth check
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user || cancelled) return;
      scroller.addEventListener("scroll", handleScroll, { passive: true });
    });

    return () => {
      cancelled = true;
      scroller.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function handleDismiss() {
    sessionStorage.setItem("unkast_banner_dismissed", "1");
    setDismissed(true);
    setVisible(false);
  }

  if (dismissed) return null;

  const offset = reduced ? 0 : 20;

  return (
    <>
      {/* Reserve la place de la pilule (58 px + 12 px d'air) : le bas du feed ne passe pas dessous */}
      {visible && <div aria-hidden="true" className="h-[72px]" />}

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: offset, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: offset, opacity: 0 }}
            transition={{ duration: reduced ? 0.15 : 0.4 }}
            // Posee 12 px au-dessus de la navigation mobile : barre plate (56 px) dans le
            // navigateur, dock (88 px) dans l'app installee, rien en desktop.
            className="glass-strong fixed z-40 left-4 right-4 flex items-center gap-2 rounded-pill py-1.5 pl-5 pr-1.5 shadow-2xl shadow-black/50 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] max-lg:[.app-installed_&]:bottom-[calc(100px+env(safe-area-inset-bottom,0px))] lg:left-auto lg:right-6 lg:bottom-6 lg:w-[400px]"
          >
            {/* Left: text */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight text-text-primary">
                Tu aimes ce que tu vois?
              </p>
              <p className="mt-0.5 truncate text-xs leading-tight text-text-secondary">
                Rejoins Unkast, c&apos;est gratuit
              </p>
            </div>

            {/* Right: CTA button */}
            <Button size="sm" onClick={() => router.push("/rejoindre")} className="shrink-0">
              S&apos;inscrire →
            </Button>

            {/* Close button (32 px visibles, cible tactile etendue a 44 px) */}
            <button
              onClick={handleDismiss}
              aria-label="Fermer"
              className="relative flex size-8 shrink-0 items-center justify-center rounded-pill bg-white/10 text-text-secondary hover:text-text-primary after:absolute after:-inset-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
