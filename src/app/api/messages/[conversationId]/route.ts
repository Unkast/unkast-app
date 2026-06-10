import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET: fetch messages for a conversation
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifie." }, { status: 401 });

  const { conversationId } = await params;
  const admin = createAdminClient();

  // Verify user is participant
  const { data: conv } = await admin.from("conversations")
    .select("participant_1, participant_2")
    .eq("id", conversationId)
    .single();

  if (!conv || (conv.participant_1 !== user.id && conv.participant_2 !== user.id)) {
    return NextResponse.json({ error: "Non autorise." }, { status: 403 });
  }

  // Fetch messages
  const { data: messages } = await admin.from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  // Mark unread messages as read
  await admin.from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  // Get other participant info
  const otherId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
  const { data: other } = await admin.from("profiles").select("full_name, slug, avatar_url").eq("id", otherId).single();

  return NextResponse.json({
    messages: messages ?? [],
    other: { id: otherId, full_name: other?.full_name || "", slug: other?.slug || "", avatar_url: other?.avatar_url || null },
    current_user_id: user.id,
  });
}
