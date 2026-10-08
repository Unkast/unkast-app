"use client";

// Sous-composants de presentation de l'espace /moi (aucune logique metier).
import type { ComponentProps, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Badge from "@/components/ui/Badge";

/* ---------- petit titre de section (capitales mono) ---------- */

export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary ${className}`}>{children}</p>
  );
}

/* ---------- interrupteur ---------- */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="relative flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span className="text-sm text-text-primary">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-pill border border-white/10 bg-white/10 transition-colors duration-fast peer-checked:border-lime/40 peer-checked:bg-lime peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime after:absolute after:left-0.5 after:top-0.5 after:size-[22px] after:rounded-full after:bg-white after:shadow-md after:transition-transform after:duration-fast peer-checked:after:translate-x-5 peer-checked:after:bg-canvas"
      />
    </label>
  );
}

/* ---------- liste deroulante (memes cotes que Field md) ---------- */

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return (
    <select
      className={`min-h-11 w-full rounded-card border border-white/10 bg-white/5 px-3 text-base text-text-primary outline-none transition-[border-color,box-shadow]! duration-fast! focus:ring-3 focus:ring-lime/30 [&>option]:bg-glass-solid [&>option]:text-text-primary ${className}`}
      {...props}
    />
  );
}

/* ---------- statut (publie / en attente / refuse) ---------- */

export function StatusBadge({ tone, children }: { tone: "ok" | "pending" | "ko"; children: ReactNode }) {
  if (tone === "ok") return <Badge variant="verified">{children}</Badge>;
  if (tone === "pending") return <Badge variant="pending">{children}</Badge>;
  // Pas de variant « refuse » dans Badge : neutre teinte en rouge localement.
  return (
    <Badge variant="neutral" className="border-red-500/25! bg-red-500/10! text-red-400!">
      {children}
    </Badge>
  );
}

/* ---------- vignette de film ---------- */

export function FilmThumb({ url }: { url: string | null | undefined }) {
  return (
    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-media border border-white/10 bg-white/5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-text-tertiary" aria-hidden="true">
          <path d="M15 12l-4 2.5v-5l4 2.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

/* ---------- toast (sous l'en-tete d'AppShell) ---------- */

export function Toast({ message }: { message: string }) {
  const reduced = useReducedMotion();
  const y = reduced ? 0 : -16;
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y }}
          transition={{ duration: reduced ? 0.15 : 0.25 }}
          className="glass-strong fixed right-4 top-[calc(68px+env(safe-area-inset-top,16px))] z-50 max-w-[calc(100vw-2rem)] rounded-card bg-glass-solid/80 px-4 py-2.5 text-[13px] text-text-primary shadow-2xl shadow-black/50"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- squelettes de chargement en verre ---------- */

const BONE = "animate-pulse rounded-pill bg-white/10";

export function MoiSkeleton() {
  return (
    <div role="status" aria-label="Chargement" className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-10 pt-4 lg:pt-8">
      <div className="glass flex items-center gap-4 rounded-panel p-5">
        <div className="size-20 shrink-0 animate-pulse rounded-full bg-white/10" />
        <div className="flex flex-1 flex-col gap-3">
          <div className={`${BONE} h-6 w-2/3`} />
          <div className={`${BONE} h-4 w-1/3`} />
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[88, 104, 84, 92].map((w, i) => (
          <div key={i} className="glass h-9 shrink-0 rounded-pill" style={{ width: w }} />
        ))}
      </div>
      <div className="glass flex flex-col gap-4 rounded-panel p-5">
        <div className={`${BONE} h-4 w-1/2`} />
        <div className={`${BONE} h-4 w-full`} />
        <div className={`${BONE} h-4 w-5/6`} />
        <div className={`${BONE} h-4 w-2/3`} />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Chargement" className="mt-1 flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="glass h-9 w-32 rounded-pill" />
        <div className="glass h-9 w-24 rounded-pill" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="glass flex items-center gap-3 rounded-card p-3">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-white/10" />
          <div className="flex flex-1 flex-col gap-2">
            <div className={`${BONE} h-4 w-1/2`} />
            <div className={`${BONE} h-3 w-1/4`} />
          </div>
        </div>
      ))}
    </div>
  );
}
