import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationRow = {
  id: string;
  participant_1: string;
  participant_2: string;
};

// Resultat d'un comptage. `count === null` signifie que le comptage a ECHOUE,
// jamais « zero » : tout appelant qui garde un quota doit alors BLOQUER
// (fail-closed). Un echec de lecture traite comme un zero rendrait le quota
// contournable en provoquant une erreur — c'est precisement le defaut qu'avait
// countConversationsInitiatedToday avant le 2026-08-10 (`count ?? 0` ignorait
// l'erreur renvoyee par PostgREST).
type CountResult = { count: number | null; error: { message: string } | null };

const COUNT_FAILED = { message: "Comptage indisponible." };

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
 * Valide le format UUID canonique. Les identifiants de profil arrivent du corps
 * de la requete et sont interpoles dans un filtre PostgREST `.or(...)` par
 * findConversationBetween : sans cette validation, une chaine forgee pourrait
 * alterer le filtre. Sert aussi a renvoyer un 400 lisible plutot qu'une erreur
 * Postgres 22P02 sur un id mal forme.
 */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/** Conversation entre deux profils, dans un ordre ou dans l'autre. */
export async function findConversationBetween(
  admin: SupabaseClient,
  profileA: string,
  profileB: string
): Promise<{ data: ConversationRow | null; error: { message: string } | null }> {
  const { data, error } = await admin
    .from("conversations")
    .select("id, participant_1, participant_2")
    .or(
      `and(participant_1.eq.${profileA},participant_2.eq.${profileB}),` +
        `and(participant_1.eq.${profileB},participant_2.eq.${profileA})`
    )
    // maybeSingle et non single : `single()` renvoie une ERREUR quand il n'y a
    // aucune ligne, ce qui obligeait l'appelant a ignorer `error` en bloc et
    // rendait indistinguables « pas de conversation » et « lecture en echec ».
    .maybeSingle();

  return { data: (data as ConversationRow | null) ?? null, error };
}

/**
 * Cree la conversation, ou reutilise celle qui existe deja si une requete
 * concurrente l'a creee entretemps (code Postgres 23505 sur l'index unique
 * conversations_pair_unique, migration 20260810_conversations_pair_unique.sql).
 * La course se resout donc en REUTILISATION silencieuse, pas en erreur : c'est
 * bien la meme conversation que les deux appels voulaient obtenir.
 */
export async function createOrReuseConversation(
  admin: SupabaseClient,
  initiatorId: string,
  recipientId: string
): Promise<{ data: ConversationRow | null; error: { message: string } | null }> {
  const { data, error } = await admin
    .from("conversations")
    .insert({ participant_1: initiatorId, participant_2: recipientId })
    .select("id, participant_1, participant_2")
    .single();

  if (error && (error as { code?: string }).code === "23505") {
    return findConversationBetween(admin, initiatorId, recipientId);
  }

  return { data: (data as ConversationRow | null) ?? null, error };
}

/** Conversations initiees (participant_1) par `userId` sur les dernieres 24h. */
export async function countConversationsInitiatedToday(
  admin: SupabaseClient,
  userId: string
): Promise<CountResult> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("participant_1", userId)
    .gte("created_at", dayAgo);

  if (error) return { count: null, error };
  if (count === null) return { count: null, error: COUNT_FAILED };
  return { count, error: null };
}

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
 *
 * Valeur DERIVEE a chaque appel, jamais un compteur incremente : une course sur
 * la creation d'une conversation ne peut donc pas la corrompre.
 */
export async function countPeopleContacted(
  admin: SupabaseClient,
  userId: string
): Promise<CountResult> {
  const { data: initiated, error: initiatedError } = await admin
    .from("conversations")
    .select("id")
    .eq("participant_1", userId);

  if (initiatedError) return { count: null, error: initiatedError };
  if (!initiated) return { count: null, error: COUNT_FAILED };
  if (initiated.length === 0) return { count: 0, error: null };

  const { data: sent, error: sentError } = await admin
    .from("messages")
    .select("conversation_id")
    .eq("sender_id", userId)
    .in(
      "conversation_id",
      initiated.map((c) => c.id as string)
    );

  if (sentError) return { count: null, error: sentError };
  if (!sent) return { count: null, error: COUNT_FAILED };

  const distinct = new Set(sent.map((m) => m.conversation_id as string));
  return { count: distinct.size, error: null };
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
): Promise<{ sent: boolean | null; error: { message: string } | null }> {
  const { count, error } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("sender_id", userId);

  if (error) return { sent: null, error };
  if (count === null) return { sent: null, error: COUNT_FAILED };
  return { sent: count > 0, error: null };
}
