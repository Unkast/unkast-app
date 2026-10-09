import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBody, invalidBodyResponse, isText, MAX_NOTE_LENGTH } from "@/lib/api";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  // Anti-spam de signalements : 10 / heure / utilisateur (fail-open).
  if (!(await checkRateLimit(`report:${user.id}`, 10, 3600))) {
    return NextResponse.json({ error: "Trop de signalements. Réessaie plus tard." }, { status: 429 });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { target_type, target_id, reason, description } = body;

  if (!target_type || !target_id || !reason) {
    return NextResponse.json({ error: "target_type, target_id et reason requis." }, { status: 400 });
  }

  if (!["profile", "project", "message", "career_entry"].includes(target_type)) {
    return NextResponse.json({ error: "target_type invalide." }, { status: 400 });
  }

  if (!["spam", "inappropriate", "fake", "harassment", "copyright", "other"].includes(reason)) {
    return NextResponse.json({ error: "reason invalide." }, { status: 400 });
  }

  if (!isText(target_id, 64) || !isText(description, MAX_NOTE_LENGTH, true)) {
    return NextResponse.json({ error: "Description trop longue (1 000 caractères maximum)." }, { status: 400 });
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
