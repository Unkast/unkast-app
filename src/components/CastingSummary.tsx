import {
  LANGUAGE_LABELS,
  PLAYING_AGE_LABELS,
  ROLE_TYPE_LABELS,
  type Language,
  type PlayingAge,
  type RoleType,
} from "@/lib/constants";

interface Props {
  playingAges?: string[] | null;
  roleType?: string | null;
  languages?: string[] | null;
  className?: string;
}

// Champs facultatifs d'un profil (lot 8), en lecture : une ligne par champ rempli,
// rien du tout si aucun ne l'est. Une valeur inconnue (liste modifiée depuis) est ignorée.
export default function CastingSummary({ playingAges, roleType, languages, className = "" }: Props) {
  const ages = (playingAges ?? []).map((a) => PLAYING_AGE_LABELS[a as PlayingAge]).filter(Boolean);
  // « Sans précision » n'apprend rien à qui lit la fiche : il sert seulement à la recherche.
  const type = roleType && roleType !== "sans_precision" ? ROLE_TYPE_LABELS[roleType as RoleType] : null;
  const spoken = (languages ?? []).map((l) => LANGUAGE_LABELS[l as Language]).filter(Boolean);

  const rows = [
    ages.length > 0 && { label: "Âge de jeu", value: ages.join(", ") },
    type && { label: "Rôles", value: type },
    spoken.length > 0 && { label: "Langues", value: spoken.join(", ") },
  ].filter((r): r is { label: string; value: string } => Boolean(r));
  if (rows.length === 0) return null;

  return (
    <dl className={`flex flex-col gap-1 text-sm ${className}`}>
      {rows.map((row) => (
        <div key={row.label} className="flex gap-2">
          <dt className="shrink-0 text-text-tertiary">{row.label}</dt>
          <dd className="min-w-0 text-text-secondary">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
