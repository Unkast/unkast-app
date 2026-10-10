import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { TEAM_SELECT, loadFilmTeams } from "@/lib/film-team";
import { DISPLAY_NAME_COLUMNS, displayNameOf, type DisplayNameRow } from "@/lib/profile";
import { ALL_ROLES, CATEGORY_LABELS, LANGUAGES, PLAYING_AGES, baseRole, withBothForms, type Language, type PlayingAge } from "@/lib/constants";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

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

const MAX_PARAM_LENGTH = 100;

// Parametres d'une recherche, identiques pour GET (adresse) et POST (corps JSON).
type SearchParams = {
  q: string;
  type: string; // all | talents | projets
  category: string;
  location: string;
  role: string; // texte libre, sous-chaine d'un metier (historique)
  sort: string; // pertinence | date | projets
  // ---- Lot 8 (assistant de recherche). Tous valides contre une liste fermee ou
  // un format strict : aucun n'est du texte libre concatene dans un filtre. ----
  roles: string[]; // metiers exacts (ALL_ROLES) : le profil en a au moins un
  playing_age: PlayingAge | "";
  role_type: "femme" | "homme" | "";
  // Saisie libre (« comédienne ») : ne filtre RIEN, fait seulement passer en premier
  // les profils qui ont declare ce type de roles.
  prefer_role_type: "femme" | "homme" | "";
  language: Language | "";
  year: number | null;
  since_days: number | null; // films publies depuis N jours
};

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// Lit et valide les parametres. Renvoie une reponse d'erreur si l'un est invalide.
function parseParams(raw: Record<string, unknown>): SearchParams | NextResponse {
  const text = (name: string): string | NextResponse => {
    const value = raw[name];
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") return fail(`Paramètre "${name}" invalide.`);
    if (value.length > MAX_PARAM_LENGTH) return fail(`Paramètre "${name}" trop long.`);
    return value.trim();
  };

  const out: Record<string, string> = {};
  for (const name of ["q", "type", "category", "location", "role", "sort", "playing_age", "role_type", "prefer_role_type", "language"]) {
    const value = text(name);
    if (value instanceof NextResponse) return value;
    out[name] = value;
  }

  if (out.category && !(out.category in CATEGORY_LABELS)) return fail("Catégorie inconnue.");
  if (out.playing_age && !PLAYING_AGES.includes(out.playing_age as PlayingAge)) return fail("Âge de jeu inconnu.");
  for (const name of ["role_type", "prefer_role_type"]) {
    if (out[name] && out[name] !== "femme" && out[name] !== "homme") return fail("Type de rôles inconnu.");
  }
  if (out.language && !LANGUAGES.includes(out.language as Language)) return fail("Langue inconnue.");

  // Metiers exacts : liste (POST) ou chaine separee par des virgules (GET).
  const rawRoles = Array.isArray(raw.roles) ? raw.roles : typeof raw.roles === "string" ? raw.roles.split(",") : [];
  // Une forme feminine est acceptee et ramenee au metier officiel.
  const roles = [...new Set(rawRoles.filter((r): r is string => typeof r === "string").map((r) => baseRole(r.trim())).filter((r) => ALL_ROLES.includes(r)))];
  if (rawRoles.length > 0 && roles.length !== rawRoles.length) return fail("Métier inconnu.");

  const integer = (name: string, min: number, max: number): number | null | NextResponse => {
    const value = raw[name];
    if (value === undefined || value === null || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < min || n > max) return fail(`Paramètre "${name}" invalide.`);
    return n;
  };
  const year = integer("year", 1900, 2100);
  if (year instanceof NextResponse) return year;
  const sinceDays = integer("since_days", 1, 365);
  if (sinceDays instanceof NextResponse) return sinceDays;

  return {
    q: out.q,
    type: out.type || "all",
    category: out.category,
    location: out.location,
    role: out.role,
    sort: out.sort || "pertinence",
    roles,
    playing_age: out.playing_age as SearchParams["playing_age"],
    role_type: out.role_type as SearchParams["role_type"],
    prefer_role_type: out.prefer_role_type as SearchParams["prefer_role_type"],
    language: out.language as SearchParams["language"],
    year,
    since_days: sinceDays,
  };
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
// anon/authenticated aux colonnes non sensibles de `profiles` ; toute
// reference a une colonne hors de cette liste (ex. is_admin, contact_email,
// stripe_customer_id) fait echouer la requete PostgREST entiere plutot que
// de fuiter la valeur. La RLS ne rattrape rien ici : elle filtre les LIGNES
// (une ligne approuvee est deja publique), pas les COLONNES. Si une colonne
// sensible est un jour reaccordee dans ce GRANT, cette route redevient
// exfiltrante sans qu'aucun filet ne l'empeche. Voir l'audit du 2026-08-10.
//
// LOT 8 : les filtres ajoutes (metiers exacts, age de jeu, type de roles, langue,
// annee, anciennete) sont tous valides par parseParams contre une liste fermee ou
// un entier borne. Les trois colonnes qu'ils lisent (playing_ages, role_type,
// languages, migration 20261016) sont publiques par decision : aucun vrai nom,
// aucune coordonnee. Rien de ce qui est cherche n'est enregistre par cette route.
async function search(request: NextRequest, raw: Record<string, unknown>) {
  // Anti-abus : route publique sans auth, cle = IP (fail-closed, meme posture que
  // signup/waitlist/resend-confirmation). Deux fenetres : 5 requetes par seconde
  // (saisie en direct de l'assistant) et 60 par minute.
  const ip = getClientIp(request);
  const [burst, minute] = await Promise.all([
    checkRateLimit(`search-burst:${ip}`, 5, 1),
    checkRateLimit(`search:${ip}`, 60, 60),
  ]);
  if (!burst || !minute) {
    return NextResponse.json({ error: "Trop de requêtes. Réessaie dans un instant." }, { status: 429 });
  }

  const params = parseParams(raw);
  if (params instanceof NextResponse) return params;
  const { q, type, category, location, role, sort } = params;

  const supabase = await createClient();

  let talents: Record<string, unknown>[] = [];
  // Profils qui passent les autres filtres mais n'ont pas rempli un champ demande.
  let otherTalents: Record<string, unknown>[] = [];
  let projects: Record<string, unknown>[] = [];

  // --- Talents (single query with joins) ---
  if (type === "all" || type === "talents") {
    // Champs DECLARES par la personne (type de roles, age de jeu, langue). Regle
    // (09/10/2026) : on ne deduit jamais l'un d'eux d'autre chose, et surtout pas le
    // type de roles du metier. Le filtre ne garde que les profils qui l'ont declare.
    // Ceux qui passent les autres filtres sans avoir rempli le champ demande sortent
    // dans une seconde liste, `other_talents`, avec ce qui leur manque.
    const declared = Boolean(params.role_type || params.playing_age || params.language);
    // Metiers exacts : jointure interne sur un second alias, pour filtrer les profils
    // sans amputer la liste de leurs metiers (`profile_roles`).
    const withRoles = params.roles.length > 0;
    // « Sans precision » est une declaration : la personne joue les deux.
    const roleTypes = params.role_type ? [params.role_type, "sans_precision"] : [];
    // Saisie libre : le mot « comédienne » designe un metier. Le type de roles ne filtre
    // pas, il classe : les profils qui ont declare ce type (ou « sans precision »)
    // d'abord, les autres ensuite, dans la meme liste. L'ordre de depart est conserve
    // a l'interieur de chaque groupe.
    const preferred = params.prefer_role_type ? [params.prefer_role_type, "sans_precision"] : null;
    const declaredFirst = (rows: Record<string, unknown>[]) =>
      preferred
        ? [...rows.filter((p) => preferred.includes(p.role_type as string)), ...rows.filter((p) => !preferred.includes(p.role_type as string))]
        : rows;

    // strict : les champs declares correspondent. Sinon : ils correspondent OU sont
    // vides (les valeurs viennent de listes fermees, voir parseParams).
    const talentQuery = (strict: boolean) => {
      let query = supabase
        .from("profiles")
        .select(`
          id, ${DISPLAY_NAME_COLUMNS}, slug, avatar_url, location, is_available, bio, created_at, plan,
          ${strict ? (preferred ? "role_type," : "") : "role_type, playing_ages, languages,"}
          profile_roles ( role_name ),
          ${withRoles ? "wanted_roles:profile_roles!inner ( role_name )," : ""}
          projects!projects_profile_id_fkey ( id )
        `)
        .eq("status", "approved")
        .not("is_suspended", "is", true); // chantier 3 : suspendus hors vue publique

      if (q) {
        const term = sanitizeSearchTerm(q);
        if (term) {
          // Nom d'affichage uniquement : le vrai nom d'une personne qui affiche un
          // nom de scene ne la fait pas remonter (colonne fermee aux clients).
          query = query.or(`display_name.ilike.%${term}%,bio.ilike.%${term}%`);
        }
      }
      if (location) {
        query = query.ilike("location", `%${escapeLikeWildcards(location)}%`);
      }
      // Les deux formes de chaque metier : la personne affiche « Monteur » ou « Monteuse ».
      if (withRoles) query = query.in("wanted_roles.role_name", withBothForms(params.roles));

      if (params.role_type) {
        query = strict
          ? query.in("role_type", roleTypes)
          : query.or(`role_type.is.null,role_type.in.(${roleTypes.join(",")})`);
      }
      if (params.playing_age) {
        query = strict
          ? query.overlaps("playing_ages", [params.playing_age])
          : query.or(`playing_ages.is.null,playing_ages.ov.{"${params.playing_age}"}`);
      }
      if (params.language) {
        query = strict
          ? query.contains("languages", [params.language])
          : query.or(`languages.is.null,languages.cs.{"${params.language}"}`);
      }

      if (sort === "date") {
        query = query.order("created_at", { ascending: false });
      } else {
        query = query.order("display_name", { ascending: true });
      }
      // Coup de pouce Pro : critere SECONDAIRE uniquement (departage a rang egal,
      // jamais "Pro d'abord"). nullsFirst:false => plan null (legacy) en dernier.
      return query.order("plan", { ascending: false, nullsFirst: false }).limit(strict ? 50 : 100);
    };

    const toTalent = (profile: Record<string, unknown>) => {
      const roles = profile.profile_roles as { role_name: string }[] | null;
      const profileProjects = profile.projects as { id: string }[] | null;
      return {
        id: profile.id,
        full_name: displayNameOf(profile as DisplayNameRow),
        slug: profile.slug,
        avatar_url: profile.avatar_url,
        location: profile.location,
        is_available: profile.is_available,
        bio: profile.bio,
        created_at: profile.created_at,
        roles: (roles ?? []).map((r) => r.role_name),
        project_count: profileProjects?.length ?? 0,
        plan: profile.plan, // interne au tri, retire de la reponse
      } as Record<string, unknown>;
    };
    // Filtre historique `role` (sous-chaine d'un metier), applique apres lecture.
    const byRole = (list: Record<string, unknown>[]) => {
      if (!role) return list;
      const roleLower = role.toLowerCase();
      return list.filter((t) => (t.roles as string[]).some((r) => r.toLowerCase().includes(roleLower)));
    };
    // Tri par nombre de films si demande (Pro en departage a nombre egal), puis
    // retrait de `plan`, interne au tri : il n'est pas expose dans la reponse.
    const finish = (list: Record<string, unknown>[]) => {
      if (sort === "projets") {
        list.sort((a, b) => {
          const byCount = (b.project_count as number) - (a.project_count as number);
          if (byCount !== 0) return byCount;
          return (b.plan === "pro" ? 1 : 0) - (a.plan === "pro" ? 1 : 0);
        });
      }
      list.forEach((t) => { delete (t as { plan?: unknown }).plan; });
      return list;
    };

    const [main, loose] = await Promise.all([talentQuery(true), declared ? talentQuery(false) : null]);

    // Filtre du lot 8 demande alors que la migration 20261016 n'est pas passee
    // (colonne inconnue) : erreur dite, plutot qu'une liste vide trompeuse.
    if ((declared || preferred) && (main.error || loose?.error)) {
      console.error("[search] filtres du profil indisponibles:", (main.error ?? loose?.error)?.message);
      return NextResponse.json({ error: "Ce filtre n'est pas encore disponible." }, { status: 503 });
    }

    talents = finish(byRole(declaredFirst((main.data ?? []) as unknown as Record<string, unknown>[]).map(toTalent)));

    if (loose?.data) {
      // Tout profil de `loose` qui n'est pas dans `main` a au moins un champ demande vide.
      const exact = new Set(talents.map((t) => t.id));
      const rows = declaredFirst((loose.data as unknown as Record<string, unknown>[]).filter((p) => !exact.has(p.id)));
      otherTalents = finish(
        byRole(
          rows.map((p) => ({
            ...toTalent(p),
            // Ce que la personne n'a pas renseigne, parmi ce qui etait demande.
            missing: [
              params.role_type && !p.role_type ? "role_type" : null,
              params.playing_age && !p.playing_ages ? "playing_age" : null,
              params.language && !p.languages ? "language" : null,
            ].filter(Boolean),
          }))
        )
      ).slice(0, 50);
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
        id, title, slug, description, category, year, video_url, profile_id, created_at, poster_url, preview_url, episode_count,
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
    if (params.year !== null) query = query.eq("year", params.year);
    if (params.since_days !== null) {
      query = query.gte("created_at", new Date(Date.now() - params.since_days * 86_400_000).toISOString());
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
        poster_url: project.poster_url ?? null,
        preview_url: project.preview_url ?? null,
        episode_count: project.episode_count ?? null,
        // Realisateur : credits de realisation du film (chaine vide si aucun),
        // plus le Responsable. Remplace owner_name / owner_slug.
        director_name: teamOf(project.id).director_name,
      }));
    }
  }

  return NextResponse.json({
    talents,
    other_talents: otherTalents,
    projects,
    counts: {
      talents: talents.length,
      projects: projects.length,
      total: talents.length + projects.length,
    },
  });
}

// GET : recherche de la page Explorer (/recherche?q=, adresse partageable).
export async function GET(request: NextRequest) {
  return search(request, Object.fromEntries(new URL(request.url).searchParams));
}

// POST : memes parametres dans le corps JSON. Utilise par l'assistant de recherche
// pour que ce qui est tape ne figure dans aucune adresse (donc dans aucun journal
// de requetes). La reponse ne doit pas etre mise en cache.
export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const response = await search(request, body as Record<string, unknown>);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
