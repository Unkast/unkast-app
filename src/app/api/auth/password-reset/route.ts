import { NextRequest, NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp, isValidEmail } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import { siteUrl } from "@/lib/stripe";

// POST { email } : envoie le lien « mot de passe oublie » (branding Unkast via Resend).
// Anti-spam : 3 demandes / heure par email, 10 par IP.
// Anti-enumeration : meme reponse, que le compte existe ou non. Le lien est cree
// et envoye APRES la reponse (after), pour que le temps de reponse ne trahisse
// pas non plus l'existence d'un compte.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (
    !(await checkRateLimit(`pw-reset:${email.toLowerCase()}`, 3, 3600)) ||
    !(await checkRateLimit(`pw-reset-ip:${ip}`, 10, 3600))
  ) {
    return NextResponse.json({ error: "Trop de demandes. Réessaie dans une heure." }, { status: 429 });
  }

  after(async () => {
    // Aucun email Supabase ne part : generateLink renvoie seulement le jeton.
    // Compte inconnu : erreur silencieuse, rien n'est envoye.
    const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email });
    const hashedToken = data?.properties?.hashed_token;
    if (error || !hashedToken) return;
    const resetUrl = `${siteUrl()}/auth/nouveau-mot-de-passe?token_hash=${encodeURIComponent(hashedToken)}`;
    const res = await sendPasswordResetEmail({ to: email, resetUrl });
    if (!res.sent) console.error(`[password-reset] email non envoyé (${res.reason})`);
  });

  return NextResponse.json({ success: true });
}
