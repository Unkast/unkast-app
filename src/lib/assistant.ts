// Assistant de recherche (lot 8) : donnees en dur et reconnaissance de la saisie.
// AUCUNE IA, aucun appel reseau ici : des listes fermees et une fonction pure qui
// transforme un texte en filtres de /api/search. Rien de ce qui est tape n'est
// enregistre (ni ici, ni par la route).
import {
  ALL_ROLES,
  CATEGORY_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  MAX_PROJECTS_FREE,
  ROLES_BY_CATEGORY,
  type Language,
} from "@/lib/constants";
import type { ProjectCategory } from "@/types/database";

/** Minuscules, sans accents ni ponctuation, espaces simples. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

// ---- Metiers ----------------------------------------------------------------

// Comedien et comedienne : cherches ensemble, le type de roles les departage.
export const ACTOR_ROLES = ["Comédien", "Comédienne"];

// Feminin d'un metier de la liste officielle. Sert a deux choses : reconnaitre la
// saisie (« cadreuse ») et retrouver les profils qui portent encore un metier au
// feminin, saisi avant la liste fermee (« Monteuse », « Productrice »).
export const ROLE_FEMININE: Record<string, string[]> = {
  "Réalisateur": ["Réalisatrice"],
  "Premier assistant réalisateur": ["Première assistante réalisatrice"],
  "Deuxième assistant réalisateur": ["Deuxième assistante réalisatrice"],
  "Directeur de la photographie": ["Directrice de la photographie"],
  "Cadreur": ["Cadreuse"],
  "Premier assistant caméra": ["Première assistante caméra"],
  "Deuxième assistant caméra": ["Deuxième assistante caméra"],
  "Steadicameur": ["Steadicameuse"],
  "Chef électricien": ["Cheffe électricienne"],
  "Électricien": ["Électricienne"],
  "Étalonneur": ["Étalonneuse"],
  "Ingénieur du son": ["Ingénieure du son"],
  "Monteur son": ["Monteuse son"],
  "Mixeur": ["Mixeuse"],
  "Compositeur": ["Compositrice"],
  "Superviseur musical": ["Superviseuse musicale"],
  "Bruiteur": ["Bruiteuse"],
  "Monteur": ["Monteuse"],
  "Assistant monteur": ["Assistante monteuse"],
  "Monteur VFX": ["Monteuse VFX"],
  "Superviseur VFX": ["Superviseuse VFX"],
  "Producteur": ["Productrice"],
  "Producteur délégué": ["Productrice déléguée"],
  "Producteur exécutif": ["Productrice exécutive"],
  "Directeur de production": ["Directrice de production"],
  "Régisseur général": ["Régisseuse générale"],
  "Régisseur adjoint": ["Régisseuse adjointe"],
  "Régisseur de plateau": ["Régisseuse de plateau"],
  "Chargé de production": ["Chargée de production"],
  "Assistant de production": ["Assistante de production"],
  "Directeur de casting": ["Directrice de casting"],
  "Assistant casting": ["Assistante casting"],
  "Chef décorateur": ["Cheffe décoratrice"],
  "Assistant décorateur": ["Assistante décoratrice"],
  "Ensemblier": ["Ensemblière"],
  "Chef costumier": ["Cheffe costumière"],
  "Costumier": ["Costumière"],
  "Habilleuse": ["Habilleur"],
  "Chef maquilleur": ["Cheffe maquilleuse"],
  "Maquilleur": ["Maquilleuse"],
  "Assistant maquilleur": ["Assistante maquilleuse"],
  "Chef coiffeur": ["Cheffe coiffeuse"],
  "Coiffeur": ["Coiffeuse"],
  "Cascadeur": ["Cascadeuse"],
  "Coordinateur de cascades": ["Coordinatrice de cascades"],
  "Comédien de complément": ["Comédienne de complément"],
  "Comédien de doublage": ["Comédienne de doublage"],
  "Story-boardeur": ["Story-boardeuse"],
  "Auteur": ["Autrice", "Auteure"],
  "Distributeur": ["Distributrice"],
  "Attaché de presse": ["Attachée de presse"],
  "Chargé de communication": ["Chargée de communication"],
  "Directeur artistique": ["Directrice artistique"],
  "Concepteur sonore": ["Conceptrice sonore"],
  "Illustrateur": ["Illustratrice"],
  "Animateur": ["Animatrice"],
  "Coordinateur de tournage": ["Coordinatrice de tournage"],
  "Logisticien": ["Logisticienne"],
};

/** Metiers a chercher pour une liste de metiers officiels : eux-memes et leur feminin. */
export function withFeminine(roles: string[]): string[] {
  return [...new Set(roles.flatMap((r) => [r, ...(ROLE_FEMININE[r] ?? [])]))];
}

