import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isUuid } from "@/lib/messaging";
import { VIEW_COOKIE, VIEW_VISITOR } from "@/lib/adminSession";
import { isAdminAccount, isBot, memberVisitorKey, recordProfileEvent } from "@/lib/profile-stats";

// POST { profile_id } : compte une visite de profil (statistiques, plan Pro etape 2).
// Appelee une fois par le navigateur au montage de la fiche (ProfileClient).
//
// Repond TOUJOURS 204, sans corps, quoi qu'il arrive (refus, doublon, panne) :
// rien a afficher, rien a exploiter. Ne compte pas : robots, sa propre fiche,
// le compte admin (et sa vue « visiteur »), au-dela de la limite de debit.
// Une visite par visiteur, par profil et par jour : dedoublonnage en base.

const done = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get("user-agent");
    if (isBot(userAgent)) return done();
    if (request.cookies.get(VIEW_COOKIE)?.value === VIEW_VISITOR) return done();

    const body = await request.json().catch(() => null);
    const profileId = body?.profile_id;
    if (!isUuid(profileId)) return done();

    const ip = getClientIp(request);
    if (!(await checkRateLimit(`stats-view:${ip}`, 60, 60))) return done();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id === profileId) return done();

    after(async () => {
      if (user && (await isAdminAccount(user.id))) return;
      const visitorKey = user ? memberVisitorKey(user.id) : `a:${ip}|${userAgent}`;
      await recordProfileEvent(profileId, "view", visitorKey);
    });
  } catch (err) {
    console.warn("[stats/view] visite ignorée :", err);
  }
  return done();
}
