import type { ProjectCategory, ProjectVisibility, DeclaredRole, CareerKind } from "@/types/database";

export const CATEGORY_COLORS: Record<ProjectCategory, string> = {
  "court-metrage": "#C8FF00",
  "moyen-metrage": "#38BDF8",
  "long-metrage": "#E879F9",
  publicite: "#00D4AA",
  clip: "#AA88FF",
  documentaire: "#FF8844",
  "bande-demo": "#FF5577",
  "scene-extrait": "#FF5577",
  serie: "#FFD166",
};

export const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  "court-metrage": "Court-métrage",
  "moyen-metrage": "Moyen métrage",
  "long-metrage": "Long métrage",
  publicite: "Publicité",
  clip: "Clip",
  documentaire: "Documentaire",
  "bande-demo": "Bande démo",
  "scene-extrait": "Scène / Extrait",
  serie: "Série",
};

// Serie (web-serie, serie courte) : une playlist YouTube, publiee comme un seul
// film. Sa categorie ne se change pas, dans un sens comme dans l'autre.
export const SERIES_CATEGORY: ProjectCategory = "serie";
export const episodesLabel = (count: number) => `${count} épisode${count > 1 ? "s" : ""}`;

// 2 -> 3 le 2026-08-10 (nouveau modele economique). Les textes qui annoncent
// la limite l'interpolent depuis ces constantes : ne jamais reecrire le nombre
// en dur, il a deja diverge une fois.
export const MAX_PROJECTS_FREE = 3;
// Pro : illimite (pas de constante). Le plafond gratuit compte les films dont on
// est Responsable, en ligne ou en attente de validation (project_slots_used).

export const ACCOUNT_TYPES = {
  talent: "J'ai participé à un projet",
  creator: "Je publie des œuvres",
  recruiter: "Je cherche des talents",
};

export const ROLES_BY_CATEGORY: Record<string, string[]> = {
  "Réalisation": ["Réalisateur", "Premier assistant réalisateur", "Deuxième assistant réalisateur", "Stagiaire réalisation", "Scripte", "Réalisateur second équipe"],
  "Image": ["Directeur de la photographie", "Cadreur", "Premier assistant caméra", "Deuxième assistant caméra", "Steadicameur", "Drone operator", "Photographe de plateau", "Chef électricien", "Électricien", "Chef machiniste", "Machiniste", "Étalonneur"],
  "Son": ["Ingénieur du son", "Perchiste", "Monteur son", "Mixeur", "Compositeur", "Superviseur musical", "Bruiteur"],
  "Montage & Post-production": ["Monteur", "Assistant monteur", "Monteur VFX", "Superviseur VFX", "Motion designer", "Coloriste"],
  "Production": ["Producteur", "Producteur délégué", "Producteur exécutif", "Directeur de production", "Régisseur général", "Régisseur adjoint", "Régisseur de plateau", "Chargé de production", "Assistant de production", "Directeur de casting", "Assistant casting"],
  "Décors & Costumes": ["Chef décorateur", "Assistant décorateur", "Ensemblier", "Accessoiriste", "Chef costumier", "Costumier", "Habilleuse", "Chef maquilleur", "Maquilleur", "Assistant maquilleur", "Chef coiffeur", "Coiffeur", "Coordinateur effets spéciaux", "Technicien effets spéciaux"],
  "Interprétation": ["Comédien", "Comédien de complément", "Cascadeur", "Coordinateur de cascades", "Doublure", "Doublure lumière", "Voix off", "Comédien de doublage"],
  "Écriture": ["Scénariste", "Dialoguiste", "Story-boardeur", "Auteur"],
  "Distribution & Communication": ["Distributeur", "Agent artistique", "Attaché de presse", "Chargé de communication", "Community manager", "Graphiste", "Affichiste", "Bande-annonciste"],
  "Technique spécialisé": ["Chef opérateur son", "Technicien HF", "Vidéo assist", "Technicien plateau", "Coordinateur post-production", "Superviseur post-production", "Producteur de post-production"],
  "Autres": ["Directeur artistique", "Concepteur sonore", "Illustrateur", "Animateur", "Chef monteur publicité", "Coordinateur de tournage", "Logisticien", "Chauffeur de production"],
};

export const ALL_ROLES = Object.values(ROLES_BY_CATEGORY).flat();

