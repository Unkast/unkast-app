import type { SupabaseClient } from "@supabase/supabase-js";

// Compte admin dedie (lot 9). Ce fichier n'importe rien de next/headers : il sert
// au proxy (lib/supabase/middleware.ts) comme aux pages et aux routes.

/** `profiles.account_type` du compte admin : aucun profil public, aucune ecriture. */
export const ADMIN_ACCOUNT_TYPE = "admin";

/**
 * Cookie « Voir le site comme : visiteur ». Tant qu'il vaut "visitor", le serveur lit
 * le site sans session (lib/supabase/server.ts), sauf dans /admin. Il ne donne aucun
 * droit, il en retire : pas besoin de le proteger.
 */
export const VIEW_COOKIE = "unkast_view";
export const VIEW_VISITOR = "visitor";

/** Pages fermees au compte admin : il n'a ni profil a gerer, ni messages, ni offre. */
export const ADMIN_ACCOUNT_BLOCKED_PATHS = ["/moi", "/messages", "/dashboard", "/rejoindre", "/pro"];

/**
 * Force de la session en cours, lue dans son jeton (deja verifie par getUser()).
 * `password` : ouverte par email et mot de passe (pas Google, pas un lien).
 * `mfa` : second facteur valide (niveau aal2).
 */
export async function sessionStrength(supabase: SupabaseClient): Promise<{ password: boolean; mfa: boolean }> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return { password: false, mfa: false };
  const methods = (data.currentAuthenticationMethods as (string | { method: string })[]).map((m) =>
    typeof m === "string" ? m : m.method
  );
  return { password: methods.includes("password"), mfa: data.currentLevel === "aal2" };
}

/** Destination apres la connexion admin : uniquement une page de /admin. */
export function adminNext(next: string | null | undefined): string {
  return next && next.startsWith("/admin") && !next.startsWith("/admin/connexion") && !next.startsWith("/admin/mfa")
    ? next
    : "/admin";
}
