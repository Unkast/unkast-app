import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { TEAM_SELECT, loadFilmTeams } from "@/lib/film-team";

// Echappe les wildcards ILIKE (`%`, `_`, antislash) pour un matching
// litteral : sans ca, un `%`/`_` saisi par l'utilisateur agit comme
// wildcard Postgres et gonfle le cout de calcul d'une recherche substring
// en scan quasi-total. Utilisee seule (sans strip) pour `location`, qui
// passe par `.ilike()` (valeur opaque, pas de risque de sortie de motif).
function escapeLikeWildcards(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, (c) => `\\${c}`);
}

// Pour `q`, concatene dans `.or()` (voir commentaire de tete de fichier) :
// retire en plus `,` `.` `(` `)`, les caracteres de syntaxe du filtre
// PostgREST qui permettent de sortir du motif `colonne.ilike.%valeur%`
// (separateur de conditions, separateur operateur/valeur, groupement
// and()/or()). Un `q` qui ne contient plus que ces caracteres retombe sur
// une recherche vide, geree par l'appelant.
function sanitizeSearchTerm(value: string): string {
  return escapeLikeWildcards(value.replace(/[,.()]/g, ""));
}

// Route PUBLIQUE, non authentifiee. `q` est concatene dans un `.or()`
// PostgREST (postgrest-js ne l'echappe pas — le package le documente comme
// "utilise tel quel, a sanitizer par l'appelant"), donc sanitizeSearchTerm()
// est le seul rempart cote code contre une sortie du motif ilike.
//
// COUPLAGE DE SECURITE (a ne pas casser sans le relire) : meme avec cette
// sanitization, l'innocuite d'une injection residuelle sur `q` depend
// entierement du GRANT colonne de
// supabase/migrations/20260731_profiles_column_grants.sql. Ce GRANT limite
// anon/authenticated a 31 colonnes non sensibles sur `profiles` ; toute
// reference a une colonne hors de cette liste (ex. is_admin, contact_email,
// stripe_customer_id) fait echouer la requete PostgREST entiere plutot que
// de fuiter la valeur. La RLS ne rattrape rien ici : elle filtre les LIGNES
// (une ligne approuvee est deja publique), pas les COLONNES. Si une colonne
// sensible est un jour reaccordee dans ce GRANT, cette route redevient
// exfiltrante sans qu'aucun filet ne l'empeche. Voir l'audit du 2026-08-10.
export async function GET(request: NextRequest) {
  // Anti-abus : route publique sans auth, cle = IP (fail-closed, meme
  // posture que signup/waitlist/resend-confirmation).
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`search:${ip}`, 60, 60))) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans un instant." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const type = searchParams.get("type") ?? "all"; // all | talents | projets
  const category = searchParams.get("category") ?? "";
  const location = searchParams.get("location") ?? "";
  const role = searchParams.get("role") ?? "";
  const sort = searchParams.get("sort") ?? "pertinence"; // pertinence | date | projets

  const MAX_PARAM_LENGTH = 100;
  for (const [name, value] of Object.entries({ q, type, category, location, role, sort })) {
    if (value.length > MAX_PARAM_LENGTH) {
      return NextResponse.json(
        { error: `Paramètre "${name}" trop long.` },
        { status: 400 }
      );
    }
  }

  const supabase = await createClient();

  let talents: Record<string, unknown>[] = [];
  let projects: Record<string, unknown>[] = [];

  // --- Talents (single query with joins) ---
  if (type === "all" || type === "talents") {
    let query = supabase
      .from("profiles")
      .select(`
        id, full_name, slug, avatar_url, location, is_available, bio, created_at, plan,
        profile_roles ( role_name ),
        projects!projects_profile_id_fkey ( id )
      `)
      .eq("status", "approved")
      .not("is_suspended", "is", true); // chantier 3 : suspendus hors vue publique

    if (q) {
      const term = sanitizeSearchTerm(q);
      if (term) {
        query = query.or(`full_name.ilike.%${term}%,bio.ilike.%${term}%`);
      }
    }
    if (location) {
      query = query.ilike("location", `%${escapeLikeWildcards(location)}%`);
    }

    if (sort === "date") {
      query = query.order("created_at", { ascending: false });
    } else {
      query = query.order("full_name", { ascending: true });
    }
    // Coup de pouce Pro : critere SECONDAIRE uniquement (departage a rang egal,
    // jamais "Pro d'abord"). nullsFirst:false => plan null (legacy) en dernier.
    query = query.order("plan", { ascending: false, nullsFirst: false });

    query = query.limit(50);
    const { data } = await query;

    if (data) {
      talents = data.map((profile: Record<string, unknown>) => {
        const roles = profile.profile_roles as { role_name: string }[] | null;
        const profileProjects = profile.projects as { id: string }[] | null;
        return {
          id: profile.id,
          full_name: profile.full_name,
          slug: profile.slug,
          avatar_url: profile.avatar_url,
          location: profile.location,
          is_available: profile.is_available,
          bio: profile.bio,
          created_at: profile.created_at,
          roles: (roles ?? []).map((r) => r.role_name),
          project_count: profileProjects?.length ?? 0,
          plan: profile.plan, // interne au tri, retire de la reponse
        };
      });

      // Filter by role if specified
      if (role) {
        const roleLower = role.toLowerCase();
        talents = talents.filter((t) =>
          (t.roles as string[]).some((r) =>
            r.toLowerCase().includes(roleLower)
          )
        );
      }

      // Sort by project count if requested (Pro en departage a count egal)
      if (sort === "projets") {
        talents.sort((a, b) => {
          const byCount = (b.project_count as number) - (a.project_count as number);
          if (byCount !== 0) return byCount;
          return (b.plan === "pro" ? 1 : 0) - (a.plan === "pro" ? 1 : 0);
        });
      }

      // plan est interne au tri : on ne l'expose pas dans la reponse
      talents.forEach((t) => { delete (t as { plan?: unknown }).plan; });
    }
  }

  // --- Projects (single query with join) ---
  // Client utilisateur (anon ou session) : la visibilite d'un film (public /
  // membres seulement / depublie) est appliquee par la RLS. Ne JAMAIS passer
  // cette lecture en service role sans filtrer status + visibility a la main.
  if (type === "all" || type === "projets") {
    // Visiteur non connecte : son equipe passe par public_project_credits.
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase
      .from("projects")
      .select(`
        id, title, slug, description, category, year, video_url, profile_id, created_at,
        profiles!projects_profile_id_fkey ( is_suspended ),
        ${TEAM_SELECT}
      `)
      .eq("status", "approved");

    if (q) {
      const term = sanitizeSearchTerm(q);
      if (term) {
        query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
      }
    }
    if (category) {
      query = query.eq("category", category);
    }

    if (sort === "date") {
      query = query.order("created_at", { ascending: false });
    } else {
      query = query.order("year", { ascending: false });
    }

    query = query.limit(50);
    const { data } = await query;

    if (data) {
      const rows = (data as unknown as (Record<string, unknown> & { id: string })[])
        // Retire les films dont le Responsable est suspendu (chantier 3). Film
        // sans Responsable (profile_id null) : pas de profil joint, rien a tester.
        .filter((project) => {
          const owner = project.profiles as { is_suspended?: boolean } | null;
          return !owner?.is_suspended;
        });
      const teamOf = await loadFilmTeams(supabase, !user, rows);

      projects = rows.map((project) => ({
        id: project.id,
        title: project.title,
        slug: project.slug,
        description: project.description,
        category: project.category,
        year: project.year,
        video_url: project.video_url,
        profile_id: project.profile_id,
        created_at: project.created_at,
        // Realisateur : credits de realisation du film (chaine vide si aucun),
        // plus le Responsable. Remplace owner_name / owner_slug.
        director_name: teamOf(project.id).director_name,
      }));
    }
  }

  return NextResponse.json({
    talents,
    projects,
    counts: {
      talents: talents.length,
      projects: projects.length,
      total: talents.length + projects.length,
    },
  });
}
