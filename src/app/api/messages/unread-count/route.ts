import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .neq("sender_id", user.id)
    .eq("is_read", false);

  // We need to filter by conversations where user is participant
  // Since RLS handles this, the count is already scoped
  return NextResponse.json({ count: count ?? 0 });
}