// ---- Formes feminines des metiers --------------------------------------------
// Chaque metier de la liste officielle a, quand elle existe, sa forme feminine la
// plus courante dans le cinema. La personne choisit la forme qu'elle affiche (clic
// sur la pastille du metier dans RoleSelector) : c'est cette forme qui est
// enregistree, telle quelle, dans profile_roles.role_name ou dans le role au
// generique d'un film. Aucune colonne ne porte ce choix.
// Un metier absent d'ici s'ecrit pareil aux deux genres (Scripte, Perchiste,
// Scenariste, Motion designer). « Habilleuse » est le seul metier dont la forme
// officielle est feminine : son autre forme est « Habilleur ».
export const ROLE_FEMININE: Record<string, string> = {
  "Réalisateur": "Réalisatrice",
  "Premier assistant réalisateur": "Première assistante réalisatrice",
  "Deuxième assistant réalisateur": "Deuxième assistante réalisatrice",
  "Réalisateur second équipe": "Réalisatrice seconde équipe",
  "Directeur de la photographie": "Directrice de la photographie",
  "Cadreur": "Cadreuse",
  "Premier assistant caméra": "Première assistante caméra",
  "Deuxième assistant caméra": "Deuxième assistante caméra",
  "Steadicameur": "Steadicameuse",
  "Chef électricien": "Cheffe électricienne",
  "Électricien": "Électricienne",
  "Chef machiniste": "Cheffe machiniste",
  "Étalonneur": "Étalonneuse",
  "Ingénieur du son": "Ingénieure du son",
  "Monteur son": "Monteuse son",
  "Mixeur": "Mixeuse",
  "Compositeur": "Compositrice",
  "Superviseur musical": "Superviseuse musicale",
  "Bruiteur": "Bruiteuse",
  "Monteur": "Monteuse",
  "Assistant monteur": "Assistante monteuse",
  "Monteur VFX": "Monteuse VFX",
  "Superviseur VFX": "Superviseuse VFX",
  "Producteur": "Productrice",
  "Producteur délégué": "Productrice déléguée",
  "Producteur exécutif": "Productrice exécutive",
  "Directeur de production": "Directrice de production",
  "Régisseur général": "Régisseuse générale",
  "Régisseur adjoint": "Régisseuse adjointe",
  "Régisseur de plateau": "Régisseuse de plateau",
  "Chargé de production": "Chargée de production",
  "Assistant de production": "Assistante de production",
  "Directeur de casting": "Directrice de casting",
  "Assistant casting": "Assistante casting",
  "Chef décorateur": "Cheffe décoratrice",
  "Assistant décorateur": "Assistante décoratrice",
  "Ensemblier": "Ensemblière",
  "Chef costumier": "Cheffe costumière",
  "Costumier": "Costumière",
  "Habilleuse": "Habilleur",
  "Chef maquilleur": "Cheffe maquilleuse",
  "Maquilleur": "Maquilleuse",
  "Assistant maquilleur": "Assistante maquilleuse",
  "Chef coiffeur": "Cheffe coiffeuse",
  "Coiffeur": "Coiffeuse",
  "Coordinateur effets spéciaux": "Coordinatrice effets spéciaux",
  "Technicien effets spéciaux": "Technicienne effets spéciaux",
  "Comédien": "Comédienne",
  "Comédien de complément": "Comédienne de complément",
  "Cascadeur": "Cascadeuse",
  "Coordinateur de cascades": "Coordinatrice de cascades",
  "Comédien de doublage": "Comédienne de doublage",
  "Story-boardeur": "Story-boardeuse",
  "Auteur": "Autrice",
  "Distributeur": "Distributrice",
  "Agent artistique": "Agente artistique",
  "Attaché de presse": "Attachée de presse",
  "Chargé de communication": "Chargée de communication",
  "Chef opérateur son": "Cheffe opératrice son",
  "Technicien HF": "Technicienne HF",
  "Technicien plateau": "Technicienne plateau",
  "Coordinateur post-production": "Coordinatrice post-production",
  "Superviseur post-production": "Superviseuse post-production",
  "Producteur de post-production": "Productrice de post-production",
  "Directeur artistique": "Directrice artistique",
  "Concepteur sonore": "Conceptrice sonore",
  "Illustrateur": "Illustratrice",
  "Animateur": "Animatrice",
  "Chef monteur publicité": "Cheffe monteuse publicité",
  "Coordinateur de tournage": "Coordinatrice de tournage",
  "Logisticien": "Logisticienne",
  "Chauffeur de production": "Chauffeuse de production",
};

const ROLE_BASE: Record<string, string> = Object.fromEntries(Object.entries(ROLE_FEMININE).map(([base, other]) => [other, base]));

