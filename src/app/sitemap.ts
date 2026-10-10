import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/site";
import { CATEGORY_LABELS } from "@/lib/constants";

// Recalcule au plus une fois par heure.
export const revalidate = 3600;

// Films publics et profils approuves seulement. Lecture avec la cle publique et SANS
// session : la RLS repond comme a un visiteur, donc rien de reserve aux membres ne
// peut entrer dans le sitemap, meme si un filtre ci-dessous etait oublie.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const [{ data: profiles }, { data: projects }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, slug, updated_at")
      .eq("status", "approved")
      .not("is_suspended", "is", true)
      .neq("account_type", "admin")
      .limit(20000),
    supabase
      .from("projects")
      .select("slug, created_at, profile_id")
      .eq("status", "approved")
      .eq("visibility", "public")
      .limit(20000),
  ]);

  // Un film n'est public que si son Responsable est lui-meme approuve et non suspendu
  // (meme regle que is_project_public).
  const visibleOwners = new Set((profiles ?? []).map((p) => p.id));

  return [
    { url: `${SITE_URL}/feed`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/recherche`, changeFrequency: "daily", priority: 0.6 },
    ...Object.keys(CATEGORY_LABELS).map((slug) => ({
      url: `${SITE_URL}/categories/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...(projects ?? [])
      .filter((p) => p.slug && p.profile_id && visibleOwners.has(p.profile_id))
      .map((p) => ({
        url: `${SITE_URL}/projet/${p.slug}`,
        ...(p.created_at && { lastModified: p.created_at }),
        priority: 0.8,
      })),
    ...(profiles ?? [])
      .filter((p) => p.slug)
      .map((p) => ({
        url: `${SITE_URL}/profil/${p.slug}`,
        ...(p.updated_at && { lastModified: p.updated_at }),
        priority: 0.6,
      })),
  ];
}
