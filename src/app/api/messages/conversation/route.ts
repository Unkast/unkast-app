import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import {
  countConversationsInitiatedToday,
  DAILY_CONVERSATION_LIMIT,
  DAILY_LIMIT_MESSAGE,
} from "@/lib/messaging";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// POST: start or get a conversation with someone
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus — memes gardes
  // que api/messages POST (cette route creait une conversation sans eux).
  const guard = await getActiveUser(supabase);
  if (!guard.user) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const user = guard.user;

  const admin = createAdminClient();

  // Check plan (mutualise via le garde — plus de lecture separee)
  if (guard.profile.plan !== "pro") {
    return NextResponse.json({ error: "Pro requis.", redirect: "/pro" }, { status: 403 });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { recipient_id } = body;
  if (!recipient_id) return NextResponse.json({ error: "recipient_id requis." }, { status: 400 });

  // Check if conversation exists
  const { data: existing } = await admin.from("conversations")
    .select("id")
    .or(`and(participant_1.eq.${user.id},participant_2.eq.${recipient_id}),and(participant_1.eq.${recipient_id},participant_2.eq.${user.id})`)
    .single();

  if (existing) {
    return NextResponse.json({ conversation_id: existing.id });
  }

  // Meme quota journalier que api/messages POST (helper partage).
  const dailyConvs = await countConversationsInitiatedToday(admin, user.id);
  if (dailyConvs >= DAILY_CONVERSATION_LIMIT) {
    return NextResponse.json({ error: DAILY_LIMIT_MESSAGE }, { status: 429 });
  }

  // Create new conversation
  const { data: newConv, error } = await admin.from("conversations")
    .insert({ participant_1: user.id, participant_2: recipient_id })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversation_id: newConv!.id }, { status: 201 });
}