/** Metier de la liste officielle correspondant a une forme (« Monteuse » -> « Monteur »). */
export function baseRole(role: string): string {
  return ROLE_BASE[role] ?? role;
}

/** L'autre forme d'un metier (« Monteur » <-> « Monteuse »), ou null s'il n'en a qu'une. */
export function otherRoleForm(role: string): string | null {
  return ROLE_FEMININE[role] ?? ROLE_BASE[role] ?? null;
}

/** Les deux formes de chaque metier : toute recherche par metier passe par ici. */
export function withBothForms(roles: string[]): string[] {
  return [...new Set(roles.flatMap((r) => { const base = baseRole(r); return ROLE_FEMININE[base] ? [base, ROLE_FEMININE[base]] : [base]; }))];
}

/** Toutes les formes acceptees pour un metier de profil. */
export const ALL_ROLE_FORMS = [...ALL_ROLES, ...Object.values(ROLE_FEMININE)];

// Metiers d'interpretation : seuls ces profils declarent un age de jeu et un type de roles.
export const ACTING_ROLES = ROLES_BY_CATEGORY["Interprétation"];
export function isActingRole(role: string): boolean {
  return ACTING_ROLES.includes(baseRole(role));
}

// ---- Familles de metiers ------------------------------------------------------
// 8 familles, une couleur chacune (point de couleur des pastilles de role sur une fiche).
// Couleurs distinctes en teinte ET en luminosite, pour rester lisibles sans la couleur.
export const ROLE_FAMILIES = [
  { id: "interpretation", label: "Interprétation", color: "#FF8FA3" },
  { id: "realisation", label: "Réalisation & écriture", color: "#F4E4BC" },
  { id: "image", label: "Image", color: "#3B82F6" },
  { id: "son", label: "Son", color: "#7DD3FC" },
  { id: "montage", label: "Montage & post-production", color: "#A78BFA" },
  { id: "production", label: "Production", color: "#F97316" },
  { id: "decor", label: "Décor, costume, maquillage", color: "#BE185D" },
  { id: "musique", label: "Musique", color: "#14B8A6" },
] as const;
export type RoleFamilyId = (typeof ROLE_FAMILIES)[number]["id"];

// Famille de chaque categorie du selecteur, puis les metiers ranges ailleurs que leur categorie.
const CATEGORY_FAMILY: Record<string, RoleFamilyId> = {
  "Réalisation": "realisation",
  "Écriture": "realisation",
  "Image": "image",
  "Son": "son",
  "Montage & Post-production": "montage",
  "Production": "production",
  "Distribution & Communication": "production",
  "Décors & Costumes": "decor",
  "Interprétation": "interpretation",
  "Technique spécialisé": "production",
  "Autres": "production",
};
const ROLE_FAMILY_OVERRIDES: Record<string, RoleFamilyId> = {
  "Compositeur": "musique",
  "Superviseur musical": "musique",
  "Étalonneur": "montage",
  "Chef opérateur son": "son",
  "Technicien HF": "son",
  "Concepteur sonore": "son",
  "Vidéo assist": "image",
  "Coordinateur post-production": "montage",
  "Superviseur post-production": "montage",
  "Producteur de post-production": "montage",
  "Chef monteur publicité": "montage",
  "Animateur": "montage",
  "Illustrateur": "decor",
  "Directeur artistique": "decor",
};
const ROLE_FAMILY: Record<string, RoleFamilyId> = Object.fromEntries(
  Object.entries(ROLES_BY_CATEGORY).flatMap(([category, roles]) =>
    roles.map((role) => [role, ROLE_FAMILY_OVERRIDES[role] ?? CATEGORY_FAMILY[category]])
  )
);
/** Famille d'un metier officiel (forme masculine ou feminine), null pour un libelle hors liste. */
export function roleFamily(role: string) {
  const id = ROLE_FAMILY[baseRole(role)];
  return ROLE_FAMILIES.find((f) => f.id === id) ?? null;
}

// Roles d'un credit, ramenes aux metiers officiels quand c'est possible. Un credit saisi
// librement (« Scenariste & Comedienne », sans accents) est decoupe et corrige ; si un
// morceau n'est pas un metier officiel, le libelle est garde tel quel.
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const ROLE_BY_FOLDED = new Map(ALL_ROLE_FORMS.map((role) => [fold(role), role]));
export function creditRoles(label: string): string[] {
  const whole = ROLE_BY_FOLDED.get(fold(label));
  if (whole) return [whole];
  const parts = label.split(/\s*(?:&|\/|,|\bet\b)\s*/).map((part) => ROLE_BY_FOLDED.get(fold(part)));
  return parts.length > 1 && parts.every(Boolean) ? (parts as string[]) : [label];
}

