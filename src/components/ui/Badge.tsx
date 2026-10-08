import type { ReactNode } from "react";

const LIME = "border-lime/30 bg-lime/15 text-lime shadow-[0_0_16px_rgba(200,255,0,0.25)]";

const VARIANTS = {
  verified: { label: "Vérifié", className: LIME },
  pro: { label: "Pro", className: `${LIME} uppercase tracking-wider` },
  available: { label: "Disponible", className: "border-white/10 bg-white/5 text-text-primary" },
  // Neutre : pas de libelle par defaut, le contenu est passe en children.
  neutral: { label: "", className: "border-white/10 bg-white/5 text-text-secondary" },
  pending: { label: "En attente", className: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400" },
  // Statuts d'un film, d'une demande ou d'une invitation (libelle surchargeable en children).
  published: { label: "Publié", className: LIME },
  rejected: { label: "Refusé", className: "border-red-500/25 bg-red-500/10 text-red-400" },
} as const;

export default function Badge({
  variant,
  children,
  className = "",
}: {
  variant: keyof typeof VARIANTS;
  children?: ReactNode;
  className?: string;
}) {
  const v = VARIANTS[variant];

  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-pill border px-2.5 text-xs font-semibold leading-none ${v.className} ${className}`}
    >
      {(variant === "verified" || variant === "published") && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 6.2 5 8.7l4.5-5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {variant === "available" && (
        <span className="size-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" aria-hidden="true" />
      )}
      {children ?? v.label}
    </span>
  );
}
