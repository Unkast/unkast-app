import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionStrength } from "@/lib/adminSession";

// Garde admin UNIQUE — consommee par /api/admin (GET, PATCH) ET par le layout
// serveur de /admin. Ne pas dupliquer : toute variante recreerait un ecart
// entre la garde API et la garde page.
// is_admin est revoque pour anon/authenticated : lecture via le client de
// confiance (service role), scope sur la ligne de l'utilisateur courant.
//
// Trois conditions, toutes verifiees cote serveur (lot 9) :
//   1. profiles.is_admin
//   2. session ouverte par email + mot de passe (une session Google du meme email
//      ne donne aucun droit admin)
//   3. double authentification validee (MFA TOTP, niveau aal2)
export async function getAdminAccess(): Promise<{ userId: string | null; isAdmin: boolean; password: boolean; mfa: boolean }> {
  // ignoreView : la vue « visiteur » ne s'applique jamais a l'admin lui-meme.
  const supabase = await createClient({ ignoreView: true });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: null, isAdmin: false, password: false, mfa: false };
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { userId: user.id, isAdmin: false, password: false, mfa: false };
  return { userId: user.id, isAdmin: true, ...(await sessionStrength(supabase)) };
}

export async function getAdminId(): Promise<string | null> {
  const access = await getAdminAccess();
  return access.isAdmin && access.password && access.mfa ? access.userId : null;
}
