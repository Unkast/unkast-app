import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { DISPLAY_NAME_COLUMNS, displayNameOf } from "@/lib/profile";
import { sendPushToUser } from "@/lib/push";
import {
  countConversationsInitiatedToday,
  countPeopleContacted,
  createOrReuseConversation,
  findConversationBetween,
  hasSentMessageIn,
  isUuid,
  DAILY_CONVERSATION_LIMIT,
  DAILY_LIMIT_MESSAGE,
  FREE_CONTACT_LIMIT,
  FREE_CONTACT_LIMIT_MESSAGE,
  type ConversationRow,
} from "@/lib/messaging";
import { readJsonBody, invalidBodyResponse, isText, MAX_MESSAGE_LENGTH } from "@/lib/api";
import { detectContact, type ContactVerdict } from "@/lib/contact-detector";
import { flagContactInfo } from "@/lib/contact-flag";

// RÈGLE 1 : Un compte gratuit peut contacter 2 PERSONNES (quota à vie) ; le Pro
//           est illimité. Voir FREE_CONTACT_LIMIT. Remplace, le 2026-08-10,
//           l'ancien blocage binaire « seuls les Pro peuvent initier ».
// RÈGLE 2 : Tout le monde peut répondre (gratuit inclus), sans quota
// RÈGLE 3 : Max 5 nouvelles conversations/jour (tous plans)
// RÈGLE 4 : Délai 48h si pas de réponse avant relance
// RÈGLE 5 : Coordonnées bloquées dans les 3 premiers messages
// RÈGLE 6 : Badge non lus visible pour tous (free et pro)
//
// C'est ICI que le quota gratuit fait foi, au PREMIER MESSAGE vers une
// personne — pas à la création de la ligne `conversations`. Garder la ligne
// comme unité de compte laisserait un trou béant : ouvrir 5 fils vides via
// POST /api/messages/conversation, puis écrire dans les 5, chaque envoi
// empruntant le chemin « conversation existante » qui ne testait rien.

