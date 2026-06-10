import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

// RÈGLE 1 : Seuls les Pro peuvent initier une conversation
// RÈGLE 2 : Tout le monde peut répondre (gratuit inclus)
// RÈGLE 3 : Max 5 nouvelles conversations/jour pour les Pro
// RÈGLE 4 : Délai 48h si pas de réponse avant relance
// RÈGLE 5 : Coordonnées bloquées dans les 3 premiers messages
// RÈGLE 6 : Badge non lus visible pour tous (free et pro)

const CONTACT_REGEX = /(\b06|\b07|\+33|@\w+\.\w+|https?:\/\/|www\.)/i;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("plan, full_name").eq("id", user.id).single();

  const body = await request.json();
  const { conversation_id, recipient_id, content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }

  let convId = conversation_id;
  let isNewConversation = false;

  // Try to find existing conversation
  if (!convId && recipient_id) {
    const { data: existing } = await admin.from("conversations")
      .select("id")
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${recipient_id}),and(participant_1.eq.${recipient_id},participant_2.eq.${user.id})`)
      .single();

    if (existing) {
      convId = existing.id;
    } else {
      isNewConversation = true;
    }
  }

  // ── RÈGLE 1 : Seuls les Pro peuvent INITIER ──
  if (isNewConversation && profile?.plan !== "pro") {
    return NextResponse.json({
      error: "pro_required",
      message: "Passe à Pro pour initier une conversation.",
    }, { status: 403 });
  }

  // ── RÈGLE 3 : Max 5 nouvelles conversations/jour ──
  if (isNewConversation) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyConvs } = await admin.from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("participant_1", user.id)
      .gte("created_at", dayAgo);

    if ((dailyConvs ?? 0) >= 5) {
      return NextResponse.json({
        error: "daily_limit_reached",
        message: "Tu as atteint ta limite de 5 nouveaux contacts par jour. Réessaie demain.",
      }, { status: 429 });
    }

    // Create the conversation
    const { data: newConv } = await admin.from("conversations")
      .insert({ participant_1: user.id, participant_2: recipient_id })
      .select("id").single();
    if (!newConv) return NextResponse.json({ error: "Erreur création conversation." }, { status: 500 });
    convId = newConv.id;
  }

  if (!convId) return NextResponse.json({ error: "conversation_id ou recipient_id requis." }, { status: 400 });

  // Get conversation participants
  const { data: conv } = await admin.from("conversations")
    .select("participant_1, participant_2").eq("id", convId).single();
  if (!conv) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });

  // SÉCURITÉ : interdire d'écrire dans une conversation dont on n'est pas participant
  // (le service role bypasse la RLS — la vérif d'appartenance doit être faite ici).
  if (conv.participant_1 !== user.id && conv.participant_2 !== user.id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const recipientId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;

  // ── RÈGLE 2 : Gratuit peut répondre dans une conv existante ──
  // (pas de check plan ici — déjà passé la règle 1)

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

  if ((totalMsgs ?? 0) < 3 && CONTACT_REGEX.test(content)) {
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

  // Update conversation timestamp
  await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);

  // Push notification
  sendPushToUser(recipientId, {
    title: `Message de ${profile?.full_name || "Quelqu'un"}`,
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
    const { data: other } = await admin.from("profiles").select("full_name, slug, avatar_url").eq("id", otherId).single();
    const { data: lastMsg } = await admin.from("messages").select("content, created_at, sender_id, is_read")
      .eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1).single();
    const { count: unread } = await admin.from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", c.id).eq("is_read", false).neq("sender_id", user.id);

    return {
      id: c.id,
      other_name: other?.full_name || "",
      other_slug: other?.slug || "",
      other_avatar: other?.avatar_url || null,
      last_message: lastMsg?.content || "",
      last_message_at: lastMsg?.created_at || c.created_at,
      unread_count: unread ?? 0,
    };
  }));

  return NextResponse.json({ conversations: enriched });
}
