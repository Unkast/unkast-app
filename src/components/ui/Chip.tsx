import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

const BASE = "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-4 text-sm font-medium";

// Filtre selectionnable. Hauteur visuelle 36 px, cible tactile etendue a 44 px (after:).
// variant="static" : affichage seul, rendu en <span> (ni bouton, ni etat presse).
export default function Chip({
  variant = "filter",
  selected = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "filter" | "static"; selected?: boolean }) {
  if (variant === "static") {
    return <span className={`${BASE} glass text-text-secondary ${className}`} {...(props as HTMLAttributes<HTMLSpanElement>)} />;
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`${BASE} transition-[transform,opacity,background-color,border-color,color]! duration-fast! after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime ${
        selected ? "border border-white bg-white text-canvas" : "glass text-text-secondary hover:text-text-primary"
      } ${className}`}
      {...props}
    />
  );
}
