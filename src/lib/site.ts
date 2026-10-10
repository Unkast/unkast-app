// Adresse publique du site, sans barre finale. Sert aux adresses absolues (sitemap,
// robots, images de partage).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://app.unkast.com").replace(/\/+$/, "");
