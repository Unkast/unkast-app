import type { createClient } from "@/lib/supabase/server";
import { getActiveUser } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";

// Garde-fou commun aux routes de l'espace pré-casting : utilisateur authentifie,
// NON suspendu (via getActiveUser, chantier 3) ET Pro. L'espace de recrutement
// n'a de sens que pour un compte Pro (creator ou recruteur) ; le badge
// "Je recrute" (is_recruiting) controle la visibilite cote talent, PAS l'acces.
// La RLS reste le backstop reel.

type Server = Awaited<ReturnType<typeof createClient>>;
// 503 vient de getActiveUser (verification de suspension impossible) et transite
// tel quel ; 429 est propre a getProWriter (rate-limit).
type GuardResult =
  | { user: { id: string }; error: null; status: 200 }
  | { user: null; error: string; status: 401 | 403 | 429 | 503 };

// LECTURES : authentifie + non suspendu + Pro.
export async function getProUser(supabase: Server): Promise<GuardResult> {
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return { user: null, error: guard.error, status: guard.status };
  }
  if (guard.profile.plan !== "pro") {
    return { user: null, error: "Espace reserve aux comptes Pro.", status: 403 };
  }
  return { user: guard.user, error: null, status: 200 };
}

// ECRITURES : idem + anti-spam (60 actions / heure / utilisateur, fail-open).
export async function getProWriter(supabase: Server): Promise<GuardResult> {
  const res = await getProUser(supabase);
  if (!res.user) return res;
  if (!(await checkRateLimit(`recruitment:${res.user.id}`, 60, 3600))) {
    return { user: null, error: "Trop d'actions. Réessaie plus tard.", status: 429 };
  }
  return res;
}
