import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// `api` exclu : le middleware n'a rien a y faire. La ligne 64 de
// lib/supabase/middleware.ts ecarte deja /api du controle de suspension, mais le
// middleware s'executait quand meme et y faisait un auth.getUser() complet que la
// route refaisait ensuite via createClient() — un aller-retour Auth perdu par
// appel API. Verifie avant retrait : les 28 routes qui authentifient construisent
// toutes leur propre client (lib/supabase/server.ts), dont le setAll ecrit
// reellement les cookies en Route Handler. Le refresh de session y est donc
// autonome, il ne dependait pas du middleware.
//
// Le prefetch est exclu lui aussi. Les <Link> prechargent en entrant dans le
// viewport, ce qui declenchait autant de traversees du middleware — donc autant
// de lectures `profiles` — que de liens visibles, pour une page que l'utilisateur
// n'ouvrira peut-etre jamais. Sur une route dynamique ce prefetch est PARTIEL
// (jusqu'a la frontiere loading.js) et releve de staleTimes.dynamic, defaut 0 :
// la navigation reelle refait toujours une requete, qui elle retraverse le
// middleware. L'exclure ne cree donc aucun angle mort.
//
// ATTENTION : cela ne vaut que pour le prefetch PARTIEL. `router.prefetch()` fait
// un prefetch COMPLET, mis en cache client 5 minutes (staleTimes.static), et une
// navigation dans cette fenetre est servie sans requete reseau — le middleware ne
// s'executerait alors jamais. Les 4 appels router.prefetch d'AppShell ont ete
// retires pour cette raison. Ne pas les reintroduire sans revoir ce matcher.
//
// Le header next-router-prefetch est invisible depuis la fonction (Next retire les
// en-tetes Flight de request.headers), mais reste exploitable ici : les conditions
// du matcher sont evaluees avant, au niveau du routage.
export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
