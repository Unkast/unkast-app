// Sous-composants de presentation de l'espace /moi (aucune logique metier).
import type { ReactNode } from "react";

/* ---------- petit titre de section (capitales mono) ---------- */

export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary ${className}`}>{children}</p>
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
