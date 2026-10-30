// Credit de realisation : le nom de realisateur affiche vient de ce credit, plus
// du Responsable du film. Meme regle que la fonction SQL is_director_role
// (migration 20261008_film_management.sql) : les deux doivent rester alignees.

const DIRECTOR_ROLES = new Set(["realisateur", "realisatrice", "realisation", "corealisateur", "corealisatrice"]);

// Une partie de role normalisee : casse, accents, espaces, tirets.
const normalizeRole = (part: string) =>
  part.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-\s]/g, "");

// Le role est decoupe sur & , / puis chaque partie est normalisee.
// « Realisateur & DOP » compte.
export function isDirectorRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role.split(/[&,/]/).some((part) => DIRECTOR_ROLES.has(normalizeRole(part)));
}

/**
 * Roles d'une meme personne sur un film : une seule ligne de credit, roles separes
 * par « / » (decision du 30/10/2026). Renvoie null si le role y est deja.
 */
export function mergeRoles(current: string, added: string): string | null {
  const wanted = normalizeRole(added);
  if (current.split(/[&,/]/).some((part) => normalizeRole(part) === wanted)) return null;
  return `${current.trim()} / ${added.trim()}`;
}

/** Noms des realisateurs d'un film, separes par une virgule. Chaine vide si aucun. */
export function directorNames(credits: { role_on_project: string; name: string | null | undefined }[]): string {
  const names = credits
    .filter((c) => isDirectorRole(c.role_on_project) && c.name)
    .map((c) => c.name as string);
  return [...new Set(names)].join(", ");
}
