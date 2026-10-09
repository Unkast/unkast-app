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

// Informations de la societe, fournies par Maxime le 09/10/2026. Une valeur
// remise entre crochets s'affiche surlignee sur les pages legales (a completer).
export const LEGAL = {
  company: "JMB Vision FZCO",
  legalForm: "Free Zone Company (FZCO), société de droit émirien",
  capital: "Sans objet",
  address: "IFZA Properties, Dubai Silicon Oasis, Dubaï, Émirats arabes unis",
  registration: "Licence n° 50784, délivrée par l'IFZA (International Free Zone Authority), Dubaï",
  publisher: "Maxime Benak, General Director",
  contactEmail: "contact@unkast.com",
  // Region d'hebergement de la base Supabase : decide du paragraphe sur les
  // transferts hors Union europeenne.
  hostingRegion: "Union européenne (Paris, France)",
  // Droit applicable et tribunaux competents (CGU).
  governingLaw:
    "Ces conditions sont soumises au droit des Émirats arabes unis, avec compétence des tribunaux de Dubaï. Si tu es consommateur, tu gardes la protection des règles impératives de ton pays de résidence et tu peux saisir le tribunal de ton lieu de résidence.",
  // Representant dans l'Union europeenne (RGPD, article 27), s'il en faut un.
  euRepresentative: "En cours de désignation. En attendant, écris à contact@unkast.com.",
} as const;

/** Vrai si une information legale n'a pas encore ete remplie. */
export const isBlank = (value: string) => value.startsWith("[");

export const LEGAL_LINKS = [
  { href: "/cgu", label: "CGU" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/mentions-legales", label: "Mentions légales" },
] as const;
