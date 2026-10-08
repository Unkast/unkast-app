import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DISPLAY_NAME_COLUMNS, displayNameOf, type DisplayNameRow } from "@/lib/profile";
import { getProUser } from "../../guard";

// GET : detail d'un dossier — ses candidats ranges, groupes par poste.
// RLS : recruiter_folders et folder_candidates scopes au recruteur proprietaire.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const guard = await getProUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // Le dossier (null si pas le proprietaire, grace a la RLS).
  const { data: folder } = await supabase
    .from("recruiter_folders")
    .select("id, name, created_at")
    .eq("id", id)
    .eq("recruiter_id", guard.user.id)
    .single();

  if (!folder) {
    return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
  }

  const { data: rows, error } = await supabase
    .from("folder_candidates")
    .select(`talent_id, role, added_at, talent:profiles!talent_id(${DISPLAY_NAME_COLUMNS}, slug, avatar_url, location)`)
    .eq("folder_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const groups = new Map<string, unknown[]>();
  for (const r of (rows ?? []) as Record<string, unknown>[]) {
    const talent = Array.isArray(r.talent) ? r.talent[0] : r.talent;
    const candidate = {
      talent_id: r.talent_id,
      role: r.role,
      added_at: r.added_at,
      full_name: displayNameOf(talent as DisplayNameRow | null) ?? "Talent",
      slug: (talent as Record<string, unknown>)?.slug ?? null,
      avatar_url: (talent as Record<string, unknown>)?.avatar_url ?? null,
      location: (talent as Record<string, unknown>)?.location ?? null,
    };
    groups.set(r.role as string, [...(groups.get(r.role as string) ?? []), candidate]);
  }

  const roles = Array.from(groups.entries())
    .map(([role, candidates]) => ({ role, candidates }))
    .sort((a, b) => a.role.localeCompare(b.role));

  return NextResponse.json({ folder, roles });
}
