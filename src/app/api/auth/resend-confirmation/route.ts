import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp, isValidEmail } from "@/lib/rate-limit";
import { sendConfirmationEmail } from "@/lib/email";
import { siteUrl } from "@/lib/stripe";

// POST { email } : renvoie l'email de confirmation (branding Unkast via Resend).
// Anti-spam : 3 renvois / heure, par email ET par IP.
// Anti-énumération : on renvoie TOUJOURS un succès générique, qu'un compte
// existe (non confirmé) ou non — on ne révèle jamais l'existence d'une adresse.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const emailKey = email.toLowerCase();
  if (
    !(await checkRateLimit(`resend-confirm:${emailKey}`, 3, 3600)) ||
    !(await checkRateLimit(`resend-confirm-ip:${ip}`, 10, 3600))
  ) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessaie dans une heure." },
      { status: 429 }
    );
  }

  const admin = createAdminClient();

  // Pour un compte EXISTANT non confirmé, on régénère un lien via 'magiclink'
  // (pas de mot de passe requis, contrairement à 'signup'). À la vérification,
  // GoTrue confirme l'email ET ouvre la session. Aucun email Supabase n'est
  // envoyé : on l'envoie via Resend. Échoue silencieusement si le compte n'existe
  // pas / est déjà confirmé -> réponse générique quoi qu'il arrive.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${siteUrl()}/auth/confirm` },
  });

  const hashedToken = data?.properties?.hashed_token;
  if (!error && hashedToken) {
    const confirmUrl = `${siteUrl()}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=email`;
    await sendConfirmationEmail({ to: email, confirmUrl });
  }

  // Réponse générique (anti-énumération).
  return NextResponse.json({ success: true });
}
