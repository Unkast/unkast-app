import type { ProjectCategory } from "@/types/database";

export const CATEGORY_COLORS: Record<ProjectCategory, string> = {
  "court-metrage": "#C8FF00",
  publicite: "#00D4AA",
  clip: "#AA88FF",
  documentaire: "#FF8844",
  "bande-demo": "#FF5577",
  "scene-extrait": "#FF5577",
};

export const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  "court-metrage": "Court-métrage",
  publicite: "Publicité",
  clip: "Clip",
  documentaire: "Documentaire",
  "bande-demo": "Bande démo",
  "scene-extrait": "Scène / Extrait",
};

export const MAX_PROJECTS_FREE = 3;
