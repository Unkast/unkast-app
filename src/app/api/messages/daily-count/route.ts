import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { countConversationsInitiatedToday, DAILY_CONVERSATION_LIMIT } from "@/lib/messaging";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const admin = createAdminClient();
  const count = await countConversationsInitiatedToday(admin, user.id);

  return NextResponse.json({ count, limit: DAILY_CONVERSATION_LIMIT });
}
