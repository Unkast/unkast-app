import { ALL_ROLES, baseRole, closedRole } from "@/lib/constants";

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

// ---- Une ligne par personne et par film (20261102_credits_one_row_per_person.sql) ----
// Les roles d'une personne sur un film tiennent dans UNE ligne de project_credits,
// separes par « / », tous pris dans la liste fermee des metiers (jamais de texte libre),
// dans l'ordre de la liste (ALL_ROLES). Meme ordre que la migration.

/** Nombre maximum de metiers d'une personne sur un film. */
export const MAX_CREDIT_ROLES = 6;

const SEPARATOR = " / ";

/** Rang d'un metier dans la liste officielle (sa forme feminine a le meme rang). */
const roleRank = (role: string) => {
  const rank = ALL_ROLES.indexOf(baseRole(role));
  return rank === -1 ? ALL_ROLES.length : rank;
};

// Deux formes du meme metier (« Monteur », « Monteuse ») comptent pour un seul role.
const roleKey = (role: string) => normalizeRole(closedRole(role) ? baseRole(closedRole(role) as string) : role);

/** Les parties d'un role stocke (« Monteur / Etalonneur »), sans vide. */
export const splitRoles = (role: string) => role.split(/[&,/]/).map((part) => part.trim()).filter(Boolean);

/** Remet des metiers dans l'ordre canonique, sans doublon, joints par « / ». */
const joinRoles = (roles: string[]) => {
  const byKey = new Map<string, string>();
  for (const role of roles) if (!byKey.has(roleKey(role))) byKey.set(roleKey(role), role);
  return [...byKey.values()]
    .map((role, index) => ({ role, index }))
    .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.index - b.index)
    .map(({ role }) => role)
    .join(SEPARATOR);
};

/**
 * Valide les metiers d'un credit venus d'un client : une liste (ou un texte « A / B »)
 * dont CHAQUE metier est dans la liste officielle. Renvoie le role a stocker
 * (« Monteur / Etalonneur », ordre canonique, libelles de la liste), ou null si le
 * texte est vide, trop long en nombre de metiers, ou contient un metier hors liste.
 */
export function parseCreditRoles(input: unknown): string | null {
  const parts = Array.isArray(input) ? input : typeof input === "string" ? splitRoles(input) : null;
  if (!parts || parts.length === 0 || parts.length > MAX_CREDIT_ROLES) return null;
  const labels: string[] = [];
  for (const part of parts) {
    const label = typeof part === "string" ? closedRole(part) : null;
    if (!label) return null;
    labels.push(label);
  }
  const joined = joinRoles(labels);
  return splitRoles(joined).length <= MAX_CREDIT_ROLES ? joined : null;
}

/**
 * Roles d'une meme personne sur un film : une seule ligne de credit, roles separes
 * par « / » (decision du 30/10/2026), ordre canonique. Renvoie null si tous les
 * roles ajoutes y sont deja. Pas de plafond ici : il se controle a la saisie
 * (parseCreditRoles), une fusion d'une invitation acceptee ne doit jamais echouer.
 */
export function mergeRoles(current: string, added: string): string | null {
  const have = new Set(splitRoles(current).map(roleKey));
  const fresh = splitRoles(added).filter((role) => !have.has(roleKey(role)));
  if (fresh.length === 0) return null;
  return joinRoles([...splitRoles(current), ...fresh]);
}

/** Noms des realisateurs d'un film, separes par une virgule. Chaine vide si aucun. */
export function directorNames(credits: { role_on_project: string; name: string | null | undefined }[]): string {
  const names = credits
    .filter((c) => isDirectorRole(c.role_on_project) && c.name)
    .map((c) => c.name as string);
  return [...new Set(names)].join(", ");
}

/**
 * Credits d'un film a sa publication (p_credits de publish_project), partages par
 * api/dashboard/projects et api/signup : le role declare (credit automatique) et le
 * rôle supplementaire du Responsable forment UNE ligne ; chaque personne sans compte
 * aussi (un meme nom = une ligne). Un role hors liste est ecarte : `invalid` le dit.
 */
export function buildFilmCredits(
  userId: string,
  autoRole: string | null,
  ownerRole: unknown,
  ghosts: unknown
): { credits: { profile_id: string | null; ghost_name: string | null; role: string }[]; invalid: boolean } {
  let invalid = false;
  const credits: { profile_id: string | null; ghost_name: string | null; role: string }[] = [];

  const ownerParts = typeof ownerRole === "string" && ownerRole.trim() ? splitRoles(ownerRole) : [];
  const own = ownerParts.length ? parseCreditRoles([...(autoRole ? [autoRole] : []), ...ownerParts]) : null;
  if (ownerParts.length && !own) invalid = true;
  const ownerLine = own ?? (autoRole ? parseCreditRoles([autoRole]) : null);
  if (ownerLine) credits.push({ profile_id: userId, ghost_name: null, role: ownerLine });

  if (Array.isArray(ghosts)) {
    const byName = new Map<string, { ghost_name: string; roles: string[] }>();
    for (const g of ghosts) {
      if (!g?.name || !g?.role) continue;
      const parsed = parseCreditRoles(g.role);
      if (!parsed) {
        invalid = true;
        continue;
      }
      const name = String(g.name).trim();
      const entry = byName.get(name.toLowerCase()) ?? { ghost_name: name, roles: [] };
      entry.roles.push(...splitRoles(parsed));
      byName.set(name.toLowerCase(), entry);
    }
    for (const { ghost_name, roles } of byName.values()) {
      const role = parseCreditRoles(roles);
      if (role) credits.push({ profile_id: null, ghost_name, role });
      else invalid = true;
    }
  }
  return { credits, invalid };
}