// ---- Champs facultatifs du profil (lot 8) -----------------------------------
// Listes FERMEES, alignees sur les CHECK de la migration
// 20261016_profile_casting_fields.sql : toute valeur ajoutee ici doit l'etre la-bas.

// Age de jeu : des tranches, jamais de date de naissance. 2 tranches au plus.
export const PLAYING_AGES = ["18-25", "25-35", "35-50", "50+"] as const;
export type PlayingAge = (typeof PLAYING_AGES)[number];
export const MAX_PLAYING_AGES = 2;
export const PLAYING_AGE_LABELS: Record<PlayingAge, string> = {
  "18-25": "18 à 25 ans",
  "25-35": "25 à 35 ans",
  "35-50": "35 à 50 ans",
  "50+": "50 ans et plus",
};

// Type de roles joues.
export const ROLE_TYPES = ["femme", "homme", "sans_precision"] as const;
export type RoleType = (typeof ROLE_TYPES)[number];
export const ROLE_TYPE_LABELS: Record<RoleType, string> = {
  femme: "Femme",
  homme: "Homme",
  sans_precision: "Sans précision",
};

// Langues parlees.
export const LANGUAGES = [
  "fr", "en", "es", "it", "de", "pt", "nl", "pl", "ro", "ru", "tr",
  "ar", "he", "zh", "ja", "ko", "lsf", "lsfb",
] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_LABELS: Record<Language, string> = {
  fr: "Français",
  en: "Anglais",
  es: "Espagnol",
  it: "Italien",
  de: "Allemand",
  pt: "Portugais",
  nl: "Néerlandais",
  pl: "Polonais",
  ro: "Roumain",
  ru: "Russe",
  tr: "Turc",
  ar: "Arabe",
  he: "Hébreu",
  zh: "Mandarin",
  ja: "Japonais",
  ko: "Coréen",
  lsf: "Langue des signes française",
  lsfb: "Langue des signes de Belgique francophone",
};

export type CastingFields = {
  playing_ages: PlayingAge[] | null;
  role_type: RoleType | null;
  languages: Language[] | null;
};

/**
 * Controle serveur des champs facultatifs. Chaque champ est independant : absent
 * (undefined) = non modifie, null ou liste vide = efface. Une valeur hors liste
 * est refusee, jamais corrigee en silence.
 */
export function checkCastingFields(
  input: { playing_ages?: unknown; role_type?: unknown; languages?: unknown }
): { ok: true; fields: Partial<CastingFields> } | { ok: false; error: string } {
  const fields: Partial<CastingFields> = {};
  const list = <T extends string>(value: unknown, allowed: readonly T[]): T[] | null | "invalid" => {
    if (value === null) return null;
    if (!Array.isArray(value) || value.some((v) => !allowed.includes(v as T))) return "invalid";
    const clean = allowed.filter((a) => value.includes(a)); // dedoublonne, ordre de la liste
    return clean.length > 0 ? clean : null;
  };

  if (input.playing_ages !== undefined) {
    const ages = list(input.playing_ages, PLAYING_AGES);
    if (ages === "invalid") return { ok: false, error: "Âge de jeu invalide." };
    if (ages && ages.length > MAX_PLAYING_AGES) {
      return { ok: false, error: `Tu peux choisir ${MAX_PLAYING_AGES} tranches d'âge de jeu au maximum.` };
    }
    fields.playing_ages = ages;
  }
  if (input.role_type !== undefined) {
    if (input.role_type !== null && !ROLE_TYPES.includes(input.role_type as RoleType)) {
      return { ok: false, error: "Type de rôles invalide." };
    }
    fields.role_type = input.role_type as RoleType | null;
  }
  if (input.languages !== undefined) {
    const languages = list(input.languages, LANGUAGES);
    if (languages === "invalid") return { ok: false, error: "Langue invalide." };
    fields.languages = languages;
  }
  return { ok: true, fields };
}

// Metiers d'un profil : 5 au plus, pris dans la liste officielle (ALL_ROLES), sous
// leur forme masculine ou feminine (ALL_ROLE_FORMS).
export const MAX_PROFILE_ROLES = 5;

