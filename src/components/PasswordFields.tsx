import type { ReactNode } from "react";
import PasswordInput from "@/components/PasswordInput";
import { PASSWORD_RULES, PASSWORD_MISMATCH, isPasswordRuleMet } from "@/lib/password";

// Mot de passe + confirmation (chacun avec son bouton afficher/masquer), chaque
// critere de la regle (vert une fois rempli) et l'ecart signale des que la
// confirmation est saisie. `children` s'affiche sous le premier champ (jauge
// de force de /rejoindre). Inscription et /auth/nouveau-mot-de-passe.
export default function PasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  label = "Mot de passe",
  children,
}: {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  label?: string;
  children?: ReactNode;
}) {
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <>
      <div>
        <PasswordInput
          label={label}
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Ex. : Tournage2027"
          aria-describedby="password-hint"
        />
        <ul id="password-hint" aria-label="Règles du mot de passe" className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {PASSWORD_RULES.map((rule) => {
            const ok = isPasswordRuleMet(rule, password);
            return (
              <li key={rule.label} className={`flex items-center gap-1.5 text-xs transition-colors duration-fast ${ok ? "text-green-400" : "text-text-secondary"}`}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
                  {ok ? (
                    <path d="M2.5 6.2 5 8.7l4.5-5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
                  )}
                </svg>
                {rule.label}
                <span className="sr-only">{ok ? " : respecté" : " : non respecté"}</span>
              </li>
            );
          })}
        </ul>
        {children}
      </div>
      <div>
        <PasswordInput
          label="Confirmer le mot de passe"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirmChange(e.target.value)}
          placeholder="Retape ton mot de passe"
          aria-invalid={mismatch}
          aria-describedby={mismatch ? "password-mismatch" : undefined}
        />
        {mismatch && (
          <p id="password-mismatch" role="alert" className="mt-1.5 text-xs text-red-400">{PASSWORD_MISMATCH}</p>
        )}
      </div>
    </>
  );
}
