interface ProfileLike {
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  stage_name?: string | null;
  display_name_preference?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  instagram_url?: string | null;
  website_url?: string | null;
  show_contact_email_to?: string | null;
  show_phone_to?: string | null;
  show_real_name_to?: string | null;
}

// Nom d'affichage calcule a partir des colonnes de nom brutes. Ces colonnes ne
// sont lisibles que par la personne elle-meme (route /api/dashboard/profile) et
// par l'admin : cette fonction ne sert donc qu'a SON PROPRE profil. Pour le nom
// de quelqu'un d'autre, lire la colonne `display_name` (DISPLAY_NAME_COLUMNS),
// calculee par la base avec la meme regle (migration 20261014).
export function getDisplayName(profile: ProfileLike): string {
  if (profile.display_name_preference === "stage_name" && profile.stage_name) {
    return profile.stage_name;
  }
  const parts = [profile.first_name, profile.last_name].filter(Boolean);
  return parts.join(" ") || profile.full_name || "Utilisateur";
}

// Nom d'affichage d'une personne. `display_name` est la SEULE colonne de nom
// lisible avec la cle publique : full_name, first_name, last_name, stage_name et
// display_name_preference sont fermees a anon et authenticated. Toute lecture
// d'un nom montre a quelqu'un d'autre selectionne DISPLAY_NAME_COLUMNS ; une
// requete du client utilisateur qui nommerait une colonne fermee est refusee
// en entier par la base (permission denied).
export const DISPLAY_NAME_COLUMNS = "display_name";

export type DisplayNameRow = {
  display_name: string | null;
};

/** Nom d'affichage d'une ligne `profiles` ; null si la ligne est absente. */
export function displayNameOf(row: DisplayNameRow | null | undefined): string | null {
  return row ? row.display_name || "Utilisateur" : null;
}

/**
 * Range le nom d'affichage d'une ligne dans `full_name` (le champ que les
 * clients lisent deja) et retire `display_name`.
 */
export function withDisplayName<T extends DisplayNameRow>(
  row: T
): Omit<T, keyof DisplayNameRow> & { full_name: string } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { display_name, ...rest } = row;
  return { ...rest, full_name: displayNameOf(row) as string };
}

/**
 * Normalize a URL: ensure it starts with https://
 * Handles: "example.com", "www.example.com", "http://...", "https://..."
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u = url.trim();
  if (!u) return null;
  // Already has protocol
  if (/^https?:\/\//i.test(u)) return u;
  // Remove leading www. for clean display but keep for href
  return "https://" + u;
}

/**
 * Format phone number for display with country prefix
 * Handles: 0612345678, +33612345678, 06 12 34 56 78, etc.
 */
export function formatPhone(phone: string | null | undefined): { display: string; href: string } | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s.\-()]/g, "");
  if (!cleaned) return null;

  // Already has international prefix
  if (cleaned.startsWith("+")) {
    return { display: phone.trim(), href: `tel:${cleaned}` };
  }

  // French number starting with 0
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    const international = "+33" + cleaned.slice(1);
    // Format display: +33 6 12 34 56 78
    const digits = cleaned.slice(1);
    const display = "+33 " + digits.replace(/(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
    return { display, href: `tel:${international}` };
  }

  // Unknown format — return as-is
  return { display: phone.trim(), href: `tel:${cleaned}` };
}

/**
 * Format Instagram handle: ensure it works as a link
 * Handles: "@pseudo", "pseudo", "https://instagram.com/pseudo"
 */
export function formatInstagram(handle: string | null | undefined): { display: string; href: string } | null {
  if (!handle) return null;
  const h = handle.trim();
  if (!h) return null;

  // Already a full URL
  if (h.includes("instagram.com")) {
    return { display: h.replace(/https?:\/\/(www\.)?instagram\.com\/?/, "@"), href: normalizeUrl(h)! };
  }

  // Just a handle
  const clean = h.replace(/^@/, "");
  return { display: "@" + clean, href: `https://instagram.com/${clean}` };
}

// NOTE (chantier 3) : l'ancien helper getVisibleContactInfo a ete supprime.
// Les coordonnees ne sont PAS affichees sur les profils publics (philosophie
// anti-fuite : le contact passe uniquement par la messagerie Pro). Les
// reglages show_*_to restent en base mais ne sont plus exposes dans l'UI.
