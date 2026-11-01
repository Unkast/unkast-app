import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProWriter } from "../guard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";
import { FOLDER_NOTE_MAX } from "@/lib/constants";

// Dispatch : ranger / retirer un talent dans un dossier (folder_candidates), et
// ecrire la remarque privee du recruteur sur ce rangement.
// RLS : ecriture autorisee seulement si le dossier appartient au recruteur.
//
// `role` est facultatif depuis 20261101_folder_candidates_note.sql : un talent
// ajoute depuis son profil n'a pas de poste (role NULL, « Sans poste »). La
// contrainte unique est en NULLS NOT DISTINCT, donc pas de doublon sans poste.

type Target = { folder_id: string; talent_id: string; role: string | null };

// Lit folder_id, talent_id et role (absent, null ou vide = sans poste).
function readTarget(body: Record<string, unknown>): Target | null {
  const { folder_id, talent_id, role } = body;
  if (typeof folder_id !== "string" || !folder_id || typeof talent_id !== "string" || !talent_id) return null;
  if (role !== undefined && role !== null && typeof role !== "string") return null;
  return { folder_id, talent_id, role: typeof role === "string" && role.trim() ? role : null };
}

const missing = () => NextResponse.json({ error: "folder_id et talent_id requis." }, { status: 400 });

// POST { folder_id, talent_id, role?, signal_id? } : ranger.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getProWriter(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const target = readTarget(body);
  if (!target) return missing();
  if (target.talent_id === guard.user.id) {
    return NextResponse.json({ error: "Tu ne peux pas t'ajouter à ta propre liste." }, { status: 400 });
  }

  // Upsert : ranger 2x le meme talent/poste dans un dossier est idempotent.
  const { error } = await supabase
    .from("folder_candidates")
    .upsert(
      { ...target, signal_id: body.signal_id ?? null },
      { onConflict: "folder_id,talent_id,role", ignoreDuplicates: true }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// PATCH { folder_id, talent_id, role?, note } : remarque privee (vide = effacee).
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getProWriter(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const target = readTarget(body);
  if (!target) return missing();
  if (body.note !== null && typeof body.note !== "string") {
    return NextResponse.json({ error: "Remarque invalide." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > FOLDER_NOTE_MAX) {
    return NextResponse.json({ error: `Remarque trop longue (${FOLDER_NOTE_MAX} caractères au plus).` }, { status: 400 });
  }

  let query = supabase
    .from("folder_candidates")
    .update({ note: note || null })
    .eq("folder_id", target.folder_id)
    .eq("talent_id", target.talent_id);
  query = target.role === null ? query.is("role", null) : query.eq("role", target.role);
  const { data, error } = await query.select("note");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Rangement introuvable." }, { status: 404 });
  }
  return NextResponse.json({ note: data[0].note });
}

// DELETE { folder_id, talent_id, role? } : retirer du dossier.
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getProWriter(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const target = readTarget(body);
  if (!target) return missing();

  let query = supabase
    .from("folder_candidates")
    .delete()
    .eq("folder_id", target.folder_id)
    .eq("talent_id", target.talent_id);
  query = target.role === null ? query.is("role", null) : query.eq("role", target.role);
  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
