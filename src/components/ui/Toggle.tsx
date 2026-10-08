import type { ReactNode } from "react";

// Interrupteur (checkbox role="switch"). Toute la ligne est cliquable, 44 px de haut.
export default function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={`relative flex min-h-11 cursor-pointer items-center justify-between gap-4 has-disabled:cursor-not-allowed has-disabled:opacity-50 ${className}`}>
      <span className="text-sm text-text-primary">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
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
