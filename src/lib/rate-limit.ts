import { createAdminClient } from "@/lib/supabase/admin";

// Rate limiting des endpoints publics via une RPC Supabase atomique
// (voir supabase/migrations/20260610_rate_limits.sql).
//
// FAIL-OPEN : si la RPC n'existe pas encore (migration non exécutée) ou en
// erreur, on autorise la requête — on ne bloque jamais un vrai utilisateur à
// cause d'un souci d'infra. La sécurité ne s'active qu'une fois la migration
// passée, mais le code est déployable sans casse avant.

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
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // fail-open
    return data === true;
  } catch {
    return true; // fail-open
  }
}

/** Validation basique d'un format email. */
export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
