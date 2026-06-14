import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Garde commun aux routes API sensibles (chantier 3 — moderation).
// Authentifie l'utilisateur ET verifie qu'il n'est PAS suspendu.
//
// La suspension (is_suspended) etait jusque-la appliquee UNIQUEMENT par le
// middleware sur la navigation des pages — les routes /api restaient ouvertes
// (le middleware exclut /api). Ce garde ferme ce trou cote serveur.
//
// Renvoie aussi le profil (plan/account_type/full_name) pour mutualiser les
// lectures deja faites par certaines routes (messages, recruitment).

type Server = Awaited<ReturnType<typeof createClient>>;

export interface ActiveUserProfile {
  id: string;
  is_suspended: boolean | null;
  plan: string | null;
  account_type: string | null;
  full_name: string | null;
}

export async function getActiveUser(
  supabase: Server
): Promise<
  | { user: { id: string }; profile: ActiveUserProfile; error: null; status: 200 }
  | { user: null; profile: null; error: string; status: 401 | 403 }
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, profile: null, error: "Non authentifie.", status: 401 };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, is_suspended, plan, account_type, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.is_suspended) {
    return { user: null, profile: null, error: "Compte suspendu.", status: 403 };
  }

  return {
    user: { id: user.id },
    profile: (profile ?? { id: user.id, is_suspended: false, plan: null, account_type: null, full_name: null }) as ActiveUserProfile,
    error: null,
    status: 200,
  };
}
