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

  // Fetch the project
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!project) return null;

  // Fetch the project owner (profile)
  const { data: owner } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", project.profile_id)
    .single();

  if (!owner) return null;

  const { data: ownerRoles } = await supabase
    .from("profile_roles")
    .select("*")
    .eq("profile_id", owner.id);

  // Fetch credits for this project
  const { data: credits } = await supabase
    .from("project_credits")
    .select("*")
    .eq("project_id", project.id);

  // Enrich each credit with profile info
  const creditsWithProfiles: CreditWithProfile[] = await Promise.all(
    (credits ?? []).map(async (credit) => {
      if (!credit.profile_id) {
        return { ...credit, profile: null };
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, slug, avatar_url, location")
        .eq("id", credit.profile_id)
        .single();

      if (!profile) return { ...credit, profile: null };

      const { data: roles } = await supabase
        .from("profile_roles")
        .select("*")
        .eq("profile_id", profile.id);

      const { count } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profile.id);

      return {
        ...credit,
        profile: {
          ...profile,
          roles: roles ?? [],
          project_count: count ?? 0,
        },
      };
    })
  );

  // Find related projects (projects that share collaborators)
  const collaboratorIds = creditsWithProfiles
    .map((c) => c.profile_id)
    .filter((id): id is string => id !== null);

  let relatedProjects: RelatedProject[] = [];

  if (collaboratorIds.length > 0) {
    // Get all project_credits for these collaborators
    const { data: otherCredits } = await supabase
      .from("project_credits")
      .select("project_id, profile_id")
      .in("profile_id", collaboratorIds)
      .neq("project_id", project.id);

    if (otherCredits && otherCredits.length > 0) {
      // Group by project and count common collaborators
      const projectCollabMap = new Map<string, Set<string>>();
      for (const credit of otherCredits) {
        if (!projectCollabMap.has(credit.project_id)) {
          projectCollabMap.set(credit.project_id, new Set());
        }
        if (credit.profile_id) {
          projectCollabMap.get(credit.project_id)!.add(credit.profile_id);
        }
      }

      // Fetch details for related projects (top 6)
      const sortedProjectIds = [...projectCollabMap.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 6)
        .map(([id]) => id);

      if (sortedProjectIds.length > 0) {
        const { data: relProjects } = await supabase
          .from("projects")
          .select("*")
          .in("id", sortedProjectIds);

        if (relProjects) {
          relatedProjects = await Promise.all(
            relProjects.map(async (rp) => {
              const { data: rpOwner } = await supabase
                .from("profiles")
                .select("full_name, slug")
                .eq("id", rp.profile_id)
                .single();

              return {
                ...rp,
                owner_name: rpOwner?.full_name ?? "",
                owner_slug: rpOwner?.slug ?? "",
                common_collaborators:
                  projectCollabMap.get(rp.id)?.size ?? 0,
              };
            })
          );

          relatedProjects.sort(
            (a, b) => b.common_collaborators - a.common_collaborators
          );
        }
      }
    }
  }

  return {
    project: {
      ...project,
      credits: creditsWithProfiles,
      owner: {
        id: owner.id,
        full_name: owner.full_name,
        slug: owner.slug,
        avatar_url: owner.avatar_url,
        location: owner.location,
        is_available: owner.is_available,
        roles: ownerRoles ?? [],
      },
    },
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
