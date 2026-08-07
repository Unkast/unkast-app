import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Garde admin UNIQUE — consommee par /api/admin (GET, PATCH) ET par le layout
// serveur de /admin. Ne pas dupliquer : toute variante recreerait un ecart
// entre la garde API et la garde page.
// is_admin est revoque pour anon/authenticated : lecture via le client de
// confiance (service role), scope sur la ligne de l'utilisateur courant.
export async function getAdminId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return null;
  return user.id;
}
