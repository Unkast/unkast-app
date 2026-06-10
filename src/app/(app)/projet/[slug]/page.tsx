import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type {
  Profile,
  ProfileRole,
  Project,
  ProjectCredit,
} from "@/types/database";
import ProjetClient from "./ProjetClient";

export const revalidate = 120; // Cache 2 minutes

type CreditWithProfile = ProjectCredit & {
  profile:
    | (Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "location"> & {
        roles: ProfileRole[];
        project_count: number;
      })
    | null;
};

type ProjectFull = Project & {
  credits: CreditWithProfile[];
  owner: Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "location" | "is_available"> & {
    roles: ProfileRole[];
  };
};

type RelatedProject = Project & {
  owner_name: string;
  owner_slug: string;
  common_collaborators: number;
};

async function getProject(slug: string): Promise<{
  project: ProjectFull;
  relatedProjects: RelatedProject[];
} | null> {
  const supabase = await createClient();

  // Single query: project + owner profile + owner roles + credits with profiles
  const { data: project } = await supabase
    .from("projects")
    .select(`
      *,
      profiles!projects_profile_id_fkey (
        id, full_name, slug, avatar_url, location, is_available,
        profile_roles ( * )
      ),
      project_credits (
        *,
        profiles ( id, full_name, slug, avatar_url, location )
      )
    `)
    .eq("slug", slug)
    .single();

  if (!project) return null;

  // SÉCURITÉ : un projet non approuvé (pending/refused) ne doit pas être accessible
  // publiquement par slug. Seul son propriétaire peut le prévisualiser (la bannière
  // "Aperçu — en attente de validation" repose sur cet accès).
  if (project.status !== "approved") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== project.profile_id) return null;
  }

  const ownerData = project.profiles as unknown as {
    id: string; full_name: string; slug: string; avatar_url: string | null;
    location: string | null; is_available: boolean;
    profile_roles: ProfileRole[];
  };

  if (!ownerData) return null;

  const owner = {
    id: ownerData.id,
    full_name: ownerData.full_name,
    slug: ownerData.slug,
    avatar_url: ownerData.avatar_url,
    location: ownerData.location,
    is_available: ownerData.is_available,
    roles: ownerData.profile_roles ?? [],
  };

  // Enrich credits — batch fetch roles and project counts for credited profiles
  const rawCredits = (project.project_credits ?? []) as (ProjectCredit & {
    profiles: Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "location"> | null;
  })[];

  const profileIds = rawCredits
    .map((c) => c.profiles?.id)
    .filter((id): id is string => !!id);

  // Batch fetch roles for all credited profiles
  let rolesMap = new Map<string, ProfileRole[]>();
  let projectCountMap = new Map<string, number>();

  if (profileIds.length > 0) {
    const [rolesResult, countsResult] = await Promise.all([
      supabase
        .from("profile_roles")
        .select("*")
        .in("profile_id", profileIds),
      supabase
        .from("projects")
        .select("profile_id")
        .in("profile_id", profileIds),
    ]);

    for (const role of rolesResult.data ?? []) {
      const existing = rolesMap.get(role.profile_id) ?? [];
      existing.push(role);
      rolesMap.set(role.profile_id, existing);
    }

    for (const p of countsResult.data ?? []) {
      projectCountMap.set(p.profile_id, (projectCountMap.get(p.profile_id) ?? 0) + 1);
    }
  }

  const creditsWithProfiles: CreditWithProfile[] = rawCredits.map((credit) => {
    const prof = credit.profiles;
    if (!prof) return { ...credit, profiles: undefined, profile: null } as unknown as CreditWithProfile;
    return {
      ...credit,
      profiles: undefined,
      profile: {
        ...prof,
        roles: rolesMap.get(prof.id) ?? [],
        project_count: projectCountMap.get(prof.id) ?? 0,
      },
    } as unknown as CreditWithProfile;
  });

  // Related projects — batch approach
  const collaboratorIds = creditsWithProfiles
    .map((c) => c.profile_id)
    .filter((id): id is string => id !== null);

  let relatedProjects: RelatedProject[] = [];

  if (collaboratorIds.length > 0) {
    const { data: otherCredits } = await supabase
      .from("project_credits")
      .select("project_id, profile_id")
      .in("profile_id", collaboratorIds)
      .neq("project_id", project.id);

    if (otherCredits && otherCredits.length > 0) {
      const projectCollabMap = new Map<string, Set<string>>();
      for (const credit of otherCredits) {
        if (!projectCollabMap.has(credit.project_id)) {
          projectCollabMap.set(credit.project_id, new Set());
        }
        if (credit.profile_id) {
          projectCollabMap.get(credit.project_id)!.add(credit.profile_id);
        }
      }

      const sortedProjectIds = [...projectCollabMap.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 6)
        .map(([id]) => id);

      if (sortedProjectIds.length > 0) {
        // Single query with join for related projects + their owners
        const { data: relProjects } = await supabase
          .from("projects")
          .select(`
            *,
            profiles!projects_profile_id_fkey ( full_name, slug )
          `)
          .in("id", sortedProjectIds)
          .eq("status", "approved");

        if (relProjects) {
          relatedProjects = relProjects.map((rp: Record<string, unknown>) => {
            const rpOwner = rp.profiles as { full_name: string; slug: string } | null;
            return {
              ...rp,
              profiles: undefined,
              owner_name: rpOwner?.full_name ?? "",
              owner_slug: rpOwner?.slug ?? "",
              common_collaborators: projectCollabMap.get(rp.id as string)?.size ?? 0,
            } as unknown as RelatedProject;
          });
          relatedProjects.sort((a, b) => b.common_collaborators - a.common_collaborators);
        }
      }
    }
  }

  return {
    project: {
      ...project,
      profiles: undefined,
      project_credits: undefined,
      credits: creditsWithProfiles,
      owner,
    } as unknown as ProjectFull,
    relatedProjects,
  };
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProject(slug);

  if (!result) return { title: "Projet introuvable — Unkast" };

  const { project } = result;
  const description = project.description
    ? project.description.slice(0, 160)
    : `${project.title} — un projet ${CATEGORY_LABELS[project.category]} sur Unkast`;

  return {
    title: `${project.title} — ${CATEGORY_LABELS[project.category]} | Unkast`,
    description,
    openGraph: {
      title: `${project.title} — ${CATEGORY_LABELS[project.category]}`,
      description,
      type: "video.other",
      locale: "fr_FR",
    },
  };
}

export default async function ProjetPage({ params }: Props) {
  const { slug } = await params;
  const result = await getProject(slug);

  if (!result) notFound();

  return (
    <ProjetClient
      project={result.project}
      relatedProjects={result.relatedProjects}
      categoryLabels={CATEGORY_LABELS}
      categoryColors={CATEGORY_COLORS}
    />
  );
}
