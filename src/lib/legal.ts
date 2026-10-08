// -----------------------------------------------------------------------------
// Pages legales de la beta : /cgu, /confidentialite, /mentions-legales
// -----------------------------------------------------------------------------

// Version des CGU et de la politique de confidentialite. Enregistree avec la
// date a chaque acceptation (profiles.terms_version / terms_accepted_at).
// LA CHANGER REDEMANDE L'ACCEPTATION A TOUS LES MEMBRES a leur prochaine
// connexion (ecran « Les CGU ont ete mises a jour ») : ne le faire que pour un
// changement de fond, pas pour une faute de frappe.
export const TERMS_VERSION = "2026-10-08";
export const TERMS_DATE_LABEL = "8 octobre 2026";

export const AGE_MINIMUM = 18;

// Informations de la societe. A REMPLIR avant le lancement : toute valeur entre
// crochets s'affiche surlignee sur les pages legales, pour ne pas etre oubliee.
export const LEGAL = {
  company: "[NOM SOCIÉTÉ]",
  legalForm: "[FORME JURIDIQUE]",
  capital: "[CAPITAL SOCIAL]",
  address: "[ADRESSE]",
  registration: "[NUMÉRO D'IMMATRICULATION]",
  publisher: "[DIRECTEUR DE LA PUBLICATION]",
  contactEmail: "[EMAIL CONTACT]",
  // Region d'hebergement de la base Supabase : decide du paragraphe sur les
  // transferts hors Union europeenne.
  hostingRegion: "[RÉGION D'HÉBERGEMENT]",
  // Droit applicable et tribunaux competents (CGU).
  governingLaw: "[DROIT APPLICABLE ET TRIBUNAUX COMPÉTENTS]",
  // Representant dans l'Union europeenne (RGPD, article 27), s'il en faut un.
  euRepresentative: "[REPRÉSENTANT DANS L'UNION EUROPÉENNE, SI NÉCESSAIRE]",
} as const;

/** Vrai si une information legale n'a pas encore ete remplie. */
export const isBlank = (value: string) => value.startsWith("[");

export const LEGAL_LINKS = [
  { href: "/cgu", label: "CGU" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/mentions-legales", label: "Mentions légales" },
] as const;