// Autres facons de dire un metier (abreviations, jargon de plateau, anglais).
const ROLE_SYNONYMS: Record<string, string[]> = {
  "Réalisateur": ["real", "director", "metteur en scene", "metteuse en scene"],
  "Premier assistant réalisateur": ["1er assistant realisateur", "1er assistant real", "premier assistant real", "assistant realisateur", "assistant real", "1er ad"],
  "Deuxième assistant réalisateur": ["2e assistant realisateur", "2eme assistant realisateur", "second assistant realisateur"],
  "Scripte": ["script", "script girl"],
  "Directeur de la photographie": ["dop", "dp", "chef operateur", "chef operatrice", "cheffe operatrice", "chef op", "directeur photo", "directrice photo", "dir photo"],
  "Cadreur": ["cameraman", "camerawoman", "operateur camera", "operatrice camera", "opv", "cadre"],
  "Premier assistant caméra": ["1er assistant camera", "pointeur", "pointeuse", "assistant camera", "assistante camera", "1er ac"],
  "Deuxième assistant caméra": ["2e assistant camera", "2eme assistant camera", "second assistant camera"],
  "Steadicameur": ["steadicam", "steadycam", "steadycameur"],
  "Drone operator": ["drone", "droniste", "pilote de drone", "telepilote"],
  "Photographe de plateau": ["photographe", "photo de plateau"],
  "Chef électricien": ["chef electro", "gaffer"],
  "Électricien": ["electro"],
  "Chef machiniste": ["chef machino", "key grip"],
  "Machiniste": ["machino", "grip"],
  "Étalonneur": ["etalonnage", "color grading"],
  "Coloriste": ["colorist"],
  "Ingénieur du son": ["inge son", "ingenieur son", "preneur de son", "preneuse de son", "chef operateur du son", "prise de son"],
  "Perchiste": ["perchman", "perche"],
  "Monteur son": ["montage son"],
  "Mixeur": ["mixage", "mix"],
  "Compositeur": ["musique", "musicien", "musicienne", "compo"],
  "Bruiteur": ["bruitage", "foley"],
  "Monteur": ["montage", "editor", "chef monteur", "cheffe monteuse", "chef monteuse"],
  "Assistant monteur": ["assistant montage"],
  "Superviseur VFX": ["vfx", "effets visuels", "sfx"],
  "Motion designer": ["motion", "motion design", "motion graphics"],
  "Producteur": ["prod", "production"],
  "Directeur de production": ["dir prod", "directeur de prod", "directrice de prod"],
  "Régisseur général": ["regisseur", "regisseuse", "regie"],
  "Directeur de casting": ["casting", "dir casting"],
  "Chef décorateur": ["deco", "decorateur", "decoratrice", "decors", "chef deco"],
  "Accessoiriste": ["accessoires"],
  "Chef costumier": ["costumes", "chef costumes", "styliste"],
  "Chef maquilleur": ["maquillage", "hmc", "mua", "make up"],
  "Chef coiffeur": ["coiffure"],
  "Comédien de complément": ["figurant", "figurante", "figuration", "silhouette"],
  "Cascadeur": ["cascade", "cascades"],
  "Voix off": ["voix", "voice over"],
  "Comédien de doublage": ["doublage", "doubleur", "doubleuse"],
  "Scénariste": ["scenario", "auteur de scenario", "screenwriter"],
  "Story-boardeur": ["storyboard", "story board", "storyboarder", "storyboardeur", "storyboardeuse"],
  "Agent artistique": ["agent", "agente"],
  "Graphiste": ["graphisme"],
  "Concepteur sonore": ["sound designer", "sound design"],
  "Directeur artistique": ["da", "direction artistique"],
  "Animateur": ["animation"],
  "Chef opérateur son": ["chef op son", "chef operatrice son"],
};

// Comedien, comedienne et leurs synonymes : le mot employe donne le type de roles.
const ACTOR_WORDS: Record<string, "femme" | "homme" | null> = {
  comedien: null, comediens: null, acteur: null, acteurs: null, comedienne: "femme", comediennes: "femme",
  actrice: "femme", actrices: "femme",
};

type RoleMatch = { roles: string[]; label: string };

