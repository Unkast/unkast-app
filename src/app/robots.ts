import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Seuls les espaces techniques sont fermes a l'exploration. Les pages privees
// (/messages, /moi, /suspended...) restent explorables expres : elles portent une
// balise noindex, qu'un robot ne peut lire que s'il a le droit de charger la page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/auth/callback", "/dev/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
