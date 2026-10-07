import type { ButtonHTMLAttributes } from "react";

// Filtre selectionnable. Hauteur visuelle 36 px, cible tactile etendue a 44 px (after:).
export default function Chip({
  selected = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-4 text-sm font-medium transition-[transform,opacity,background-color,border-color,color]! duration-fast! after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime ${
        selected ? "border border-white bg-white text-canvas" : "glass text-text-secondary hover:text-text-primary"
      } ${className}`}
      {...props}
    />
  );
}
