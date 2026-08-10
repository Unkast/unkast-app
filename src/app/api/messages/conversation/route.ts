import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import {
  countConversationsInitiatedToday,
  countPeopleContacted,
  createOrReuseConversation,
  findConversationBetween,
  isUuid,
  DAILY_CONVERSATION_LIMIT,
  DAILY_LIMIT_MESSAGE,
  FREE_CONTACT_LIMIT,
  FREE_CONTACT_LIMIT_MESSAGE,
} from "@/lib/messaging";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// POST: start or get a conversation with someone
//
// Le quota gratuit est PRÉ-vérifié ici, pour bloquer dès le clic sur
// « Contacter » plutôt que d'envoyer l'utilisateur dans un fil où il ne pourra
// rien écrire. Mais c'est POST /api/messages qui FAIT FOI, au premier message :
// créer la ligne ne consomme pas de contact (un fil abandonné est gratuit), et
// un client modifié pourrait de toute façon sauter cette route.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus — memes gardes
  // que api/messages POST (cette route creait une conversation sans eux).
  const guard = await getActiveUser(supabase);
  if (!guard.user) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const user = guard.user;

  const admin = createAdminClient();

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { recipient_id } = body;
  if (!recipient_id) return NextResponse.json({ error: "recipient_id requis." }, { status: 400 });
  if (!isUuid(recipient_id)) {
    return NextResponse.json({ error: "recipient_id invalide." }, { status: 400 });
  }
  if (recipient_id === user.id) {
    return NextResponse.json({ error: "Impossible de se contacter soi-même." }, { status: 400 });
  }

  // Comptage impossible => on bloque (fail-closed).
  const countUnavailable = () =>
    NextResponse.json(
      {
        error: "count_unavailable",
        message: "Vérification de ton quota impossible pour le moment. Réessaie dans un instant.",
      },
      { status: 503 }
    );

  // Conversation déjà ouverte avec cette personne : on la rend telle quelle.
  // Aucun quota à vérifier — elle est soit déjà comptée, soit ouverte par
  // l'autre (y répondre est libre). Un compte au-delà du quota garde donc
  // l'accès à tous ses échanges en cours.
  const { data: existing, error: lookupError } = await findConversationBetween(admin, user.id, recipient_id);
  if (lookupError) return countUnavailable();
  if (existing) {
    return NextResponse.json({ conversation_id: existing.id });
  }

  // ── Pré-vérification du quota gratuit (2 personnes contactées, à vie) ──
  if (guard.profile.plan !== "pro") {
    const { count, error } = await countPeopleContacted(admin, user.id);
    if (error || count === null) return countUnavailable();

    if (count >= FREE_CONTACT_LIMIT) {
      return NextResponse.json({
        error: "free_contact_limit_reached",
        message: FREE_CONTACT_LIMIT_MESSAGE,
        contacts_used: count,
        contacts_limit: FREE_CONTACT_LIMIT,
      }, { status: 403 });
    }
  }

  // Meme quota journalier que api/messages POST (helper partage).
  const { count: dailyConvs, error: dailyError } = await countConversationsInitiatedToday(admin, user.id);
  if (dailyError || dailyConvs === null) return countUnavailable();
  if (dailyConvs >= DAILY_CONVERSATION_LIMIT) {
    return NextResponse.json({ error: "daily_limit_reached", message: DAILY_LIMIT_MESSAGE }, { status: 429 });
  }

  // Création (ou réutilisation si une requête concurrente a gagné la course).
  const { data: newConv, error } = await createOrReuseConversation(admin, user.id, recipient_id);
  if (error || !newConv) {
    return NextResponse.json({ error: "Erreur création conversation." }, { status: 500 });
  }

  return NextResponse.json({ conversation_id: newConv.id }, { status: 201 });
}
