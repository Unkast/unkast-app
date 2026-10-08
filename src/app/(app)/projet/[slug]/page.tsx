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
import { TEAM_SELECT, fetchVisitorCredits, loadFilmTeams, visitorCreditAsMemberCredit } from "@/lib/film-team";
import { DISPLAY_NAME_COLUMNS, withDisplayName, type DisplayNameRow } from "@/lib/profile";
import LockedFilmCard, { toLockedFilm, type LockedFilm } from "@/components/LockedFilmCard";
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

// Le Responsable du film (profile_id, qui peut être null) n'est pas envoyé au
// client comme auteur : le réalisateur se lit dans les crédits de réalisation.
type ProjectFull = Project & {
  credits: CreditWithProfile[];
};

type RelatedProject = Project & {
  director_name: string;
  common_collaborators: number;
};

type RawCredit = ProjectCredit & {
  profiles: Pick<Profile, "id" | "full_name" | "slug" | "avatar_url" | "location"> | null;
};

async function getProject(slug: string): Promise<{
  project: ProjectFull;
  relatedProjects: RelatedProject[];
  isVisitor: boolean;
} | null> {
  const supabase = await createClient();

  // Client utilisateur : la RLS décide de ce qui est lisible (visiteur : approuvé
  // et public ; membre : approuvé, public ou membres seulement ; gestionnaires :
  // toujours le leur). Un film non lisible ne revient pas => page introuvable.
  const [{ data: { user } }, { data: project }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("projects")
      .select(`
        *,
        profiles!projects_profile_id_fkey ( is_suspended ),
        project_credits (
          *,
          profiles ( id, ${DISPLAY_NAME_COLUMNS}, slug, avatar_url, location )
        )
      `)
      .eq("slug", slug)
      .single(),
  ]);

  if (!project) return null;

  // SÉCURITÉ, ceinture et bretelles : la RLS ne renvoie déjà pas un film
  // « membres seulement » à un visiteur non connecté. Si elle le faisait un jour,
  // il resterait introuvable ici et seule la carte verrouillée s'afficherait.
  if (!user && project.visibility === "members") return null;

  // SÉCURITÉ : un film non approuvé (pending/refused) ne doit pas être accessible
  // publiquement par slug. Seuls ses gestionnaires (Responsable ou co-gestionnaire)
  // peuvent le prévisualiser (la bannière « Aperçu » repose sur cet accès).
  if (project.status !== "approved") {
    if (!user) return null;
    if (user.id !== project.profile_id) {
      const { data: isManager } = await supabase.rpc("is_project_manager", { p_project_id: project.id });
      if (isManager !== true) return null;
    }
  }

  // Responsable suspendu => film retiré de la vue publique (chantier 3).
  // Film sans Responsable (profile_id null) : pas de profil joint, rien à tester.
  const responsable = project.profiles as unknown as { is_suspended: boolean | null } | null;
  if (responsable?.is_suspended) return null;

  // Équipe. Membre connecté : project_credits, comme avant. Visiteur non connecté :
  // la RLS ne lui renvoie aucune ligne, l'équipe vient de public_project_credits
  // (initiales, sauf crédits de réalisation : nom complet et profil).
  const isVisitor = !user;
  const rawCredits: RawCredit[] = isVisitor
    ? (await fetchVisitorCredits(supabase, [project.id])).map(visitorCreditAsMemberCredit)
    : // Nom affiché de chaque personne créditée, colonnes de nom brutes retirées.
      ((project.project_credits ?? []) as (ProjectCredit & { profiles: (DisplayNameRow & { id: string }) | null })[]).map(
        (c) => ({ ...c, profiles: c.profiles ? withDisplayName(c.profiles) : null }) as RawCredit
      );

  const profileIds = rawCredits
    .map((c) => c.profiles?.id)
    .filter((id): id is string => !!id);

  // Batch fetch roles for all credited profiles
  const rolesMap = new Map<string, ProfileRole[]>();
  const projectCountMap = new Map<string, number>();

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

  // Nombre de collaborateurs communs par film lié.
  const relatedCounts = new Map<string, number>();
  if (isVisitor) {
    // Un visiteur ne lit pas project_credits : la fonction fait le rapprochement
    // et ne renvoie que des films publics, sans aucune identité.
    const { data: related } = await supabase.rpc("related_public_projects", { p_project_id: project.id });
    for (const r of (related ?? []) as { project_id: string; common_collaborators: number }[]) {
      relatedCounts.set(r.project_id, r.common_collaborators);
    }
  } else if (collaboratorIds.length > 0) {
    const { data: otherCredits } = await supabase
      .from("project_credits")
      .select("project_id, profile_id")
      .in("profile_id", collaboratorIds)
      .neq("project_id", project.id);

    const projectCollabMap = new Map<string, Set<string>>();
    for (const credit of otherCredits ?? []) {
      if (!projectCollabMap.has(credit.project_id)) {
        projectCollabMap.set(credit.project_id, new Set());
      }
      if (credit.profile_id) {
        projectCollabMap.get(credit.project_id)!.add(credit.profile_id);
      }
    }
    for (const [id, set] of projectCollabMap) relatedCounts.set(id, set.size);
  }

  const sortedProjectIds = [...relatedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id);

  if (sortedProjectIds.length > 0) {
    // Films liés et leurs crédits (réalisateur). Client utilisateur : la RLS
    // applique la visibilité.
    const { data: relProjects } = await supabase
      .from("projects")
      .select(`*, ${TEAM_SELECT}`)
      .in("id", sortedProjectIds)
      .eq("status", "approved");

    if (relProjects) {
      const rows = relProjects as unknown as (Record<string, unknown> & { id: string })[];
      const teamOf = await loadFilmTeams(supabase, isVisitor, rows);
      relatedProjects = rows.map((rp) => {
        return {
          ...rp,
          project_credits: undefined,
          director_name: teamOf(rp.id).director_name,
          common_collaborators: relatedCounts.get(rp.id) ?? 0,
        } as unknown as RelatedProject;
      });
      relatedProjects.sort((a, b) => b.common_collaborators - a.common_collaborators);
    }
  }

  return {
    project: {
      ...project,
      profiles: undefined,
      project_credits: undefined,
      credits: creditsWithProfiles,
    } as unknown as ProjectFull,
    relatedProjects,
    isVisitor,
  };
}

