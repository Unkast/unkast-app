import type { UserStatus } from "@/hooks/useUserStatus";

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

export function getDisplayName(profile: ProfileLike): string {
  if (profile.display_name_preference === "stage_name" && profile.stage_name) {
    return profile.stage_name;
  }
  const parts = [profile.first_name, profile.last_name].filter(Boolean);
  return parts.join(" ") || profile.full_name || "Utilisateur";
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

export function getVisibleContactInfo(
  profile: ProfileLike,
  viewerStatus: UserStatus | null
) {
  const isPro = viewerStatus === "pro";
  const isFree = viewerStatus === "free";
  const isLogged = isPro || isFree;

  function check(setting: string | null | undefined): boolean {
    if (setting === "everyone") return true;
    if (setting === "pro_users" && isPro) return true;
    return false;
  }

  const phone = check(profile.show_phone_to) ? formatPhone(profile.contact_phone) : null;
  const instagram = formatInstagram(profile.instagram_url);
  const website = normalizeUrl(profile.website_url);

  return {
    email: check(profile.show_contact_email_to) ? profile.contact_email : null,
    phone,
    realName: check(profile.show_real_name_to)
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null
      : null,
    instagram,
    website,
    // For "locked" indicators
    emailLocked: isLogged && !check(profile.show_contact_email_to) && profile.show_contact_email_to === "pro_users",
    phoneLocked: isLogged && !check(profile.show_phone_to) && profile.show_phone_to === "pro_users",
  };
}
