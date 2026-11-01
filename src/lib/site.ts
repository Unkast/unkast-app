// Adresse publique du site, sans barre finale. Sert aux adresses absolues (sitemap,
// robots, images de partage).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://app.unkast.com").replace(/\/+$/, "");

// Page de vente (src/app/site), servie sur ce domaine par next.config.ts.
export const MARKETING_URL = "https://unkast.com";
