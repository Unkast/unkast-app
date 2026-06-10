import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const body = await request.json();
  const { target_type, target_id, reason, description } = body;

  if (!target_type || !target_id || !reason) {
    return NextResponse.json({ error: "target_type, target_id et reason requis." }, { status: 400 });
  }

  if (!["profile", "project", "message"].includes(target_type)) {
    return NextResponse.json({ error: "target_type invalide." }, { status: 400 });
  }

  if (!["spam", "inappropriate", "fake", "harassment", "copyright", "other"].includes(reason)) {
    return NextResponse.json({ error: "reason invalide." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Insert report
  const { error } = await admin.from("reports").insert({
    reporter_id: user.id,
    target_type,
    target_id,
    reason,
    description: description || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check if this target has 3+ reports from different users → flag for admin
  const { count } = await admin
    .from("reports")
    .select("reporter_id", { count: "exact", head: true })
    .eq("target_type", target_type)
    .eq("target_id", target_id)
    .eq("status", "pending");

  if ((count ?? 0) >= 3) {
    await admin.from("admin_logs").insert({
      admin_id: user.id,
      action: "auto_flag_reported",
      target_type,
      target_id,
      details: { report_count: count, reason },
    });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
