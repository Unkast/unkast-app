import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/Button";

// Tout ce qu'un visiteur non connecté reçoit d'un film « membres seulement » :
// la ligne de la fonction SQL member_only_film_teasers, rien d'autre. Ni lien
// vidéo, ni description, ni équipe.
export type LockedFilm = {
  id: string;
  slug: string;
  title: string;
  poster_url: string | null;
  year: number | null;
};

// Ne garde que les cinq champs autorisés, quoi que renvoie la base : c'est le
// seul passage entre la réponse de la fonction et le navigateur.
export function toLockedFilm(row: LockedFilm): LockedFilm {
  return { id: row.id, slug: row.slug, title: row.title, poster_url: row.poster_url, year: row.year };
}

interface Props {
  film: LockedFilm;
  /** Adresse de la page du film : le titre devient un lien (liste d'une fiche).
   *  Absente, le titre est le titre de la page (h1). */
  href?: string;
  /** Adresse de connexion avec retour sur le film : affiche « Déjà membre ? ». */
  loginHref?: string;
  className?: string;
}

// Carte verrouillée d'un film réservé aux membres, vue par un visiteur non
// connecté. Sans état : utilisable côté serveur comme dans un composant client.
// overflow-clip (et non hidden) : la carte garde son 16:9 mais grandit si le
// texte ne tient pas (titre long, police agrandie).
export default function LockedFilmCard({ film, href, loginHref, className = "" }: Props) {
  const titleClass = "line-clamp-2 max-w-full break-words text-base font-semibold text-text-primary sm:text-lg";

  return (
    <article
      className={`glass relative isolate flex aspect-video w-full flex-col items-center justify-center overflow-clip rounded-media p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_50px_rgba(0,0,0,0.5)] sm:p-6 ${className}`}
    >
      {/* Image floutée à l'affichage, demandée en petite taille : le flou n'a
          pas besoin de définition. Décorative, donc alt vide. */}
      {film.poster_url && (
        <Image
          src={film.poster_url}
          alt=""
          fill
          sizes="160px"
          loading="lazy"
          className="-z-10 scale-125 object-cover blur-xl"
        />
      )}
      {/* Voile : lisibilité du texte sur l'image */}
      <span className="absolute inset-0 -z-10 bg-canvas/60" />

      {film.year != null && (
        <span className="absolute right-3 top-3 font-mono text-xs text-text-secondary">{film.year}</span>
      )}

      <span className="glass-strong flex size-9 shrink-0 items-center justify-center rounded-pill text-lime sm:size-11">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>

      {href ? (
        <Link href={href} className={`mt-2 transition hover:text-lime ${titleClass}`}>
          {film.title}
        </Link>
      ) : (
        <h1 className={`mt-2 ${titleClass}`}>{film.title}</h1>
      )}

      <p className="mt-1 text-xs leading-snug text-text-secondary sm:text-sm">
        Réservé aux membres. Inscris-toi pour voir ce film.
      </p>

      <Button href="/rejoindre" size="sm" className="mt-2.5 sm:mt-4">
        S&apos;inscrire
      </Button>

      {loginHref && (
        <p className="mt-2 text-xs text-text-secondary">
          Déjà membre ?{" "}
          <Link href={loginHref} className="text-text-primary underline underline-offset-2 hover:text-lime">
            Connecte-toi
          </Link>
        </p>
      )}
    </article>
  );
}
