import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { CareerEntry, Profile, ProfileRole, Project, ProjectCredit } from "@/types/database";
import { fetchVisitorCredits, visitorCreditAsMemberCredit } from "@/lib/film-team";
import { DISPLAY_NAME_COLUMNS, displayNameOf, withDisplayName, type DisplayNameRow } from "@/lib/profile";
import { toLockedFilm, type LockedFilm, type LockedFilmRow } from "@/components/LockedFilmCard";
import ProfileClient from "./ProfileClient";

export const revalidate = 60; // Cache 1 minute

// Colonnes d'un film et de son équipe : les mêmes pour les films publiés par la
// personne et pour ceux où elle est créditée.
const FILM_COLUMNS = `
  id, profile_id, title, slug, description, category, year,
  video_url, poster_url, preview_url, status, visibility, created_at,
  project_credits (
    *,
    profiles ( ${DISPLAY_NAME_COLUMNS}, slug, avatar_url )
  )
`;

// Identité : le client ne reçoit que `full_name`, qui contient le NOM AFFICHÉ
// (nom de scène si c'est le choix de la personne). Prénom, nom, nom de scène et
// préférence restent sur le serveur.
type ProfileWithRelations = Omit<Profile, "first_name" | "last_name" | "stage_name" | "display_name_preference"> & {
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
  // `projects` : films publiés par la personne (elle en est Responsable) ET films
  // où elle est créditée, sans doublon. Le client les distingue par `profile_id`.
  // Films « membres seulement » (publiés ou crédités), pour un visiteur non
  // connecté : cartes verrouillées (identifiant, adresse, titre, image, année,
  // rôle de la personne, rien d'autre). Toujours vide pour un membre connecté.
  locked_films: LockedFilm[];
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
      id, ${DISPLAY_NAME_COLUMNS}, slug, avatar_url, location, is_available, bio,
      is_recruiting, recruiting_roles, recruiter_verified, plan, status, created_at, updated_at,
      profile_roles ( * ),
      projects!projects_profile_id_fkey ( ${FILM_COLUMNS} )
    `)
    .eq("slug", slug)
    .eq("status", "approved")
    .not("is_suspended", "is", true) // suspendu => retire de la vue publique (chantier 3)
    .eq("projects.status", "approved")
    .single();

  if (!profile) return null;

  const roles = (profile.profile_roles ?? []) as ProfileRole[];
  type RawProject = Project & {
    project_credits: (ProjectCredit & {
      profiles: (DisplayNameRow & Pick<Profile, "slug" | "avatar_url">) | null;
    })[];
  };
  const rawProjects = (profile.projects ?? []) as RawProject[];

  // Parcours (lecture publique pour un profil approuvé).
  const { data: { user } } = await supabase.auth.getUser();
  // Second verrou, en plus de la RLS : un visiteur ne recoit que les films
  // publics. Un film « membres seulement » ne lui parvient que sous forme de
  // carte verrouillee (member_only_film_teasers), sans video ni equipe.
  if (!user) {
    for (let i = rawProjects.length - 1; i >= 0; i--) {
      if (rawProjects[i].visibility !== "public") rawProjects.splice(i, 1);
    }
  }
  const [{ data: career }, lockedRows, ownCredits] = await Promise.all([
    supabase
      .from("career_entries")
      .select("id, profile_id, title, role, year, kind, production, created_at")
      .eq("profile_id", profile.id)
      .order("year", { ascending: false })
      .order("created_at", { ascending: false }),
    // Films « membres seulement » (publiés ou crédités) : un visiteur ne les lit
    // pas dans `projects` (RLS), la fonction lui en donne de quoi afficher une
    // carte verrouillée.
    user
      ? null
      : supabase.rpc("member_only_film_teasers", { p_profile_id: profile.id }).then((r) => r.data as LockedFilmRow[] | null),
    // Crédits de la personne, tous films confondus. Une ligne de project_credits
    // est un crédit accepté (les demandes en attente vivent ailleurs). Membre : la
    // RLS les lui donne. Visiteur : il ne lit aucun crédit, la fonction lui donne
    // ceux des films publics.
    user
      ? supabase
          .from("project_credits")
          .select("credit_id:id, project_id")
          .eq("profile_id", profile.id)
          .then((r) => r.data as { credit_id: string; project_id: string }[] | null)
      : supabase
          .rpc("public_profile_film_roles", { p_profile_id: profile.id })
          .then((r) => r.data as { credit_id: string; project_id: string }[] | null),
  ]);
  const lockedFilms = (lockedRows ?? []).map(toLockedFilm);

  // Films où la personne est créditée sans en être Responsable. Mêmes règles de
  // visibilité que partout, posées ici en plus de la RLS (un gestionnaire du
  // film lirait sinon un film dépublié) : approuvé, public pour un visiteur,
  // public ou membres pour un membre.
  const publishedIds = new Set(rawProjects.map((p) => p.id));
  const creditedIds = [...new Set((ownCredits ?? []).map((c) => c.project_id))].filter((id) => !publishedIds.has(id));
  if (creditedIds.length > 0) {
    const { data: credited } = await supabase
      .from("projects")
      .select(FILM_COLUMNS)
      .in("id", creditedIds)
      .eq("status", "approved")
      .in("visibility", user ? ["public", "members"] : ["public"]);
    rawProjects.push(...((credited ?? []) as unknown as RawProject[]));
  }
  rawProjects.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  // Visiteur non connecté : équipe des films par public_project_credits, en un
  // seul appel.
  const visitorCredits = user ? null : await fetchVisitorCredits(supabase, rawProjects.map((p) => p.id));
  if (visitorCredits) {
    // Rôle du titulaire sur les films de sa fiche : son nom est déjà public sur
    // cette page, ses crédits y sont donc rendus en clair (les autres restent en
    // initiales).
    const ownCreditIds = new Set((ownCredits ?? []).map((r) => r.credit_id));
    // Nom affiché (nom de scène si c'est son choix), jamais le nom réel à sa place.
    const self = { full_name: displayNameOf(profile) as string, slug: profile.slug, avatar_url: profile.avatar_url };
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
      // Nom affiché de chaque personne créditée, colonnes de nom brutes retirées.
      profile: credit.profiles ? withDisplayName(credit.profiles) : null,
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
  // plus, seul le booléen dérivé le traverse. Même principe pour l'identité :
  // withDisplayName réduit les colonnes de nom au seul nom affiché.
  const { plan, ...publicColumns } = withDisplayName(profile as typeof profile & { plan: string | null });

  return {
    ...publicColumns,
    profile_roles: undefined,
    roles,
    show_verified_badge: profile.recruiter_verified === true && plan === "pro",
    projects: projectsWithCredits,
    career: (career ?? []) as CareerEntry[],
    locked_films: lockedFilms,
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

  return (
    <ProfileClient
      profile={profile}
      categoryLabels={CATEGORY_LABELS}
      categoryColors={CATEGORY_COLORS}
    />
  );
}