// Saisie normalisee -> metier(s) officiel(s). Construite une fois au chargement.
const ROLE_INDEX: Map<string, RoleMatch> = (() => {
  const index = new Map<string, RoleMatch>();
  const add = (phrase: string, role: string, label: string) => {
    const key = normalize(phrase);
    if (!key) return;
    const existing = index.get(key);
    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role);
    } else index.set(key, { roles: [role], label });
  };
  for (const role of ALL_ROLES) {
    if (ACTOR_ROLES.includes(role)) continue; // geres par ACTOR_WORDS
    add(role, role, role);
    for (const feminine of ROLE_FEMININE[role] ?? []) add(feminine, role, feminine);
    for (const synonym of ROLE_SYNONYMS[role] ?? []) add(synonym, role, role);
  }
  // Pluriels simples (« monteurs », « cadreuses »).
  for (const [key, match] of [...index]) {
    if (!key.includes(" ") && !key.endsWith("s") && !index.has(`${key}s`)) index.set(`${key}s`, match);
  }
  return index;
})();

// ---- Villes -----------------------------------------------------------------

// Villes reconnues dans la saisie libre. `location` est un texte libre dans les
// profils : la recherche se fait par sous-chaine, sans accent force.
export const CITIES = [
  "Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux", "Lille", "Nantes", "Strasbourg", "Montpellier", "Rennes",
  "Nice", "Grenoble", "Rouen", "Toulon", "Saint-Étienne", "Dijon", "Angers", "Nîmes", "Clermont-Ferrand", "Le Mans",
  "Aix-en-Provence", "Brest", "Tours", "Amiens", "Limoges", "Annecy", "Perpignan", "Metz", "Besançon", "Orléans",
  "Mulhouse", "Caen", "Nancy", "Reims", "Le Havre", "Avignon", "Poitiers", "La Rochelle", "Pau", "Bayonne",
  "Biarritz", "Cannes", "Villeurbanne", "Montreuil", "Saint-Denis", "Boulogne-Billancourt", "Versailles", "Ajaccio",
  "Bastia", "Angoulême", "Valence", "Chambéry", "Lorient", "Quimper", "Saint-Malo", "La Réunion",
  "Bruxelles", "Liège", "Namur", "Charleroi", "Genève", "Lausanne", "Luxembourg", "Montréal", "Québec",
];
/** Villes proposees en boutons dans les parcours guides. */
export const TOP_CITIES = ["Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux", "Lille", "Nantes", "Bruxelles"];

const CITY_INDEX = new Map(CITIES.map((city) => [normalize(city), city]));

// ---- Langues, categories ----------------------------------------------------

const LANGUAGE_INDEX: Map<string, Language> = (() => {
  const index = new Map<string, Language>();
  for (const code of LANGUAGES) index.set(normalize(LANGUAGE_LABELS[code]), code);
  const extra: Record<string, Language> = {
    francophone: "fr", anglophone: "en", english: "en", hispanophone: "es", chinois: "zh", germanophone: "de",
    lsf: "lsf", "langue des signes": "lsf", lsfb: "lsfb", neerlandophone: "nl", flamand: "nl", arabophone: "ar",
  };
  for (const [key, code] of Object.entries(extra)) index.set(key, code);
  return index;
})();

const CATEGORY_INDEX: Map<string, ProjectCategory> = (() => {
  const index = new Map<string, ProjectCategory>();
  for (const [key, label] of Object.entries(CATEGORY_LABELS) as [ProjectCategory, string][]) {
    index.set(normalize(label), key);
    index.set(`${normalize(label)}s`, key);
  }
  const extra: Record<string, ProjectCategory> = {
    court: "court-metrage", courts: "court-metrage", "courts metrages": "court-metrage", "court metrage": "court-metrage",
    "moyens metrages": "moyen-metrage", long: "long-metrage", "longs metrages": "long-metrage",
    pub: "publicite", pubs: "publicite", publicites: "publicite", spot: "publicite",
    clips: "clip", "clip musical": "clip", "music video": "clip",
    docu: "documentaire", doc: "documentaire", docs: "documentaire", documentaires: "documentaire",
    showreel: "bande-demo", demo: "bande-demo", "bandes demo": "bande-demo", reel: "bande-demo",
    scene: "scene-extrait", extrait: "scene-extrait", scenes: "scene-extrait", extraits: "scene-extrait",
  };
  for (const [key, category] of Object.entries(extra)) index.set(key, category);
  return index;
})();

// ---- Reponses toutes faites -------------------------------------------------

export type FaqId = "publier" | "prix" | "contacter" | "validation" | "droits";

