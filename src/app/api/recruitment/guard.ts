import type { createClient } from "@/lib/supabase/server";
import { getActiveUser } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";

// Garde-fou commun aux routes de l'espace pré-casting : utilisateur authentifie,
// NON suspendu (via getActiveUser, chantier 3), Pro ET createur ou recruteur
// (depuis le 2 novembre 2026 : meme regle que l'ecran, `canRecruit` de MoiClient
// et le bouton « Ajouter à une liste » du profil ; avant, un talent Pro passait).
// Le badge "Je recrute" (is_recruiting) controle la visibilite cote talent, PAS
// l'acces. La RLS reste le backstop reel.
const RECRUITER_TYPES = ["creator", "recruiter"];

type Server = Awaited<ReturnType<typeof createClient>>;
// 503 vient de getActiveUser (verification de suspension impossible) et transite
// tel quel ; 429 est propre a getProWriter (rate-limit).
type GuardResult =
  | { user: { id: string }; error: null; status: 200 }
  | { user: null; error: string; status: 401 | 403 | 429 | 503 };

// LECTURES : authentifie + non suspendu + Pro + createur ou recruteur.
export async function getProUser(supabase: Server): Promise<GuardResult> {
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return { user: null, error: guard.error, status: guard.status };
  }
  if (guard.profile.plan !== "pro") {
    return { user: null, error: "Espace reserve aux comptes Pro.", status: 403 };
  }
  if (!RECRUITER_TYPES.includes(guard.profile.account_type ?? "")) {
    return { user: null, error: "Espace réservé aux créateurs et recruteurs Pro.", status: 403 };
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
