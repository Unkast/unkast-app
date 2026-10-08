// Credit de realisation : le nom de realisateur affiche vient de ce credit, plus
// du Responsable du film. Meme regle que la fonction SQL is_director_role
// (migration 20261008_film_management.sql) : les deux doivent rester alignees.

const DIRECTOR_ROLES = new Set(["realisateur", "realisatrice", "realisation", "corealisateur", "corealisatrice"]);

// Le role est decoupe sur & , / puis chaque partie est normalisee
// (casse, accents, espaces, tirets). « Realisateur & DOP » compte.
export function isDirectorRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role.split(/[&,/]/).some((part) =>
    DIRECTOR_ROLES.has(
      part.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-\s]/g, "")
    )
  );
}

/** Noms des realisateurs d'un film, separes par une virgule. Chaine vide si aucun. */
export function directorNames(credits: { role_on_project: string; name: string | null | undefined }[]): string {
  const names = credits
    .filter((c) => isDirectorRole(c.role_on_project) && c.name)
    .map((c) => c.name as string);
  return [...new Set(names)].join(", ");
}