// Film introuvable pour ce lecteur : s'il n'est pas connecté et que le film est
// « membres seulement », la fonction SQL renvoie de quoi afficher une carte
// verrouillée (identifiant, adresse, titre, image, année). Rien d'autre du film
// n'est lu ici : ni lien vidéo, ni description, ni équipe.
async function getLockedFilm(slug: string): Promise<LockedFilm | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return null;

  const { data } = await supabase.rpc("member_only_film_teasers", { p_slug: slug });
  const row = ((data ?? []) as LockedFilm[])[0];
  return row ? toLockedFilm(row) : null;
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProject(slug);

  if (!result) {
    // Carte verrouillée : le titre seul, jamais indexée. Ni description ni image
    // tirées du film.
    const locked = await getLockedFilm(slug);
    if (locked) return { title: `${locked.title} | Unkast`, robots: { index: false, follow: false } };
    return { title: "Projet introuvable — Unkast" };
  }

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
    // Film « membres seulement » ou dépublié : jamais indexé.
    ...((project.visibility === "members" || project.visibility === "unpublished") && {
      robots: { index: false, follow: false },
    }),
  };
}

export default async function ProjetPage({ params }: Props) {
  const { slug } = await params;
  const result = await getProject(slug);

  if (!result) {
    const locked = await getLockedFilm(slug);
    if (!locked) notFound();
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <LockedFilmCard film={locked} />
      </main>
    );
  }

  return (
    <ProjetClient
      project={result.project}
      relatedProjects={result.relatedProjects}
      isVisitor={result.isVisitor}
      categoryLabels={CATEGORY_LABELS}
      categoryColors={CATEGORY_COLORS}
    />
  );
}