/**
 * Controle serveur des metiers d'un profil (inscription, finalisation, /moi).
 * `alreadyOwned` : metiers deja sur le profil. Un metier hors liste saisi avant
 * cette regle y est tolere, pour ne pas bloquer l'enregistrement d'un profil
 * existant ; il ne peut plus etre ajoute.
 */
export function checkProfileRoles(
  roles: unknown,
  alreadyOwned: string[] = []
): { ok: true; roles: string[] } | { ok: false; error: string } {
  if (!Array.isArray(roles) || roles.some((r) => typeof r !== "string")) {
    return { ok: false, error: "Liste de métiers invalide." };
  }
  // Un metier ne compte qu'une fois, sous la forme choisie (masculine ou feminine).
  const seen = new Set<string>();
  const clean = (roles as string[]).map((r) => r.trim()).filter((r) => {
    if (!r || seen.has(baseRole(r))) return false;
    seen.add(baseRole(r));
    return true;
  });
  if (clean.length > MAX_PROFILE_ROLES) {
    return { ok: false, error: `Tu peux choisir ${MAX_PROFILE_ROLES} métiers au maximum.` };
  }
  const unknown = clean.filter((r) => !ALL_ROLE_FORMS.includes(r) && !alreadyOwned.includes(r));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Ce métier n'est pas dans la liste : ${unknown.join(", ")}. Choisis un métier proposé.`,
    };
  }
  return { ok: true, roles: clean };
}

export const ROLE_CATEGORIES = [
  {
    id: 'realisation',
    label: 'Réalisation',
    gradient: 'linear-gradient(135deg, #1a0d2e, #2d1b4e)',
    accent: '#a855f7',
    icon: 'camera-movie' as const,
    roles: ROLES_BY_CATEGORY["Réalisation"],
  },
  {
    id: 'image',
    label: 'Image',
    gradient: 'linear-gradient(135deg, #0d1a2e, #1b2d4e)',
    accent: '#3b82f6',
    icon: 'camera' as const,
    roles: ROLES_BY_CATEGORY["Image"],
  },
  {
    id: 'son',
    label: 'Son',
    gradient: 'linear-gradient(135deg, #2e1a0d, #4e2d1b)',
    accent: '#f97316',
    icon: 'microphone' as const,
    roles: ROLES_BY_CATEGORY["Son"],
  },
  {
    id: 'montage',
    label: 'Montage & Post',
    gradient: 'linear-gradient(135deg, #0d2e1a, #1b4e2d)',
    accent: '#22c55e',
    icon: 'scissors' as const,
    roles: ROLES_BY_CATEGORY["Montage & Post-production"],
  },
  {
    id: 'production',
    label: 'Production',
    gradient: 'linear-gradient(135deg, #2e2a0d, #4e451b)',
    accent: '#eab308',
    icon: 'briefcase' as const,
    roles: ROLES_BY_CATEGORY["Production"],
  },
  {
    id: 'decors',
    label: 'Décors & Costumes',
    gradient: 'linear-gradient(135deg, #2e0d1a, #4e1b2d)',
    accent: '#ec4899',
    icon: 'palette' as const,
    roles: ROLES_BY_CATEGORY["Décors & Costumes"],
  },
  {
    id: 'interpretation',
    label: 'Interprétation',
    gradient: 'linear-gradient(135deg, #1a0d0d, #2e1515)',
    accent: '#ef4444',
    icon: 'star' as const,
    roles: ROLES_BY_CATEGORY["Interprétation"],
  },
  {
    id: 'ecriture',
    label: 'Écriture',
    gradient: 'linear-gradient(135deg, #0d1a1a, #1b2e2e)',
    accent: '#06b6d4',
    icon: 'pen' as const,
    roles: ROLES_BY_CATEGORY["Écriture"],
  },
  {
    id: 'distribution',
    label: 'Distribution',
    gradient: 'linear-gradient(135deg, #1a1a0d, #2e2e1b)',
    accent: '#84cc16',
    icon: 'megaphone' as const,
    roles: ROLES_BY_CATEGORY["Distribution & Communication"],
  },
  {
    id: 'technique',
    label: 'Technique',
    gradient: 'linear-gradient(135deg, #0d0d1a, #1b1b2e)',
    accent: '#8b5cf6',
    icon: 'tool' as const,
    roles: ROLES_BY_CATEGORY["Technique spécialisé"],
  },
  {
    id: 'autres',
    label: 'Autres',
    gradient: 'linear-gradient(135deg, #1a1a1a, #2e2e2e)',
    accent: '#888',
    icon: 'grid' as const,
    roles: ROLES_BY_CATEGORY["Autres"],
  },
];

