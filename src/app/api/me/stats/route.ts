import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";

// GET /api/me/stats : statistiques de SON profil (plan Pro, etape 2).
// Pro : chiffres agreges (jamais l'identite d'un visiteur).
// Gratuit : { locked: true } et AUCUN chiffre (l'apercu de /moi montre des faux).
// Tables reservees au service role (20261102_profile_stats.sql) : lecture scopee
// sur l'id de la session.

type DailyRow = { day: string; views: number; list_adds: number; message_clicks: number };

/** Date du jour (heure de Paris) decalee de `offset` jours, en YYYY-MM-DD. */
function parisDay(offset = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) return NextResponse.json({ error: guard.error }, { status: guard.status });

  if (guard.profile.plan !== "pro") return NextResponse.json({ locked: true });

  const { data, error } = await createAdminClient()
    .from("profile_stats_daily")
    .select("day, views, list_adds, message_clicks")
    .eq("profile_id", guard.user.id);
  if (error) {
    console.error("[me/stats] lecture des statistiques échouée :", error.code ?? error.message);
    return NextResponse.json({ error: "Statistiques indisponibles." }, { status: 503 });
  }

  // Fenetres glissantes : aujourd'hui compris (7 j = aujourd'hui et les 6 jours d'avant).
  const from7 = parisDay(-6);
  const from30 = parisDay(-29);
  const stats = { views_7d: 0, views_30d: 0, views_total: 0, list_adds_total: 0, message_clicks_total: 0 };
  for (const row of (data ?? []) as DailyRow[]) {
    stats.views_total += row.views;
    stats.list_adds_total += row.list_adds;
    stats.message_clicks_total += row.message_clicks;
    if (row.day >= from30) stats.views_30d += row.views;
    if (row.day >= from7) stats.views_7d += row.views;
  }

  return NextResponse.json({ locked: false, ...stats });
}
