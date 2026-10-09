import { createAdminClient } from "@/lib/supabase/admin";

// Rate limiting des endpoints publics via une RPC Supabase atomique
// (voir supabase/migrations/20260610_rate_limits.sql).
//
// FAIL-CLOSED : si la RPC échoue, la requête est REFUSÉE (429 côté routes) —
// un rate-limit qui s'efface en cas de panne ouvrirait le spam de comptes et
// d'emails Resend précisément quand l'infra va mal. L'erreur est loguée pour
// rendre l'incident visible.
// Seule exception : RPC ABSENTE (migration non exécutée, codes PGRST202/42883)
// HORS production → autorisé, pour ne pas bloquer le dev local. En production
// ce cas reste fail-closed.

/** Extrait l'IP client depuis les headers (Vercel : x-forwarded-for). */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Retourne true si la requête est autorisée, false si la limite est dépassée.
 * @param key clé logique (ex. `signup:${ip}`)
 * @param max nombre max de requêtes par fenêtre
 * @param windowSeconds durée de la fenêtre en secondes
 */
// PGRST202 = PostgREST : fonction introuvable dans le schema cache.
// 42883    = Postgres : undefined_function.
const MISSING_FUNCTION_CODES = new Set(["PGRST202", "42883"]);

export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  // Journaux : seulement le prefixe de la cle ("signup", "search"), jamais la partie
  // identifiante (adresse IP, identifiant de compte, cle derivee d'un email).
  const keyLabel = key.split(":")[0];
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      if (MISSING_FUNCTION_CODES.has(error.code ?? "") && process.env.NODE_ENV !== "production") {
        console.warn(`[rate-limit] RPC check_rate_limit absente (migration non exécutée) — autorisé hors production (clé "${keyLabel}").`);
        return true;
      }
      console.error(`[rate-limit] RPC check_rate_limit en erreur (clé "${keyLabel}") — requête refusée (fail-closed) :`, error);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error(`[rate-limit] Échec inattendu (clé "${keyLabel}") — requête refusée (fail-closed) :`, err);
    return false;
  }
}

/** Validation basique d'un format email. */
export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