// Comptage impossible (lecture en échec) => on BLOQUE. Un quota qui s'ouvre
// quand la base tousse n'est pas un quota.
function countUnavailable() {
  return NextResponse.json(
    {
      error: "count_unavailable",
      message: "Vérification de ton quota impossible pour le moment. Réessaie dans un instant.",
    },
    { status: 503 }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const user = guard.user;
  const profile = guard.profile; // { plan, full_name, ... } — mutualise la lecture

  const admin = createAdminClient();

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { conversation_id, recipient_id, content } = body;

  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }
  if (!isText(content, MAX_MESSAGE_LENGTH)) {
    return NextResponse.json({ error: "Message trop long (4 000 caractères maximum)." }, { status: 400 });
  }

  let convId: string | null = conversation_id ?? null;
  let conv: ConversationRow | null = null;
  let isNewConversation = false;

  if (convId && !isUuid(convId)) {
    return NextResponse.json({ error: "conversation_id invalide." }, { status: 400 });
  }

  // Try to find existing conversation
  if (!convId && recipient_id !== undefined) {
    if (!isUuid(recipient_id)) {
      return NextResponse.json({ error: "recipient_id invalide." }, { status: 400 });
    }
    if (recipient_id === user.id) {
      return NextResponse.json({ error: "Impossible de se contacter soi-même." }, { status: 400 });
    }

    const { data: existing, error: lookupError } = await findConversationBetween(admin, user.id, recipient_id);
    // Fail-closed : sans lecture fiable, impossible de savoir si ce message
    // ouvrirait un nouveau contact. On refuse plutôt que de risquer un doublon
    // de conversation ou un quota contourné.
    if (lookupError) return countUnavailable();

    if (existing) {
      convId = existing.id;
      conv = existing;
    } else {
      isNewConversation = true;
    }
  }

  if (!convId && !isNewConversation) {
    return NextResponse.json({ error: "conversation_id ou recipient_id requis." }, { status: 400 });
  }

  // Conversation désignée par son id : lue MAINTENANT, ses participants étant
  // nécessaires au contrôle d'appartenance comme au quota gratuit ci-dessous.
  if (convId && !conv) {
    const { data, error } = await admin.from("conversations")
      .select("id, participant_1, participant_2").eq("id", convId).maybeSingle();
    if (error) return countUnavailable();
    if (!data) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
    conv = data as ConversationRow;
  }

  // SÉCURITÉ : interdire d'écrire dans une conversation dont on n'est pas participant
  // (le service role bypasse la RLS — la vérif d'appartenance doit être faite ici).
  if (conv && conv.participant_1 !== user.id && conv.participant_2 !== user.id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  // ── RÈGLE 1 : quota À VIE du plan gratuit (2 personnes contactées) ──
  // Ne se déclenche que si CE message ouvre un nouveau contact : fil que
  // j'initie, dans lequel je n'ai encore rien écrit. Répondre est toujours
  // libre (RÈGLE 2), y compris pour un ex-Pro largement au-dessus du quota.
  if (profile?.plan !== "pro") {
    let opensNewContact = isNewConversation;

    if (!opensNewContact && conv && conv.participant_1 === user.id) {
      const { sent, error } = await hasSentMessageIn(admin, conv.id, user.id);
      if (error || sent === null) return countUnavailable();
      opensNewContact = !sent;
    }

    if (opensNewContact) {
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
  }

  // ── RÈGLE 3 : Max 5 nouvelles conversations/jour (helper partagé avec
  // api/messages/conversation POST — aucune des deux routes ne peut diverger) ──
  if (isNewConversation) {
    const { count: dailyConvs, error: dailyError } = await countConversationsInitiatedToday(admin, user.id);
    if (dailyError || dailyConvs === null) return countUnavailable();

    if (dailyConvs >= DAILY_CONVERSATION_LIMIT) {
      return NextResponse.json({
        error: "daily_limit_reached",
        message: DAILY_LIMIT_MESSAGE,
      }, { status: 429 });
    }

    // Création (ou réutilisation si une requête concurrente a gagné la course).
    const { data: newConv, error: createError } = await createOrReuseConversation(admin, user.id, recipient_id);
    if (createError || !newConv) {
      return NextResponse.json({ error: "Erreur création conversation." }, { status: 500 });
    }
    convId = newConv.id;
    conv = newConv;
  }

  if (!convId || !conv) {
    return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  }

  const recipientId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;

  // ── RÈGLE 4 : Délai 48h si pas de réponse ──
  if (!isNewConversation) {
    // Get my last message in this conversation
    const { data: myLastMsg } = await admin.from("messages")
      .select("created_at")
      .eq("conversation_id", convId)
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1).single();

    if (myLastMsg) {
      // Check if recipient replied after my last message
      const { count: repliesAfter } = await admin.from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convId)
        .eq("sender_id", recipientId)
        .gt("created_at", myLastMsg.created_at);

      if ((repliesAfter ?? 0) === 0) {
        // No reply — check 48h delay
        const lastMsgTime = new Date(myLastMsg.created_at).getTime();
        const hoursSince = (Date.now() - lastMsgTime) / (1000 * 60 * 60);

        if (hoursSince < 48) {
          const hoursRemaining = Math.ceil(48 - hoursSince);
          return NextResponse.json({
            error: "wait_for_reply",
            message: `Attends une réponse avant de relancer. Tu pourras écrire à nouveau dans ${hoursRemaining}h.`,
            hours_remaining: hoursRemaining,
          }, { status: 429 });
        }
      }
    }
  }

  // ── RÈGLE 5 : Coordonnées bloquées dans les 3 premiers messages ──
  const { count: totalMsgs } = await admin.from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", convId);

  // Détecteur partagé (lib/contact-detector). Évident : refusé. Douteux : envoyé
  // puis signalé à l'admin. Après les 3 premiers messages : aucun contrôle.
  const contact: ContactVerdict = (totalMsgs ?? 0) < 3 ? detectContact(content) : { level: "none" };

  if (contact.level === "obvious") {
    return NextResponse.json({
      error: "coordinates_blocked",
      message: "Les coordonnées personnelles ne peuvent pas être partagées dans les premiers échanges. Établis d'abord une relation de confiance sur Unkast.",
    }, { status: 403 });
  }

  // ── INSERT message ──
  const { data: newMsg, error } = await admin.from("messages").insert({
    conversation_id: convId,
    sender_id: user.id,
    content: content.trim(),
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (contact.level === "doubtful") {
    await flagContactInfo(admin, "message", newMsg.id, contact.reason, content);
  }

  // Update conversation timestamp
  await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);

  // Push notification
  sendPushToUser(recipientId, {
    title: `Message de ${profile?.display_name || "Quelqu'un"}`,
    body: content.length > 80 ? content.slice(0, 80) + "..." : content,
    url: `/messages/${convId}`,
  }).catch(() => {});

  return NextResponse.json({ success: true, conversation_id: convId, message: newMsg }, { status: 201 });
}

// GET: list conversations (visible to ALL authenticated users)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const admin = createAdminClient();

  const { data: conversations } = await admin.from("conversations")
    .select("*")
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  const enriched = await Promise.all((conversations ?? []).map(async (c) => {
    const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;
    const { data: other } = await admin.from("profiles").select(`${DISPLAY_NAME_COLUMNS}, slug, avatar_url`).eq("id", otherId).single();
    const { data: lastMsg } = await admin.from("messages").select("content, created_at, sender_id, is_read")
      .eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1).single();
    const { count: unread } = await admin.from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", c.id).eq("is_read", false).neq("sender_id", user.id);

    return {
      id: c.id,
      other_name: displayNameOf(other) || "",
      other_slug: other?.slug || "",
      other_avatar: other?.avatar_url || null,
      last_message: lastMsg?.content || "",
      last_message_at: lastMsg?.created_at || c.created_at,
      unread_count: unread ?? 0,
    };
  }));

  return NextResponse.json({ conversations: enriched });
}
