import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

const BASE = "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-4 text-sm font-medium";
const INTERACTIVE =
  "transition-[transform,opacity,background-color,border-color,color]! duration-fast! after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime";

// Filtre selectionnable. Hauteur visuelle 36 px, cible tactile etendue a 44 px (after:).
// variant="static" : affichage seul, rendu en <span> (ni bouton, ni etat presse).
// variant="removable" : element d'une selection, le clic le retire (croix a droite).
//   Passer un aria-label (« Retirer … »).
export default function Chip({
  variant = "filter",
  selected = false,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "filter" | "static" | "removable"; selected?: boolean }) {
  if (variant === "static") {
    return (
      <span className={`${BASE} glass text-text-secondary ${className}`} {...(props as HTMLAttributes<HTMLSpanElement>)}>
        {children}
      </span>
    );
  }

  if (variant === "removable") {
    return (
      <button type="button" className={`${BASE} ${INTERACTIVE} glass max-w-full pr-3 text-text-secondary hover:text-text-primary ${className}`} {...props}>
        {children}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true" className="shrink-0">
          <path d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`${BASE} ${INTERACTIVE} ${
        selected ? "border border-white bg-white text-canvas" : "glass text-text-secondary hover:text-text-primary"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