export const POPULAR_ROLES = [
  'Comédien',
  'Réalisateur',
  'Monteur',
  'Directeur de la photographie',
  'Scénariste',
  'Producteur',
  'Ingénieur du son',
  'Chef décorateur',
];

// -----------------------------------------------------------------------------
// Gestion des films (migration 20261008_film_management.sql)
// -----------------------------------------------------------------------------

// Declaration de droits, obligatoire a la publication. Changer le texte impose de
// changer la version : elle est enregistree avec chaque declaration.
export const RIGHTS_DECLARATION_VERSION = "2026-10-08";
export const RIGHTS_DECLARATION_TEXT = "Je détiens les droits de diffusion ou j'ai l'accord de leur détenteur";

// Publicite et clip : accord du client ou du label, a cocher en plus.
export const CLIENT_AUTHORIZATION_TEXT = "Le client ou le label a autorisé la diffusion publique";
export const CLIENT_AUTHORIZATION_CATEGORIES: ProjectCategory[] = ["publicite", "clip"];

// Role declare sur le film. `credit` : credit cree automatiquement pour le declarant.
export const DECLARED_ROLES: { value: DeclaredRole; label: string; credit: string | null }[] = [
  { value: "realisateur", label: "Réalisateur", credit: "Réalisateur" },
  { value: "producteur", label: "Producteur", credit: "Producteur" },
  { value: "ayant_droit", label: "Ayant droit", credit: null },
  { value: "autre", label: "Autre", credit: null },
];

// Visibilite d'un film, choisie par le Responsable.
export const PROJECT_VISIBILITIES: { value: ProjectVisibility; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "members", label: "Membres seulement" },
  { value: "unpublished", label: "Dépublié" },
];
export const MEMBERS_ONLY_WARNING =
  "Unkast limite l'accès aux membres connectés, mais ne peut pas garantir qu'un festival ne considère pas cela comme une diffusion. La décision t'appartient.";

// Parcours du profil : entrees declaratives, texte uniquement.
export const MAX_CAREER_ENTRIES = 30;
export const CAREER_KINDS: { value: CareerKind; label: string }[] = [
  { value: "long-metrage", label: "Long-métrage" },
  { value: "court-metrage", label: "Court-métrage" },
  { value: "serie", label: "Série" },
  { value: "web-serie", label: "Web-série" },
  { value: "telefilm", label: "Téléfilm" },
  { value: "documentaire", label: "Documentaire" },
  { value: "publicite", label: "Publicité" },
  { value: "clip", label: "Clip" },
  { value: "emission", label: "Émission" },
  { value: "theatre", label: "Théâtre" },
  { value: "autre", label: "Autre" },
];

// Coordonnees refusees dans la bio, le Parcours et la description des films.
export const CONTACT_REFUSED_MESSAGE =
  "Ajoute tes coordonnées dans la section Contact de ton profil. Elles ne sont pas affichées publiquement.";

// -----------------------------------------------------------------------------
// Refus d'un film par l'admin (migration 20261011_film_refusal_reasons.sql)
// -----------------------------------------------------------------------------
// `label` : pastille de l'admin. `message` : ce que lit le Responsable (email et
// carte du film refuse). « autre » n'a pas de message : c'est la note libre de
// l'admin qui est montree. Les valeurs sont aussi dans le CHECK de la base.
export const REFUSAL_REASONS: { value: string; label: string; message: string | null }[] = [
  { value: "son", label: "Son", message: "La qualité du son ne permet pas de bien apprécier le film." },
  { value: "image", label: "Image", message: "La qualité de l'image ne permet pas de bien apprécier le film." },
  { value: "amateur", label: "Trop amateur", message: "Le film n'est pas encore au niveau de finition que nous présentons sur Unkast." },
  { value: "hors_sujet", label: "Hors sujet", message: "Le film ne correspond pas à ce que nous présentons sur Unkast." },
  { value: "droits", label: "Droits douteux", message: "Nous n'avons pas pu vérifier que tu peux diffuser ce film. Écris-nous si tu as un justificatif." },
  { value: "autre", label: "Autre", message: null },
];

/** Phrases a montrer au Responsable pour une liste de motifs (sans la note libre). */
export function refusalMessages(reasons: string[] | null | undefined): string[] {
  return REFUSAL_REASONS.filter((r) => r.message && (reasons ?? []).includes(r.value)).map((r) => r.message as string);
}
