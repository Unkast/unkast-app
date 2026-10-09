import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ACCOUNT_BLOCKED_PATHS, ADMIN_ACCOUNT_TYPE, sessionStrength } from "@/lib/adminSession";

// Pages ouvertes a un compte connecte dont l'inscription n'est pas finalisee.
const FINALIZE_EXEMPT = [
  "/rejoindre/finaliser",
  "/cgu",
  "/confidentialite",
  "/mentions-legales",
  "/admin",
  "/auth",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Protect /dashboard and /moi routes
  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/moi")) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    return NextResponse.redirect(url);
  }

  // /admin (lot 9) : compte admin, connecte par mot de passe, double authentification
  // validee. /admin/connexion reste ouverte ; /admin/mfa demande le compte admin et
  // le mot de passe. La garde serveur (lib/adminGuard.ts) refait le meme controle.
  if (pathname.startsWith("/admin")) {
    const isLogin = pathname === "/admin/connexion";
    const isMfa = pathname === "/admin/mfa";
    const to = (path: string, keepNext = false) => {
      const url = request.nextUrl.clone();
      // La destination est gardee dans ?next= : le lien de l'email d'alerte
      // (/admin?tab=films) ramene sur l'onglet demande apres la connexion.
      const next = isLogin || isMfa ? request.nextUrl.searchParams.get("next") : pathname + request.nextUrl.search;
      url.pathname = path;
      url.search = keepNext && next ? `?next=${encodeURIComponent(next)}` : "";
      return NextResponse.redirect(url);
    };
    if (!user) {
      if (!isLogin) return to("/admin/connexion", true);
    } else {
      // is_admin est revoque pour anon/authenticated : lecture via le client de
      // confiance (service role), scope sur la ligne de l'utilisateur courant.
      // Le proxy tourne sur le runtime Node.js par defaut (Next 16), donc la cle
      // service role y est disponible.
      const admin = createAdminClient();
      const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
      if (!profile?.is_admin) {
        // Un autre compte peut ouvrir la page de connexion admin pour changer de compte.
        if (!isLogin) return to("/feed");
      } else {
        const { password, mfa } = await sessionStrength(supabase);
        if (!password) {
          // Session Google ou lien : aucun droit admin, il faut le mot de passe.
          if (!isLogin) return to("/admin/connexion", true);
        } else if (!mfa) {
          if (!isMfa) return to("/admin/mfa", true);
        } else if (isLogin) {
          return to("/admin");
        }
      }
    }
  }

  // Check suspended accounts — block all pages except /suspended et
  // /compte-introuvable (voir plus bas, sinon boucle de redirection).
  if (
    user &&
    !pathname.startsWith("/suspended") &&
    !pathname.startsWith("/compte-introuvable") &&
    !pathname.startsWith("/api") &&
    pathname !== "/"
  ) {
    // profile_roles (1 ligne au plus) : sert a savoir si le compte est finalise.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_suspended, account_type, profile_roles ( id )")
      .eq("id", user.id)
      .limit(1, { foreignTable: "profile_roles" })
      .single();

    if (profileError) {
      // PGRST116 = ".single()" n'a pas eu exactement une ligne : le filtre
      // porte sur la cle primaire, donc "plusieurs lignes" est impossible —
      // c'est forcement ZERO ligne, un utilisateur Auth sans ligne `profiles`
      // (orphelin, meme diagnostic que lib/auth-guard.ts). Etat PERMANENT, pas
      // transitoire : FAIL-CLOSED, redirige vers une page dediee qui ne ment
      // pas sur la cause (PAS /suspended).
      if (profileError.code === "PGRST116") {
        console.error(
          `[middleware] Profil introuvable pour l'utilisateur Auth ${user.id} — ligne profiles absente (orphelin).`
        );
        const url = request.nextUrl.clone();
        url.pathname = "/compte-introuvable";
        return NextResponse.redirect(url);
      }

      // Tout le reste est TRANSITOIRE : reseau, timeout, 5xx, pool sature.
      // FAIL-OPEN, contrairement a lib/auth-guard.ts (qui bloque les
      // ECRITURES cote API) : ejecter un utilisateur legitime de toute
      // navigation pour une requete sur dix qui echoue coute plus cher que le
      // risque residuel — un suspendu qui consulte pendant un incident ne
      // peut de toute facon rien ecrire (getActiveUser reste fail-closed sur
      // /api). Logue pour rendre l'incident visible, ne bloque pas.
      console.error(
        `[middleware] Verification de suspension impossible pour ${user.id} :`,
        profileError
      );
    } else if (profile?.is_suspended) {
      const url = request.nextUrl.clone();
      url.pathname = "/suspended";
      return NextResponse.redirect(url);
    } else if (profile?.account_type === ADMIN_ACCOUNT_TYPE) {
      // Compte admin : ni finalisation, ni profil, ni messages, ni offre. Ces pages
      // le renvoient vers l'admin ; le reste du site lui est ouvert en lecture.
      if (ADMIN_ACCOUNT_BLOCKED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        url.search = "";
        return NextResponse.redirect(url);
      }
    } else if (
      // Compte connecte SANS METIER = inscription non finalisee (compte cree par
      // Google) : renvoye vers la finalisation, quelle que soit la page ouverte.
      // Exceptions : la finalisation elle-meme, les pages legales, l'admin, et
      // les recruteurs (autre parcours d'inscription). /api (dont la
      // deconnexion) et / sont deja exclus par la condition du bloc.
      profile &&
      profile.account_type !== "recruiter" &&
      (profile.profile_roles ?? []).length === 0 &&
      !FINALIZE_EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/rejoindre/finaliser";
      // La page demandee est gardee, sauf l'inscription classique (sans objet
      // pour un compte deja cree).
      url.search = pathname.startsWith("/rejoindre")
        ? ""
        : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
