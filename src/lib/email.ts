import { Resend } from "resend";
import { siteUrl } from "@/lib/stripe";

// Client email SERVEUR uniquement (clé via env, JAMAIS dans le code versionné).
// Singleton paresseux, même esprit que lib/stripe.ts : on n'instancie qu'au
// premier envoi, et on ne fait JAMAIS planter le build/l'app si la clé manque.
//
// Mode dev / test : sans RESEND_API_KEY, sendInvitationEmail NE throw PAS — il
// renvoie { sent: false, reason: 'no_api_key' }. L'invitation est quand même
// enregistrée en base (le ghost credit existe), seul l'email est sauté.
//
// Envoi UNIQUEMENT via Resend (service tiers) — jamais de SMTP maison — pour
// protéger la délivrabilité et la réputation d'expéditeur.

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

// Adresse expéditeur (domaine vérifié côté Resend). Fallback no-reply générique.
function fromAddress(): string {
  return process.env.INVITE_FROM_EMAIL || "Unkast <invitations@unkast.com>";
}

export interface SendInvitationParams {
  to: string;
  inviterName: string;
  role: string;
  projectTitle: string;
  token: string;
}

export type SendResult =
  | { sent: true }
  | { sent: false; reason: "no_api_key" | "error" };

export async function sendInvitationEmail(
  params: SendInvitationParams
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    // Pas de clé (dev/test) : on saute proprement l'envoi.
    return { sent: false, reason: "no_api_key" };
  }

  const { to, inviterName, role, projectTitle, token } = params;
  const claimUrl = `${siteUrl()}/rejoindre?invitation=${encodeURIComponent(token)}`;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to,
      subject: `${inviterName} t'a crédité·e sur Unkast`,
      html: invitationHtml({ inviterName, role, projectTitle, claimUrl }),
      text: invitationText({ inviterName, role, projectTitle, claimUrl }),
    });
    return { sent: true };
  } catch {
    // On n'expose jamais l'erreur Resend brute ; l'appelant décide quoi en faire.
    return { sent: false, reason: "error" };
  }
}

// --- Gabarits email (charte : fond #0d0d0d, lime #C8FF00, DM Sans) ------------

function invitationText(p: {
  inviterName: string;
  role: string;
  projectTitle: string;
  claimUrl: string;
}): string {
  return [
    `${p.inviterName} t'a crédité·e comme ${p.role} sur le film « ${p.projectTitle} » sur Unkast.`,
    ``,
    `Rejoins Unkast pour revendiquer ce crédit :`,
    p.claimUrl,
    ``,
    `Si tu ne connais pas cette personne, ignore simplement cet email.`,
    ``,
    `— Unkast`,
  ].join("\n");
}

function invitationHtml(p: {
  inviterName: string;
  role: string;
  projectTitle: string;
  claimUrl: string;
}): string {
  // HTML inline volontairement minimal (compatibilité clients mail).
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#0d0d0d;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <div style="font-weight:700;font-size:20px;letter-spacing:-0.5px;color:#C8FF00;">Unkast</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0 32px;">
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#f0f0f0;">Tu as été crédité·e sur Unkast</h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#aaa;">
                  <strong style="color:#f0f0f0;">${escapeHtml(p.inviterName)}</strong> t'a crédité·e comme
                  <strong style="color:#f0f0f0;">${escapeHtml(p.role)}</strong> sur le film
                  «&nbsp;<strong style="color:#f0f0f0;">${escapeHtml(p.projectTitle)}</strong>&nbsp;».
                </p>
                <a href="${p.claimUrl}" style="display:inline-block;background:#C8FF00;color:#0d0d0d;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;padding:14px 28px;">
                  Revendiquer mon crédit
                </a>
                <p style="margin:24px 0 0 0;font-size:12px;line-height:1.6;color:#666;">
                  Si tu ne connais pas cette personne, ignore simplement cet email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px 32px;">
                <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;font-size:11px;color:#555;">
                  Unkast — la plateforme des professionnels du cinéma et de l'audiovisuel.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