export type Faq = {
  id: FaqId;
  question: string;
  answer: string;
  /** Lien d'action sous la reponse (membre connecte / visiteur). */
  link?: { label: string; href: string; visitorHref?: string };
  keywords: string[];
};

export const FAQS: Faq[] = [
  {
    id: "publier",
    question: "Comment publier mon film ?",
    answer:
      "Va dans « Mon profil », onglet « Mes films », puis « Ajouter un film ». Colle le lien YouTube ou Vimeo de ta vidéo, indique ton rôle sur le film et confirme que tu as le droit de le publier. Il apparaît sur Unkast une fois validé par l'équipe.",
    link: { label: "Publier un film", href: "/moi", visitorHref: "/rejoindre" },
    keywords: ["publier", "publie", "publication", "mettre en ligne", "ajouter un film", "ajouter mon film", "poster", "uploader", "upload", "deposer"],
  },
  {
    id: "prix",
    question: "Combien ça coûte ? À quoi sert le Pro ?",
    answer: `Unkast est gratuit : tu crées ton profil et tu publies jusqu'à ${MAX_PROJECTS_FREE} films. L'offre Pro lève cette limite. Le détail de l'offre et son prix sont sur la page Pro.`,
    link: { label: "Voir l'offre Pro", href: "/pro" },
    keywords: ["prix", "tarif", "tarifs", "combien", "cout", "coute", "gratuit", "payant", "abonnement", "pro", "offre"],
  },
  {
    id: "contacter",
    question: "Comment contacter quelqu'un ?",
    answer:
      "Ouvre son profil puis « Envoyer un message ». Il faut un compte. Les coordonnées ne se donnent pas dans les premiers messages : elles s'échangent ensuite, dans la conversation.",
    keywords: ["contacter", "contact", "message", "ecrire", "joindre", "telephone", "email", "mail", "coordonnees"],
  },
  {
    id: "validation",
    question: "Pourquoi mon film n'apparaît pas encore ?",
    answer:
      "Chaque film est regardé par l'équipe avant d'être mis en ligne. Tant qu'il est « en attente », toi seul le vois, dans « Mes films ». S'il est refusé, le motif t'est indiqué au même endroit et par email.",
    link: { label: "Voir mes films", href: "/moi", visitorHref: "/connexion" },
    keywords: ["validation", "valide", "valider", "attente", "refuse", "refus", "moderation", "apparait pas", "pas visible", "invisible"],
  },
  {
    id: "droits",
    question: "Et les droits sur les films ?",
    answer:
      "Tu ne publies qu'un film dont tu as les droits ou l'accord de publication, et tu le confirmes à l'ajout. Si un film est en ligne sans ton accord, ouvre sa page puis « Signaler ce film » : un membre peut y indiquer qu'il en détient les droits, l'équipe traite la demande.",
    link: { label: "Lire les CGU", href: "/cgu" },
    keywords: ["droits", "droit", "copyright", "auteur", "propriete", "revendiquer", "signaler", "vol", "plagiat", "cgu"],
  },
];

const FAQ_INDEX: Map<string, FaqId> = (() => {
  const index = new Map<string, FaqId>();
  for (const faq of FAQS) for (const keyword of faq.keywords) index.set(normalize(keyword), faq.id);
  return index;
})();

// ---- Reconnaissance de la saisie --------------------------------------------

export type ParsedQuery = {
  /** Metiers officiels reconnus (vide si aucun). */
  roles: string[];
  /** Libelle du metier tel qu'il a ete compris (« Cadreuse », « Comédienne »). */
  roleLabel: string | null;
  roleType: "femme" | "homme" | null;
  city: string | null;
  language: Language | null;
  category: ProjectCategory | null;
  year: number | null;
  faq: FaqId | null;
  /** Ce qui n'a pas ete reconnu : cherche tel quel (nom, titre, mot de la bio). */
  rest: string;
};

// Mots de liaison ignores quand ils restent seuls.
const FILLER = new Set([
  "un", "une", "des", "de", "du", "d", "le", "la", "les", "l", "a", "au", "aux", "en", "et", "ou", "sur", "pour", "qui",
  "je", "cherche", "recherche", "trouver", "veux", "voudrais", "besoin", "avec", "parle", "parlant", "comment", "mon", "ma", "mes",
]);

const MAX_PHRASE_WORDS = 5;

