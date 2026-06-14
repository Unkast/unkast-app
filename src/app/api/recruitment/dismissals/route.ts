import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProWriter } from "../guard";

// Ecartement silencieux d'un candidat, par poste (recruiter_dismissals).
// Le talent ne le sait jamais (table sans aucune policy SELECT cote talent).
// RLS : recruiter_id = auth.uid().

// POST { talent_id, role } : ecarter.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getProWriter(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { talent_id, role } = await request.json();
  if (!talent_id || !role) {
    return NextResponse.json({ error: "talent_id et role requis." }, { status: 400 });
  }

  const { error } = await supabase
    .from("recruiter_dismissals")
    .upsert(
      { recruiter_id: guard.user.id, talent_id, role },
      { onConflict: "recruiter_id,talent_id,role", ignoreDuplicates: true }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE { talent_id, role } : annuler un ecartement (undo).
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getProWriter(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { talent_id, role } = await request.json();
  if (!talent_id || !role) {
    return NextResponse.json({ error: "talent_id et role requis." }, { status: 400 });
  }

  const { error } = await supabase
    .from("recruiter_dismissals")
    .delete()
    .eq("recruiter_id", guard.user.id)
    .eq("talent_id", talent_id)
    .eq("role", role);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
