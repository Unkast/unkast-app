import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/me : statut du visiteur sur SON PROPRE compte.
//
// is_admin et suspended_reason sont revoques en base pour anon et authenticated
// (migration 20260731_profiles_column_grants.sql) : ils ne peuvent plus etre lus
// depuis le navigateur. Cette route authentifie via le client utilisateur (cookies
// de session) puis les lit via le client de confiance, scope sur user.id.
// `plan` reste lisible par le client (useUserStatus l'interroge directement) ; il
// est renvoye ici par commodite, pour eviter un second aller-retour.
//
// Volontairement PAS de getActiveUser ici : la page /suspended doit rester
// consultable par un compte suspendu (le middleware exclut deja /api de la
// redirection vers /suspended).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin, plan, suspended_reason")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    is_admin: profile?.is_admin === true,
    plan: profile?.plan ?? "free",
    suspended_reason: profile?.suspended_reason ?? null,
  });
}
