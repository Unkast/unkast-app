import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DISPLAY_NAME_COLUMNS, displayNameOf, type DisplayNameRow } from "@/lib/profile";
import RechercheClient from "./RechercheClient";

export const revalidate = 3600; // Cache 1 hour (static counts)

export const metadata: Metadata = {
  title: "Explorer — Unkast",
  description:
    "Découvrez les talents et les projets du cinéma et de l'audiovisuel français.",
};

async function getCategoryCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("category")
    .eq("status", "approved");

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.category] = (counts[row.category] || 0) + 1;
  }
  return counts;
}

async function getRecruitingProfiles() {
  const supabase = await createClient();
  // Single query with join for roles
  const { data } = await supabase
    .from("profiles")
    .select(`
      id, ${DISPLAY_NAME_COLUMNS}, slug, avatar_url, location, is_recruiting, recruiting_roles, account_type,
      profile_roles ( role_name )
    `)
    .eq("status", "approved")
    .eq("is_recruiting", true)
    .order("updated_at", { ascending: false })
    // Coup de pouce Pro : departage secondaire a date egale (quasi no-op car
    // is_recruiting implique deja Pro ; robustesse pour d'eventuelles donnees legacy).
    .order("plan", { ascending: false, nullsFirst: false })
    .limit(10);

  return (data ?? []).map((p: Record<string, unknown>) => {
    const roles = p.profile_roles as { role_name: string }[] | null;
    return {
      id: p.id,
      full_name: displayNameOf(p as DisplayNameRow),
      slug: p.slug,
      avatar_url: p.avatar_url,
      location: p.location,
      is_recruiting: p.is_recruiting,
      recruiting_roles: p.recruiting_roles,
      account_type: p.account_type,
      main_role: roles?.[0]?.role_name || "",
    };
  });
}

type Props = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function RecherchePage({ searchParams }: Props) {
  const [counts, recruiting, { q }] = await Promise.all([getCategoryCounts(), getRecruitingProfiles(), searchParams]);
  // ?q= : recherche lancee depuis le champ de l'en-tete (AppShell).
  const initialQuery = typeof q === "string" ? q.slice(0, 100) : "";
  return <RechercheClient key={initialQuery} categoryCounts={counts} recruitingProfiles={recruiting} initialQuery={initialQuery} />;
}
