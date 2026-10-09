"use client";

import Chip from "@/components/ui/Chip";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  MAX_PLAYING_AGES,
  PLAYING_AGES,
  PLAYING_AGE_LABELS,
  ROLE_TYPES,
  ROLE_TYPE_LABELS,
  type CastingFields,
  type Language,
  type PlayingAge,
} from "@/lib/constants";

interface Props {
  value: CastingFields;
  onChange: (value: CastingFields) => void;
  /** Âge de jeu et type de rôles : proposés seulement aux métiers d'interprétation. */
  showActing: boolean;
}

const LABEL = "mb-2 block text-xs font-medium text-text-secondary";
const HINT = "font-normal text-text-tertiary";

// Champs facultatifs du profil (lot 8) : âge de jeu et type de rôles pour les
// comédiens, langues pour tous. Utilisé par /moi et par la fin de l'inscription.
// Un clic sur une valeur déjà choisie la retire : rien n'est obligatoire.
export default function CastingFieldsForm({ value, onChange, showActing }: Props) {
  const ages = value.playing_ages ?? [];
  const languages = value.languages ?? [];

  function toggleAge(age: PlayingAge) {
    const next = ages.includes(age) ? ages.filter((a) => a !== age) : [...ages, age];
    if (next.length > MAX_PLAYING_AGES) return;
    onChange({ ...value, playing_ages: next.length > 0 ? PLAYING_AGES.filter((a) => next.includes(a)) : null });
  }

  function toggleLanguage(language: Language) {
    const next = languages.includes(language) ? languages.filter((l) => l !== language) : [...languages, language];
    onChange({ ...value, languages: next.length > 0 ? LANGUAGES.filter((l) => next.includes(l)) : null });
  }

  return (
    <div className="flex flex-col gap-5">
      {showActing && (
        <>
          <div>
            <p className={LABEL}>
              Âge de jeu <span className={HINT}>(facultatif, {MAX_PLAYING_AGES} tranches au plus)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {PLAYING_AGES.map((age) => {
                const selected = ages.includes(age);
                return (
                  <Chip key={age} selected={selected} disabled={!selected && ages.length >= MAX_PLAYING_AGES} onClick={() => toggleAge(age)} className="disabled:opacity-40">
                    {PLAYING_AGE_LABELS[age]}
                  </Chip>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
              L&apos;âge que tu peux jouer à l&apos;écran, pas ton âge réel. Ta date de naissance n&apos;est jamais demandée.
            </p>
          </div>

          <div>
            <p className={LABEL}>
              Type de rôles <span className={HINT}>(facultatif)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {ROLE_TYPES.map((type) => (
                <Chip key={type} selected={value.role_type === type} onClick={() => onChange({ ...value, role_type: value.role_type === type ? null : type })}>
                  {ROLE_TYPE_LABELS[type]}
                </Chip>
              ))}
            </div>
          </div>
        </>
      )}

      <div>
        <p className={LABEL}>
          Langues parlées <span className={HINT}>(facultatif)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((language) => (
            <Chip key={language} selected={languages.includes(language)} onClick={() => toggleLanguage(language)}>
              {LANGUAGE_LABELS[language]}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
