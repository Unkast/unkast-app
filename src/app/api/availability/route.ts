import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveUser } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBody, invalidBodyResponse } from "@/lib/api";

// Recrutement — signaux de disponibilite (cote talent).
// Un talent (ou creator non-recruteur) se signale "Disponible" pour un poste
// precis chez un recruteur qui affiche "Je recrute".
//
// Le garde-fou metier est double : verification serveur ci-dessous (erreurs
// propres) + RLS au niveau base (vrai backstop). Le client est scope utilisateur
// (createClient) donc toutes les ecritures passent par la RLS.

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function expiryFromNow(): string {
  return new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
}

// Verifie que la cible accepte bien ce signal : recruteur Pro qui recrute ce
// poste. Renvoie un message d'erreur (string) si invalide, null si OK.
// (plan n'est PAS expose au navigateur, mais la route serveur peut le lire.)
async function validateTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recruiterId: string,
  role: string
): Promise<string | null> {
  const { data: recruiter } = await supabase
    .from("profiles")
    .select("is_recruiting, plan, recruiting_roles")
    .eq("id", recruiterId)
    .single();

  if (!recruiter) return "Recruteur introuvable.";
  if (!recruiter.is_recruiting || recruiter.plan !== "pro") {
    return "Ce profil ne recrute pas actuellement.";
  }
  if (!Array.isArray(recruiter.recruiting_roles) || !recruiter.recruiting_roles.includes(role)) {
    return "Ce recruteur ne propose pas ce poste.";
  }
  return null;
}

// GET ?recruiter=<id> : signaux ACTIFS du visiteur vers ce recruteur.
// Non connecte -> { signals: [] } (l'UI gere l'invite a se connecter).
export async function GET(request: NextRequest) {
  const recruiterId = request.nextUrl.searchParams.get("recruiter");
  if (!recruiterId) {
    return NextResponse.json({ error: "Parametre 'recruiter' requis." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ signals: [] });
  }

  const { data, error } = await supabase
    .from("availability_signals")
    .select("role, expires_at")
    .eq("talent_id", user.id)
    .eq("recruiter_id", recruiterId)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ signals: data ?? [] });
}

// POST { recruiter_id, role } : creer (ou re-activer) un signal.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  // Anti-spam : 30 signaux / heure / utilisateur (fail-open).
  if (!(await checkRateLimit(`availability:${user.id}`, 30, 3600))) {
    return NextResponse.json({ error: "Trop de signalements de disponibilité. Réessaie plus tard." }, { status: 429 });
  }

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { recruiter_id, role } = body;
  if (!recruiter_id || !role) {
    return NextResponse.json({ error: "recruiter_id et role requis." }, { status: 400 });
  }
  if (recruiter_id === user.id) {
    return NextResponse.json({ error: "Tu ne peux pas te signaler aupres de toi-meme." }, { status: 400 });
  }

  const invalid = await validateTarget(supabase, recruiter_id, role);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 403 });
  }

  // Upsert : gere la creation ET la re-activation d'un signal expire (qu'on
  // conserve). Sur conflit (talent_id, recruiter_id, role) on remet created_at
  // et expires_at a neuf.
  const expires_at = expiryFromNow();
  const { data, error } = await supabase
    .from("availability_signals")
    .upsert(
      { talent_id: user.id, recruiter_id, role, created_at: new Date().toISOString(), expires_at },
      { onConflict: "talent_id,recruiter_id,role" }
    )
    .select("role, expires_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ signal: data });
}

// PATCH { recruiter_id, role } : prolonger un signal (expires_at = now + 30j).
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { recruiter_id, role } = body;
  if (!recruiter_id || !role) {
    return NextResponse.json({ error: "recruiter_id et role requis." }, { status: 400 });
  }

  const expires_at = expiryFromNow();
  const { data, error } = await supabase
    .from("availability_signals")
    .update({ expires_at })
    .eq("talent_id", user.id)
    .eq("recruiter_id", recruiter_id)
    .eq("role", role)
    .select("role, expires_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ signal: data });
}

// DELETE { recruiter_id, role } : retirer un signal.
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const guard = await getActiveUser(supabase);
  if (!guard.user) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const user = guard.user;

  const body = await readJsonBody(request);
  if (!body) return invalidBodyResponse();
  const { recruiter_id, role } = body;
  if (!recruiter_id || !role) {
    return NextResponse.json({ error: "recruiter_id et role requis." }, { status: 400 });
  }

  const { error } = await supabase
    .from("availability_signals")
    .delete()
    .eq("talent_id", user.id)
    .eq("recruiter_id", recruiter_id)
    .eq("role", role);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
