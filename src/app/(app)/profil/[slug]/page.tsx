import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { CareerEntry, Profile, ProfileRole, Project, ProjectCredit } from "@/types/database";
import { fetchVisitorCredits, visitorCreditAsMemberCredit } from "@/lib/film-team";
import { getDisplayName } from "@/lib/profile";
import ProfileClient from "./ProfileClient";

export const revalidate = 60; // Cache 1 minute

type ProfileWithRelations = Profile & {
  roles: ProfileRole[];
  // Badge « recruteur verifie » EFFECTIF, derive cote serveur : le toggle admin
  // `recruiter_verified` ET un plan Pro actif (modele eco du 10/08/2026 — un
  // recruteur qui resilie perd son badge). Derive ici pour que `plan` ne quitte
  // jamais le serveur : voir getProfile.
  show_verified_badge: boolean;
  projects: (Project & {
    credits: (ProjectCredit & {
      profile: Pick<Profile, "full_name" | "slug" | "avatar_url"> | null;
    })[];
  })[];
  // Parcours : entrées déclaratives, texte uniquement, année décroissante.
  career: CareerEntry[];
};

async function getProfile(slug: string): Promise<ProfileWithRelations | null> {
  const supabase = await createClient();

  // Colonnes PUBLIQUES uniquement. On n'expose JAMAIS contact_email, contact_phone,
  // instagram_url, website_url, show_*_to, is_admin, is_suspended, recruiter_*, plan, etc.
  // (la page profil ne les affiche pas — le contact passe par la messagerie Pro).
  // `plan` est LU (et seulement lu) : il entre dans le calcul du badge
  // « recruteur vérifié » et il est retiré de l'objet avant qu'il n'atteigne le
  // client — la règle « la page publique n'expose pas le plan » tient toujours.
  // Les projets imbriqués sont filtrés sur status=approved pour ne pas exposer
  // publiquement les projets pending/refused.
  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      id, full_name, slug, avatar_url, location, is_available, bio,
      first_name, last_name, stage_name, display_name_preference,
      is_recruiting, recruiting_roles, recruiter_verified, plan, status, created_at, updated_at,
      profile_roles ( * ),
      projects!projects_profile_id_fkey (
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
    .not("is_suspended", "is", true) // suspendu => retire de la vue publique (chantier 3)
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

  // Parcours (lecture publique pour un profil approuvé) et, pour un visiteur non
  // connecté, équipe des films : il ne lit aucune ligne de project_credits (RLS),
  // elle passe par public_project_credits en un seul appel.
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: career }, visitorCredits] = await Promise.all([
    supabase
      .from("career_entries")
      .select("id, profile_id, title, role, year, kind, production, created_at")
      .eq("profile_id", profile.id)
      .order("year", { ascending: false })
      .order("created_at", { ascending: false }),
    user ? null : fetchVisitorCredits(supabase, rawProjects.map((p) => p.id)),
  ]);
  if (visitorCredits) {
    // Rôle du titulaire sur ses propres films : son nom est déjà public sur cette
    // page, ses crédits y sont donc rendus en clair (les autres restent en initiales).
    const { data: ownRoles } = await supabase.rpc("public_profile_film_roles", { p_profile_id: profile.id });
    const ownCreditIds = new Set(((ownRoles ?? []) as { credit_id: string }[]).map((r) => r.credit_id));
    // Nom affiché (nom de scène si c'est son choix), jamais le nom réel à sa place.
    const self = { full_name: getDisplayName(profile), slug: profile.slug, avatar_url: profile.avatar_url };
    for (const project of rawProjects) {
      project.project_credits = visitorCredits
        .filter((c) => c.project_id === project.id)
        .map((c) => {
          const credit = visitorCreditAsMemberCredit(c);
          return ownCreditIds.has(c.id)
            ? { ...credit, profile_id: profile.id, ghost_name: null, profiles: self }
            : credit;
        }) as typeof project.project_credits;
    }
  }

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

  // Badge « recruteur vérifié » : double condition depuis le 10/08/2026 — le
  // toggle admin ET un plan Pro actif. `plan` est extrait de l'objet par cette
  // destructuration : ce qui part au client (`publicColumns`) ne le contient
  // plus, seul le booléen dérivé le traverse.
  const { plan, ...publicColumns } = profile as typeof profile & { plan: string | null };

  return {
    ...publicColumns,
    profile_roles: undefined,
    roles,
    show_verified_badge: profile.recruiter_verified === true && plan === "pro",
    projects: projectsWithCredits,
    career: (career ?? []) as CareerEntry[],
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
