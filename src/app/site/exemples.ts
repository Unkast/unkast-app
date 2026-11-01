// Films d'EXEMPLE de la page de vente : fictifs, affiches generees par IA
// (public/site/exemples/, copies WebP des affiches de public/thumbnails).
// Affiches : Maxime verifie les droits d'usage commercial de l'outil de generation
// avant toute mise en ligne (voir ROADMAP).
//
// Utilises seulement tant que la base compte moins de EXAMPLES_BELOW vrais films
// publics (page.tsx) : des qu'il y en a assez, les vrais films les remplacent. Jamais
// melanges aux vrais films. Ni realisateur, ni equipe, ni annee : rien d'invente qui
// puisse passer pour une inscription. L'ordre compte : 1er = hero, 2e = credits
// croises, 3e = onglet Createurs (titres en bas de l'affiche : leurs puces ne les
// masquent pas). Ni lien ni slug : ces films n'existent pas dans l'app.
// Pas de film « Horizons » : l'affiche montre le logo d'une vraie marque.
import type { SiteFilm } from "./ui";

/** Nombre de vrais films a partir duquel les exemples disparaissent. */
export const EXAMPLES_BELOW = 6;

const exemple = (slug: string, title: string, category: string): SiteFilm => ({
  slug: `exemple-${slug}`,
  title,
  category,
  year: null,
  // Prolongees au ratio exact 16:10 des cadres de la page (aucun recadrage, titres entiers).
  poster: `/site/exemples/${slug}-16x10.webp`,
  director: null,
  team: [],
  teamCount: 0,
  example: true,
});

export const EXAMPLE_FILMS: SiteFilm[] = [
  exemple("les-ombres-du-matin", "Les Ombres du Matin", "Court-métrage"),
  exemple("dernier-acte", "Dernier Acte", "Court-métrage"),
  exemple("nuit-electrique", "Nuit Électrique", "Clip"),
  exemple("memoires-vives", "Mémoires Vives", "Documentaire"),
  exemple("le-silence-des-abeilles", "Le Silence des Abeilles", "Court-métrage"),
];
