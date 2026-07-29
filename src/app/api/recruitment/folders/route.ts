import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProUser, getProWriter } from "../guard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// Dossiers-films prives du recruteur. RLS : recruiter_id = auth.uid() uniquement.

// GET : liste des dossiers + nombre de candidats distincts par dossier.
export async function GET() {
  const supabase = await createClient();
  const guard = await getProUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { data: folders, error } = await supabase
    .from("recruiter_folders")
    .select("id, name, created_at")
    .eq("recruiter_id", guard.user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compte de candidats distincts (talent) par dossier.
  const { data: placements } = await supabase
    .from("folder_candidates")
    .select("folder_id, talent_id");
  const counts = new Map<string, Set<string>>();
  for (const p of placements ?? []) {
    if (!counts.has(p.folder_id)) counts.set(p.folder_id, new Set());
    counts.get(p.folder_id)!.add(p.talent_id);
  }

  return NextResponse.json({
    folders: (folders ?? []).map((f) => ({ ...f, count: counts.get(f.id)?.size ?? 0 })),
  });
}

// POST { name } : creer un dossier.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getProWriter(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { name } = body;
  const clean = (name ?? "").toString().trim();
  if (!clean) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("recruiter_folders")
    .insert({ recruiter_id: guard.user.id, name: clean })
    .select("id, name, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ folder: { ...data, count: 0 } }, { status: 201 });
}

// PATCH { id, name } : renommer.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getProWriter(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { id, name } = body;
  const clean = (name ?? "").toString().trim();
  if (!id || !clean) {
    return NextResponse.json({ error: "id et name requis." }, { status: 400 });
  }

  const { error } = await supabase
    .from("recruiter_folders")
    .update({ name: clean })
    .eq("id", id)
    .eq("recruiter_id", guard.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE ?id= : supprimer (cascade SQL retire les folder_candidates).
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getProWriter(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id requis." }, { status: 400 });
  }

  const { error } = await supabase
    .from("recruiter_folders")
    .delete()
    .eq("id", id)
    .eq("recruiter_id", guard.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
