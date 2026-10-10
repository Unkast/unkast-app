import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";
import { TERMS_VERSION } from "@/lib/legal";
import { googleLandingPath } from "@/lib/google-account";

// Retour de l'ancienne connexion Google (redirection par Supabase). Reste en place
// tant que NEXT_PUBLIC_GOOGLE_CLIENT_ID n'est pas renseigne : GoogleSignInButton
// retombe alors sur ce flux. La connexion par jeton passe par POST /api/auth/google.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Chemin interne uniquement : `${origin}${next}` avec « @hote » ou « //hote »
  // enverrait ailleurs.
  const next = safeNextPath(searchParams.get("next"), "/feed");
  // Case des CGU cochee sur /rejoindre avant le clic Google : la version
  // acceptee voyage dans l'adresse de retour. Elle n'est enregistree que si
  // c'est la version en vigueur, et seulement a la creation du profil.
  const termsAccepted = searchParams.get("terms") === TERMS_VERSION;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      return NextResponse.redirect(`${origin}${await googleLandingPath(data.user, termsAccepted, next)}`);
    }
  }

  // Auth error — redirect to connexion with error
  return NextResponse.redirect(`${origin}/connexion?error=auth`);
}