export function parseQuery(text: string): ParsedQuery {
  const parsed: ParsedQuery = { roles: [], roleLabel: null, roleType: null, city: null, language: null, category: null, year: null, faq: null, rest: "" };
  // Chaque mot normalise garde le mot d'origine : ce qui n'est pas reconnu est cherche
  // tel qu'il a ete tape (accents compris, un nom s'ecrit « Chloé »).
  const tokens = text.trim().split(/\s+/).flatMap((raw) =>
    normalize(raw).split(" ").filter(Boolean).map((word) => ({ word, raw: raw.replace(/[,.()]/g, "") }))
  );
  const words = tokens.map((t) => t.word);
  const rest: string[] = [];
  const thisYear = new Date().getFullYear();

  let i = 0;
  while (i < words.length) {
    let matched = 0;
    // Plus longue expression d'abord (« directeur de la photographie » avant « directeur »).
    for (let size = Math.min(MAX_PHRASE_WORDS, words.length - i); size >= 1 && !matched; size--) {
      const phrase = words.slice(i, i + size).join(" ");

      if (size === 1 && phrase in ACTOR_WORDS) {
        if (parsed.roles.length === 0) {
          parsed.roles = [...ACTOR_ROLES];
          parsed.roleType = ACTOR_WORDS[phrase];
          parsed.roleLabel = parsed.roleType === "femme" ? "Comédienne" : "Comédien";
        }
        matched = size;
        break;
      }
      const role = ROLE_INDEX.get(phrase);
      // « film » seul est une categorie, « production » un metier : le metier ne
      // l'emporte sur une categorie que s'il n'y en a pas pour la meme expression.
      if (role && !CATEGORY_INDEX.has(phrase)) {
        if (parsed.roles.length === 0) {
          parsed.roles = [...role.roles];
          parsed.roleLabel = role.label;
        }
        matched = size;
        break;
      }
      const city = CITY_INDEX.get(phrase);
      if (city) { parsed.city ??= city; matched = size; break; }
      const language = LANGUAGE_INDEX.get(phrase);
      if (language) { parsed.language ??= language; matched = size; break; }
      const category = CATEGORY_INDEX.get(phrase);
      if (category) { parsed.category ??= category; matched = size; break; }
      const faq = FAQ_INDEX.get(phrase);
      if (faq) { parsed.faq ??= faq; matched = size; break; }
      if (size === 1 && /^(19|20)\d{2}$/.test(phrase)) {
        const year = Number(phrase);
        if (year >= 1950 && year <= thisYear + 1) { parsed.year ??= year; matched = 1; break; }
      }
    }
    if (matched) i += matched;
    else {
      const { word, raw } = tokens[i++];
      if (!FILLER.has(word) && rest[rest.length - 1] !== raw) rest.push(raw);
    }
  }

  // Une question (« comment publier… ») n'est pas une recherche : le reste est ignore.
  parsed.rest = parsed.faq ? "" : rest.join(" ");
  return parsed;
}

/** Vrai si la saisie contient au moins un critere reconnu ou un texte a chercher. */
export function hasSearch(parsed: ParsedQuery): boolean {
  return Boolean(parsed.roles.length || parsed.city || parsed.language || parsed.category || parsed.year || parsed.rest);
}

// ---- Requete /api/search ----------------------------------------------------

export type SearchBody = {
  type: "all" | "talents" | "projets";
  q?: string;
  roles?: string[];
  location?: string;
  role_type?: "femme" | "homme";
  playing_age?: string;
  language?: string;
  category?: string;
  year?: number;
  sort?: "date";
  since_days?: number;
};

/** Corps de la requete pour une saisie libre. */
export function searchBodyFromQuery(parsed: ParsedQuery): SearchBody {
  const wantsTalents = Boolean(parsed.roles.length || parsed.city || parsed.language);
  const wantsProjects = Boolean(parsed.category || parsed.year);
  const body: SearchBody = { type: wantsTalents === wantsProjects ? "all" : wantsTalents ? "talents" : "projets" };
  if (parsed.rest) body.q = parsed.rest;
  if (parsed.roles.length) body.roles = parsed.roles;
  if (parsed.roleType) body.role_type = parsed.roleType;
  if (parsed.city) body.location = parsed.city;
  if (parsed.language) body.language = parsed.language;
  if (parsed.category) body.category = parsed.category;
  if (parsed.year) body.year = parsed.year;
  return body;
}

// ---- Parcours guides --------------------------------------------------------

/** Familles de metiers proposees a « Je cherche un technicien » (tout sauf l'interpretation). */
export const TECH_FAMILIES = Object.keys(ROLES_BY_CATEGORY).filter((family) => family !== "Interprétation");

/** Reponse « Peu importe » a une question d'un parcours. */
export const ANY = "any";
