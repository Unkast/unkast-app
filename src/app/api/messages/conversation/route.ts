import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST: start or get a conversation with someone
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const admin = createAdminClient();

  // Check plan
  const { data: profile } = await admin.from("profiles").select("plan").eq("id", user.id).single();
  if (profile?.plan !== "pro") {
    return NextResponse.json({ error: "Pro requis.", redirect: "/pro" }, { status: 403 });
  }

  const body = await request.json();
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

  // Create new conversation
  const { data: newConv, error } = await admin.from("conversations")
    .insert({ participant_1: user.id, participant_2: recipient_id })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversation_id: newConv!.id }, { status: 201 });
}
