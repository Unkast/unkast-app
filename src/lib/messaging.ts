import type { SupabaseClient } from "@supabase/supabase-js";

// Quota anti-spam : nombre max de NOUVELLES conversations qu'un utilisateur
// peut initier sur 24h glissantes. Source de verite UNIQUE, consommee par les
// deux routes de creation (api/messages POST et api/messages/conversation POST)
// et par l'affichage du compteur (api/messages/daily-count) — aucune ne peut
// diverger.
export const DAILY_CONVERSATION_LIMIT = 5;

export const DAILY_LIMIT_MESSAGE = `Tu as atteint ta limite de ${DAILY_CONVERSATION_LIMIT} nouveaux contacts par jour. Réessaie demain.`;

/** Conversations initiees (participant_1) par `userId` sur les dernieres 24h. */
export async function countConversationsInitiatedToday(
  admin: SupabaseClient,
  userId: string
): Promise<number> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("participant_1", userId)
    .gte("created_at", dayAgo);
  return count ?? 0;
}
