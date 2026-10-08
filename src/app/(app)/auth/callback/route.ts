import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify, safeNextPath } from "@/lib/utils";
import { TERMS_VERSION } from "@/lib/legal";

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
  // Etape de finalisation (type de compte, nom, metiers, ville), avec la page
  // ou revenir ensuite.
  const finalizeUrl = `${origin}/rejoindre/finaliser${next !== "/feed" ? `?next=${encodeURIComponent(next)}` : ""}`;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if profile already exists
      const admin = createAdminClient();
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existingProfile) {
        // First Google login — create profile automatically
        const fullName =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split("@")[0] ||
          "Utilisateur";
        const avatarUrl = data.user.user_metadata?.avatar_url || null;
        const profileSlug = slugify(fullName) + "-" + data.user.id.slice(0, 6);

        await admin.from("profiles").insert({
          id: data.user.id,
          full_name: fullName,
          slug: profileSlug,
          bio: null,
          avatar_url: avatarUrl,
          location: null,
          is_available: false,
          status: "approved",
          account_type: "talent",
          ...(termsAccepted
            ? { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() }
            : {}),
        });

        // Nouveau compte : toujours la finalisation, jamais l'inscription classique.
        return NextResponse.redirect(finalizeUrl);
      }

      // Compte existant : finalise = au moins un metier. Sinon, finalisation
      // (comptes Google restes a moitie inscrits). Un recruteur n'y passe pas :
      // son inscription suit un autre parcours.
      const [{ count: roleCount }, { data: account }] = await Promise.all([
        admin.from("profile_roles").select("id", { count: "exact", head: true }).eq("profile_id", data.user.id),
        admin.from("profiles").select("account_type").eq("id", data.user.id).single(),
      ]);
      if (roleCount === 0 && account?.account_type !== "recruiter") {
        return NextResponse.redirect(finalizeUrl);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to connexion with error
  return NextResponse.redirect(`${origin}/connexion?error=auth`);
}
