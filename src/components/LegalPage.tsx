import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL_LINKS, TERMS_DATE_LABEL, TERMS_VERSION, isBlank } from "@/lib/legal";

// Mise en page commune des pages legales (/cgu, /confidentialite,
// /mentions-legales). Composants serveur, sans etat.

/** Information de la societe : surlignee tant qu'elle n'est pas remplie (src/lib/legal.ts). */
export function Info({ value }: { value: string }) {
  if (!isBlank(value)) return <>{value}</>;
  return (
    <mark className="rounded bg-amber-400/20 px-1 font-mono text-[0.9em] text-amber-300">{value}</mark>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-text-secondary [&_a]:text-text-primary [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-text-primary [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export default function LegalPage({
  title,
  intro,
  current,
  children,
}: {
  title: string;
  intro?: ReactNode;
  /** Adresse de la page courante, pour la navigation entre les trois pages. */
  current: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <nav aria-label="Pages légales" className="mb-6 flex flex-wrap gap-2">
        {LEGAL_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={l.href === current ? "page" : undefined}
            className={`rounded-pill border px-3 py-1.5 text-xs ${
              l.href === current
                ? "border-lime/40 bg-lime/10 text-text-primary"
                : "border-white/10 bg-white/5 text-text-secondary hover:border-white/20"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">{title}</h1>
      <p className="mt-2 font-mono text-xs text-text-tertiary">
        Version {TERMS_VERSION}, en vigueur depuis le {TERMS_DATE_LABEL}
      </p>
      {intro && <p className="mt-5 text-[15px] leading-relaxed text-text-secondary">{intro}</p>}

      {children}
    </main>
  );
}
