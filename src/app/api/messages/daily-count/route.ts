import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  countConversationsInitiatedToday,
  countPeopleContacted,
  DAILY_CONVERSATION_LIMIT,
  FREE_CONTACT_LIMIT,
} from "@/lib/messaging";

// Alimente le bandeau compteur de /messages. Deux quotas, un seul aller-retour :
//   - Pro  : `count` / `limit` = nouvelles conversations sur 24h glissantes
//   - Free : `contacts_used` / `contacts_limit` = personnes contactées à vie
// `contacts_used` reste null pour un Pro (contacts illimités) : inutile de
// payer le comptage.
//
// Route d'AFFICHAGE uniquement. Les gardes qui font foi sont dans
// POST /api/messages (premier message) et POST /api/messages/conversation.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  const isPro = profile?.plan === "pro";

  const { count: daily } = await countConversationsInitiatedToday(admin, user.id);

  let contactsUsed: number | null = null;
  if (!isPro) {
    const { count } = await countPeopleContacted(admin, user.id);
    contactsUsed = count;
  }

  // Un comptage en échec renvoie null : le bandeau s'efface plutôt que
  // d'afficher un chiffre faux. Aucun risque de contournement, cette route
  // n'autorise rien.
  return NextResponse.json({
    count: daily,
    limit: DAILY_CONVERSATION_LIMIT,
    plan: isPro ? "pro" : "free",
    contacts_used: contactsUsed,
    contacts_limit: FREE_CONTACT_LIMIT,
  });
}
