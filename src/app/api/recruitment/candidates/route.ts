import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProUser } from "../guard";

// GET : candidatures recues par le recruteur, groupees par poste.
// = availability_signals (recruiter_id=moi, non expires) MINUS recruiter_dismissals,
// enrichies du profil talent, avec l'appartenance aux dossiers (pour l'UI "Ranger").
export async function GET() {
  const supabase = await createClient();
  const guard = await getProUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const me = guard.user.id;

  // 1. Signaux actifs vers moi + profil talent (disambiguation FK par colonne).
  const { data: signals, error } = await supabase
    .from("availability_signals")
    .select("talent_id, role, created_at, expires_at, talent:profiles!talent_id(full_name, slug, avatar_url, location)")
    .eq("recruiter_id", me)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2. Ecartements (par poste) -> set "talent_id|role".
  const { data: dismissals } = await supabase
    .from("recruiter_dismissals")
    .select("talent_id, role")
    .eq("recruiter_id", me);
  const dismissed = new Set((dismissals ?? []).map((d) => `${d.talent_id}|${d.role}`));

  // 3. Appartenance aux dossiers (RLS scope aux dossiers du recruteur).
  const { data: placements } = await supabase
    .from("folder_candidates")
    .select("folder_id, talent_id, role");
  const folderMap = new Map<string, string[]>(); // "talent_id|role" -> [folder_id]
  for (const p of placements ?? []) {
    const key = `${p.talent_id}|${p.role}`;
    folderMap.set(key, [...(folderMap.get(key) ?? []), p.folder_id]);
  }

  // 4. Filtre + groupage par poste.
  const groups = new Map<string, unknown[]>();
  for (const s of (signals ?? []) as Record<string, unknown>[]) {
    const key = `${s.talent_id}|${s.role}`;
    if (dismissed.has(key)) continue;
    const talent = Array.isArray(s.talent) ? s.talent[0] : s.talent;
    const candidate = {
      talent_id: s.talent_id,
      role: s.role,
      expires_at: s.expires_at,
      created_at: s.created_at,
      full_name: (talent as Record<string, unknown>)?.full_name ?? "Talent",
      slug: (talent as Record<string, unknown>)?.slug ?? null,
      avatar_url: (talent as Record<string, unknown>)?.avatar_url ?? null,
      location: (talent as Record<string, unknown>)?.location ?? null,
      folders: folderMap.get(key) ?? [],
    };
    groups.set(s.role as string, [...(groups.get(s.role as string) ?? []), candidate]);
  }

  const roles = Array.from(groups.entries())
    .map(([role, candidates]) => ({ role, candidates }))
    .sort((a, b) => a.role.localeCompare(b.role));

  return NextResponse.json({ roles });
}
