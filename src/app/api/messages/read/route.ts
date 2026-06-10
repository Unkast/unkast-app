import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json();
  const { conversation_id } = body;
  if (!conversation_id) return NextResponse.json({ error: "conversation_id requis." }, { status: 400 });

  const admin = createAdminClient();

  // SÉCURITÉ : vérifier que l'utilisateur est bien participant de la conversation
  // avant de toucher à l'état des messages (le service role bypasse la RLS).
  const { data: conv } = await admin.from("conversations")
    .select("participant_1, participant_2").eq("id", conversation_id).single();
  if (!conv) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  if (conv.participant_1 !== user.id && conv.participant_2 !== user.id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  await admin.from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversation_id)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  return NextResponse.json({ success: true });
}
