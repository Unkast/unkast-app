import type { ReactNode } from "react";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";

interface Props {
  /** Absente sur une carte verrouillée (la catégorie n'est pas transmise). */
  category?: ProjectCategory | null;
  /** Réalisateur ; sur une carte verrouillée, le rôle de la personne. */
  author?: string | null;
  year?: number | null;
  className?: string;
}

// Ligne d'infos d'un film, sous son titre : point de couleur + catégorie, puis
// auteur et année. Rien n'est posé sur la vignette d'un film (ni texte, ni
// badge) : la catégorie se lit ici, partout dans l'app.
export default function FilmMeta({ category, author, year, className = "" }: Props) {
  const parts: ReactNode[] = [];
  if (category) {
    parts.push(
      <span key="category" className="inline-flex shrink-0 items-center gap-1.5">
        <span className="size-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[category] }} aria-hidden="true" />
        {CATEGORY_LABELS[category]}
      </span>
    );
  }
  if (author) parts.push(<span key="author" className="truncate">{author}</span>);
  if (year != null) parts.push(<span key="year" className="shrink-0 font-mono">{year}</span>);
  if (parts.length === 0) return null;

  return (
    <div className={`flex min-w-0 items-center gap-1.5 text-[11px] text-text-secondary ${className}`}>
      {parts.map((part, i) => (
        <span key={i} className="contents">
          {i > 0 && <span className="shrink-0 text-text-tertiary" aria-hidden="true">·</span>}
          {part}
        </span>
      ))}
    </div>
  );
}
