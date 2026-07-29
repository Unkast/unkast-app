import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// POST: register or refresh a push token for the authenticated user
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { token, platform } = body;

  if (!token) {
    return NextResponse.json({ error: "Token requis." }, { status: 400 });
  }

  // Upsert: if this token already exists for this user, do nothing
  const { error } = await supabase.from("push_tokens").upsert(
    {
      profile_id: user.id,
      token,
      platform: platform || "android",
    },
    { onConflict: "profile_id,token" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
