import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { Profile, ProfileRole, Project, ProjectCredit } from "@/types/database";
import ProfileClient from "./ProfileClient";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "approved")
    .single();

  if (!profile) return null;

  const { data: roles } = await supabase
    .from("profile_roles")
    .select("*")
    .eq("profile_id", profile.id);

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("profile_id", profile.id)
    .order("year", { ascending: false });

  const projectsWithCredits = await Promise.all(
    (projects ?? []).map(async (project) => {
      const { data: credits } = await supabase
        .from("project_credits")
        .select("*")
        .eq("project_id", project.id);

      const creditsWithProfiles = await Promise.all(
        (credits ?? []).map(async (credit) => {
          let creditProfile = null;
          if (credit.profile_id) {
            const { data } = await supabase
              .from("profiles")
              .select("full_name, slug, avatar_url")
              .eq("id", credit.profile_id)
              .single();
            creditProfile = data;
          }
          return { ...credit, profile: creditProfile };
        })
      );

      return { ...project, credits: creditsWithProfiles };
    })
  );

  return {
    ...profile,
    roles: roles ?? [],
    projects: projectsWithCredits,
  };
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
