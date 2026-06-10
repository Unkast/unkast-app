import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { Profile, ProfileRole, Project, ProjectCredit } from "@/types/database";
import ProfileClient from "./ProfileClient";

export const revalidate = 60; // Cache 1 minute

type ProfileWithRelations = Profile & {
  roles: ProfileRole[];
  projects: (Project & {
    credits: (ProjectCredit & {
      profile: Pick<Profile, "full_name" | "slug" | "avatar_url"> | null;
    })[];
  })[];
};

async function getProfile(slug: string): Promise<ProfileWithRelations | null> {
  const supabase = await createClient();

  // Colonnes PUBLIQUES uniquement. On n'expose JAMAIS contact_email, contact_phone,
  // instagram_url, website_url, show_*_to, is_admin, is_suspended, recruiter_*, plan, etc.
  // (la page profil ne les affiche pas — le contact passe par /api/contact).
  // Les projets imbriqués sont filtrés sur status=approved pour ne pas exposer
  // publiquement les projets pending/refused.
  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      id, full_name, slug, avatar_url, location, is_available, bio,
      first_name, last_name, stage_name, display_name_preference,
      is_recruiting, recruiting_roles, status, created_at, updated_at,
      profile_roles ( * ),
      projects (
        id, profile_id, title, slug, description, category, year,
        video_url, poster_url, preview_url, status, created_at,
        project_credits (
          *,
          profiles ( full_name, slug, avatar_url )
        )
      )
    `)
    .eq("slug", slug)
    .eq("status", "approved")
    .eq("projects.status", "approved")
    .single();

  if (!profile) return null;

  const roles = (profile.profile_roles ?? []) as ProfileRole[];
  const rawProjects = (profile.projects ?? []) as (Project & {
    project_credits: (ProjectCredit & {
      profiles: Pick<Profile, "full_name" | "slug" | "avatar_url"> | null;
    })[];
  })[];

  // Sort projects by year descending
  rawProjects.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  const projectsWithCredits = rawProjects.map((project) => {
    const credits = (project.project_credits ?? []).map((credit) => ({
      ...credit,
      project_credits: undefined,
      profile: credit.profiles ?? null,
      profiles: undefined,
    }));
    return {
      ...project,
      project_credits: undefined,
      credits,
    } as unknown as ProfileWithRelations["projects"][0];
  });

  return {
    ...profile,
    profile_roles: undefined,
    roles,
    projects: projectsWithCredits,
  } as unknown as ProfileWithRelations;
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfile(slug);

  if (!profile) {
    return { title: "Profil introuvable — Unkast" };
  }

  const roleNames = profile.roles.map((r) => r.role_name).join(", ");
  const description = profile.bio
    ? profile.bio.slice(0, 160)
    : `${profile.full_name} — ${roleNames} sur Unkast`;

  return {
    title: `${profile.full_name} — ${roleNames} | Unkast`,
    description,
    openGraph: {
      title: `${profile.full_name} — ${roleNames}`,
      description,
      type: "profile",
      locale: "fr_FR",
      ...(profile.avatar_url && { images: [profile.avatar_url] }),
    },
  };
}

export default async function ProfilPage({ params }: Props) {
  const { slug } = await params;
  const profile = await getProfile(slug);

  if (!profile) notFound();

  const categories = Array.from(
    new Set(profile.projects.map((p) => p.category))
  );

  return (
    <ProfileClient
      profile={profile}
      categories={categories}
      categoryLabels={CATEGORY_LABELS}
      categoryColors={CATEGORY_COLORS}
    />
  );
}
