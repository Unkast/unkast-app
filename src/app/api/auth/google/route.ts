import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJsonBody } from "@/lib/api";
import { safeNextPath } from "@/lib/utils";
import { TERMS_VERSION } from "@/lib/legal";
import { googleLandingPath } from "@/lib/google-account";

// Suite d'une connexion Google par jeton (GoogleSignInButton) : le navigateur ou
// l'app a deja ouvert la session avec supabase.auth.signInWithIdToken. Cette route
// cree le profil minimal a la premiere connexion et repond ou aller ensuite
// (finalisation, ou la page demandee).
//
// Corps : { next?: string, terms?: string }. `terms` = version des CGU cochee
// avant le clic ; enregistree seulement si c'est la version en vigueur, et
// seulement a la creation du profil.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  // Seul un compte relie a Google passe par ici : un compte par email a deja son
  // profil, cree par /api/signup.
  const providers: unknown = user.app_metadata?.providers;
  if (!Array.isArray(providers) || !providers.includes("google")) {
    return NextResponse.json({ error: "Connexion Google requise." }, { status: 403 });
  }

  const body = (await readJsonBody(request)) ?? {};
  const next = safeNextPath(typeof body.next === "string" ? body.next : null, "/feed");
  const redirect = await googleLandingPath(user, body.terms === TERMS_VERSION, next);
  return NextResponse.json({ redirect });
}
