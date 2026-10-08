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
};

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
  "Interprétation": ["Comédien", "Comédienne", "Comédien de complément", "Cascadeur", "Coordinateur de cascades", "Doublure", "Doublure lumière", "Voix off", "Comédien de doublage"],
  "Écriture": ["Scénariste", "Dialoguiste", "Story-boardeur", "Auteur"],
  "Distribution & Communication": ["Distributeur", "Agent artistique", "Attaché de presse", "Chargé de communication", "Community manager", "Graphiste", "Affichiste", "Bande-annonciste"],
  "Technique spécialisé": ["Chef opérateur son", "Technicien HF", "Vidéo assist", "Technicien plateau", "Coordinateur post-production", "Superviseur post-production", "Producteur de post-production"],
  "Autres": ["Directeur artistique", "Concepteur sonore", "Illustrateur", "Animateur", "Chef monteur publicité", "Coordinateur de tournage", "Logisticien", "Chauffeur de production"],
};

export const ALL_ROLES = Object.values(ROLES_BY_CATEGORY).flat();

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
