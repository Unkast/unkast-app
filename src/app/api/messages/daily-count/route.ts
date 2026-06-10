import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count } = await admin.from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("participant_1", user.id)
    .gte("created_at", dayAgo);

  return NextResponse.json({ count: count ?? 0, limit: 5 });
}
