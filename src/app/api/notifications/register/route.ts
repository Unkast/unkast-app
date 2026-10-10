import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth-guard";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// POST: register or refresh a push token for the authenticated user
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // Garde commun : authentifie + bloque les comptes suspendus (chantier 3).
  // Un compte suspendu ne doit plus recevoir de push. L'appelant
  // (usePushNotifications) n'inspecte pas la reponse : echec silencieux.
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { token, platform } = body;

  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Token requis." }, { status: 400 });
  }

  // Un appareil n'est lie qu'a un seul compte : le jeton est detache de tout autre
  // compte (deconnexion ratee, session expiree). Service role : la RLS ne laisse voir
  // que ses propres jetons. Jamais bloquant.
  const { error: detachError } = await createAdminClient()
    .from("push_tokens")
    .delete()
    .eq("token", token)
    .neq("profile_id", user.id);
  if (detachError) console.error("[notifications] detachement du jeton impossible :", detachError);

  // Upsert: if this token already exists for this user, do nothing
  const { error } = await supabase.from("push_tokens").upsert(
    {
      profile_id: user.id,
      token,
      platform: platform || "android",
    },
    { onConflict: "profile_id,token" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE { token } : l'appareil ne recoit plus les notifications de ce compte.
// Appelee a la deconnexion. Session simple (pas getActiveUser) : un compte suspendu
// doit lui aussi pouvoir detacher son appareil. La RLS limite la suppression aux
// jetons du compte.
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifie." }, { status: 401 });

  const body = await readJsonBody(request);
  if (!body || typeof body.token !== "string" || !body.token) return invalidBodyResponse();

  const { error } = await supabase.from("push_tokens").delete().eq("profile_id", user.id).eq("token", body.token);
  if (error) {
    console.error("[notifications] retrait du jeton impossible :", error);
    return NextResponse.json({ error: "Retrait impossible." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
