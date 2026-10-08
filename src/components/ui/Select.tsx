import { useId, type ComponentProps, type ReactNode } from "react";

// <select> natif habille comme Field md (memes cotes, texte 16 px). Sans label visible,
// passer un aria-label. className va sur l'enveloppe, pas sur le <select>.
export default function Select({
  label,
  id,
  className = "",
  children,
  ...props
}: ComponentProps<"select"> & { label?: ReactNode }) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className="min-h-11 w-full appearance-none rounded-card border border-white/10 bg-white/5 pl-4 pr-9 text-base text-text-primary outline-none scheme-dark transition-[border-color,box-shadow]! duration-fast! focus:ring-3 focus:ring-lime/30 disabled:opacity-50 [&>option]:bg-glass-solid [&>option]:text-text-primary"
          {...props}
        >
          {children}
        </select>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
