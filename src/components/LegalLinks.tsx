import Link from "next/link";
import type { Ref } from "react";
import { AGE_MINIMUM, LEGAL_LINKS } from "@/lib/legal";

const [CGU, PRIVACY] = LEGAL_LINKS;

const LINK =
  "underline underline-offset-2 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime";

const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

// Ligne discrete de liens vers les trois pages legales (pied de page, ecran des CGU).
// newTab : a utiliser la ou quitter la page ferait perdre une saisie.
// L'alignement est a la charge de l'appelant (justify-center...).
export default function LegalLinks({ newTab = false, className = "" }: { newTab?: boolean; className?: string }) {
  return (
    <nav
      aria-label="Informations légales"
      className={`flex flex-wrap items-center gap-x-4 text-[11px] text-text-tertiary ${className}`}
    >
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} {...(newTab ? NEW_TAB : {})} className={`py-2 ${LINK}`}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

// Case d'acceptation des CGU et de la politique de confidentialite (inscription,
// ecran « Les CGU ont ete mises a jour »). Les liens s'ouvrent dans un nouvel
// onglet : la saisie en cours n'est pas perdue.
export function TermsCheckbox({
  checked,
  onChange,
  inputRef,
  ageNote = false,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  inputRef?: Ref<HTMLInputElement>;
  ageNote?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-card border border-white/10 bg-white/5 p-3">
        <input
          ref={inputRef}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        />
        <span className="text-[13px] leading-relaxed text-text-primary">
          J&apos;accepte les{" "}
          <Link href={CGU.href} {...NEW_TAB} className={LINK}>CGU</Link> et la{" "}
          <Link href={PRIVACY.href} {...NEW_TAB} className={LINK}>politique de confidentialité</Link>.
        </span>
      </label>
      {ageNote && (
        <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
          Unkast est réservé aux personnes majeures ({AGE_MINIMUM} ans et plus).
        </p>
      )}
    </div>
  );
}
