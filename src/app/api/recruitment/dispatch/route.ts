import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProWriter } from "../guard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// Dispatch : ranger / retirer un candidat dans un dossier (folder_candidates).
// RLS : ecriture autorisee seulement si le dossier appartient au recruteur.

// POST { folder_id, talent_id, role, signal_id? } : ranger.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getProWriter(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { folder_id, talent_id, role, signal_id } = body;
  if (!folder_id || !talent_id || !role) {
    return NextResponse.json({ error: "folder_id, talent_id et role requis." }, { status: 400 });
  }

  // Upsert : ranger 2x le meme candidat/poste dans un dossier est idempotent.
  const { error } = await supabase
    .from("folder_candidates")
    .upsert(
      { folder_id, talent_id, role, signal_id: signal_id ?? null },
      { onConflict: "folder_id,talent_id,role", ignoreDuplicates: true }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE { folder_id, talent_id, role } : retirer du dossier.
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getProWriter(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { folder_id, talent_id, role } = body;
  if (!folder_id || !talent_id || !role) {
    return NextResponse.json({ error: "folder_id, talent_id et role requis." }, { status: 400 });
  }

  const { error } = await supabase
    .from("folder_candidates")
    .delete()
    .eq("folder_id", folder_id)
    .eq("talent_id", talent_id)
    .eq("role", role);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
