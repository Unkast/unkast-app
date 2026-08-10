import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Quota anti-spam : nouvelles conversations sur 24h glissantes
// ---------------------------------------------------------------------------
// S'applique a TOUS les plans (inchange). Pour un compte gratuit il est en
// pratique inatteignable : le quota A VIE ci-dessous (2) est plus bas que ce
// plafond journalier (5), donc il mord toujours en premier. Aucun cas
// particulier a ecrire — mais si le quota gratuit passait un jour au-dessus de
// 5, ce plafond journalier commencerait a s'appliquer aussi aux comptes free.
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

// ---------------------------------------------------------------------------
// Quota A VIE du plan gratuit (2026-08-10, nouveau modele economique)
// ---------------------------------------------------------------------------
// Nombre de PERSONNES distinctes qu'un compte gratuit peut contacter, sans
// fenetre temporelle et sans remise a zero : un ex-Pro qui a initie 20
// conversations reste au-dessus du quota apres resiliation, il ne recupere pas
// 2 contacts neufs (decision produit du 2026-08-10 — sinon le quota serait
// « farmable » en resiliant puis en se reabonnant).
//
// Ce que consomme un contact : ecrire le PREMIER message dans un fil qu'on a
// soi-meme initie. Repondre dans un fil ouvert par quelqu'un d'autre ne
// consomme rien, et un fil ouvert puis abandonne (aucun message envoye) ne
// consomme rien non plus — voir countPeopleContacted.
export const FREE_CONTACT_LIMIT = 2;

export const FREE_CONTACT_LIMIT_MESSAGE = `Tu as utilisé tes ${FREE_CONTACT_LIMIT} contacts gratuits. Passe à Pro pour contacter d'autres personnes.`;

/**
 * Personnes DISTINCTES deja contactees par `userId`, au sens du quota gratuit :
 * conversations qu'il a INITIEES (participant_1) **et** dans lesquelles il a
 * effectivement envoye au moins un message.
 *
 * Deux exclusions volontaires :
 *   - les fils ouverts par quelqu'un d'autre (participant_1 != userId) : y
 *     repondre est gratuit pour tout le monde, quota ou pas ;
 *   - les fils qu'il a ouverts sans jamais rien ecrire : cliquer « Contacter »
 *     cree deja la ligne (POST /api/messages/conversation), il serait injuste
 *     de bruler un contact sur deux pour un fil abandonne.
 */
export async function countPeopleContacted(
  admin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: initiated } = await admin
    .from("conversations")
    .select("id")
    .eq("participant_1", userId);

  if (!initiated || initiated.length === 0) return 0;

  const { data: sent } = await admin
    .from("messages")
    .select("conversation_id")
    .eq("sender_id", userId)
    .in(
      "conversation_id",
      initiated.map((c) => c.id as string)
    );

  if (!sent) return 0;

  return new Set(sent.map((m) => m.conversation_id as string)).size;
}

/**
 * `userId` a-t-il deja ecrit dans cette conversation ? Sert a decider si le
 * message en cours d'envoi OUVRE un nouveau contact (premier message dans un
 * fil qu'il a initie) ou prolonge un echange deja compte.
 */
export async function hasSentMessageIn(
  admin: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("sender_id", userId);
  return (count ?? 0) > 0;
}
