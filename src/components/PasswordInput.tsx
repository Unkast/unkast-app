"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import Field from "@/components/ui/Field";

// Champ mot de passe avec bouton afficher/masquer (masque par defaut). Habille
// ui/Field sans le modifier : le bouton est pose en bas a droite du bloc, a
// hauteur du champ (Field md : 44 px de haut, bouton 36 px, donc 4 px de marge).
// Seul le type de l'input change (password <-> text) : name, id et autoComplete
// restent identiques, le gestionnaire de mots de passe du navigateur continue de
// reconnaitre le champ. Connexion, inscription, nouveau mot de passe.
export default function PasswordInput({
  label,
  className = "",
  ...props
}: { label?: ReactNode } & Omit<ComponentProps<"input">, "type" | "size">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <Field {...props} label={label} type={visible ? "text" : "password"} className="[&_input]:pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        className="absolute right-1 bottom-1 flex size-9 items-center justify-center rounded-pill text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-lime"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {visible ? (
            <>
              <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.6 3.6M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              <path d="M3 3l18 18" />
            </>
          ) : (
            <>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
