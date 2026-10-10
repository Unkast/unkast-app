import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import { TERMS_VERSION } from "@/lib/legal";

// Suite d'une connexion Google, commune aux deux chemins : jeton Google echange
// dans le navigateur ou l'app (POST /api/auth/google) et ancien retour OAuth
// (/auth/callback). Cree le profil minimal a la premiere connexion, puis renvoie
// le chemin ou aller.
//
//   - Nouveau compte : profil minimal, puis la finalisation (jamais l'inscription
//     classique). `termsAccepted` (case cochee avant le clic Google) n'est
//     enregistree qu'a cette creation.
//   - Compte existant : finalise = au moins un metier. Sinon, finalisation (comptes
//     Google restes a moitie inscrits). Un recruteur n'y passe pas : son
//     inscription suit un autre parcours.
//
// `next` doit deja etre un chemin interne valide (safeNextPath).
export async function googleLandingPath(user: User, termsAccepted: boolean, next: string): Promise<string> {
  const finalizePath = `/rejoindre/finaliser${next !== "/feed" ? `?next=${encodeURIComponent(next)}` : ""}`;
  const admin = createAdminClient();

  const { data: existingProfile } = await admin.from("profiles").select("id").eq("id", user.id).single();

  if (!existingProfile) {
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Utilisateur";
    await admin.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      slug: slugify(fullName) + "-" + user.id.slice(0, 6),
      bio: null,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      location: null,
      is_available: false,
      status: "approved",
      account_type: "talent",
      ...(termsAccepted
        ? { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() }
        : {}),
    });
    return finalizePath;
  }

  const [{ count: roleCount }, { data: account }] = await Promise.all([
    admin.from("profile_roles").select("id", { count: "exact", head: true }).eq("profile_id", user.id),
    admin.from("profiles").select("account_type").eq("id", user.id).single(),
  ]);
  if (roleCount === 0 && account?.account_type !== "recruiter") return finalizePath;

  return next;
}
