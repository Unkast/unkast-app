import "server-only";
import { Resend } from "resend";
import { siteUrl } from "@/lib/stripe";
import { MAX_PROJECTS_FREE } from "@/lib/constants";

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

// Expéditeur des emails d'authentification (confirmation de compte).
function authFromAddress(): string {
  return process.env.AUTH_FROM_EMAIL || "Unkast <noreply@mail.unkast.com>";
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

// --- Email de confirmation de compte (chantier confirmation email) -----------

export interface SendConfirmationParams {
  to: string;
  confirmUrl: string;
}

export async function sendConfirmationEmail(
  params: SendConfirmationParams
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    // Pas de clé (dev/test) : on saute proprement l'envoi.
    return { sent: false, reason: "no_api_key" };
  }

  try {
    await resend.emails.send({
      from: authFromAddress(),
      to: params.to,
      subject: "Confirme ton compte Unkast",
      html: confirmationHtml(params.confirmUrl),
      text: confirmationText(params.confirmUrl),
    });
    return { sent: true };
  } catch {
    return { sent: false, reason: "error" };
  }
}

// --- Email de rappel J-7 avant expiration d'un Pro offert (chantier grants,
// cron /api/cron/pro-expiry, commit 5) ------------------------------------

export interface SendProExpiryReminderParams {
  to: string;
  fullName: string;
  expiresAt: string; // ISO
}

export async function sendProExpiryReminderEmail(
  params: SendProExpiryReminderParams
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    // Pas de clé (dev/test, ou pas encore branchée en prod) : on saute
    // proprement l'envoi. Le cron NE DOIT PAS marquer pro_grant_reminder_sent_at
    // sur ce résultat — voir app/api/cron/pro-expiry/route.ts.
    return { sent: false, reason: "no_api_key" };
  }

  const { to, fullName, expiresAt } = params;
  const dateLabel = new Date(expiresAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  try {
    await resend.emails.send({
      from: authFromAddress(),
      to,
      subject: "Ton Pro Unkast expire bientôt",
      html: proExpiryReminderHtml({ fullName, dateLabel }),
      text: proExpiryReminderText({ fullName, dateLabel }),
    });
    return { sent: true };
  } catch {
    return { sent: false, reason: "error" };
  }
}

function proExpiryReminderText(p: { fullName: string; dateLabel: string }): string {
  return [
    `Bonjour ${p.fullName},`,
    ``,
    `Ton accès Pro à Unkast expire le ${p.dateLabel}.`,
    ``,
    `Après cette date, ton compte repassera en version gratuite (messagerie et`,
    `visibilité Pro désactivées, publications limitées à ${MAX_PROJECTS_FREE} films).`,
    ``,
    `— Unkast`,
  ].join("\n");
}

function proExpiryReminderHtml(p: { fullName: string; dateLabel: string }): string {
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
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#f0f0f0;">Ton Pro expire bientôt</h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#aaa;">
                  Bonjour <strong style="color:#f0f0f0;">${escapeHtml(p.fullName)}</strong>, ton accès Pro à Unkast
                  expire le <strong style="color:#f0f0f0;">${escapeHtml(p.dateLabel)}</strong>. Après cette date, ton
                  compte repassera en version gratuite (messagerie et visibilité Pro désactivées, publications
                  limitées à ${MAX_PROJECTS_FREE} films).
                </p>
                <p style="margin:24px 0 0 0;font-size:12px;line-height:1.6;color:#666;">
                  Des questions ? Réponds simplement à cet email.
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

function confirmationText(confirmUrl: string): string {
  return [
    `Bienvenue sur Unkast !`,
    ``,
    `Confirme ton adresse email pour activer ton compte :`,
    confirmUrl,
    ``,
    `Ce lien expire dans 24 heures. Si tu n'es pas à l'origine de cette inscription, ignore simplement cet email.`,
    ``,
    `— Unkast`,
  ].join("\n");
}

function confirmationHtml(confirmUrl: string): string {
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
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#f0f0f0;">Bienvenue sur Unkast</h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#aaa;">
                  Plus qu'une étape : confirme ton adresse email pour activer ton compte et accéder à la plateforme.
                </p>
                <a href="${confirmUrl}" style="display:inline-block;background:#C8FF00;color:#0d0d0d;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;padding:14px 28px;">
                  Activer mon compte
                </a>
                <p style="margin:24px 0 0 0;font-size:12px;line-height:1.6;color:#666;">
                  Ce lien expire dans 24 heures. Si tu n'es pas à l'origine de cette inscription, ignore simplement cet email.
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

// --- Gestion des films : refus d'un film, alerte admin ------------------------

// Gabarit commun des deux emails ci-dessous (meme habillage que les autres).
function plainHtml(title: string, bodyHtml: string): string {
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
              <td style="padding:8px 32px 32px 32px;font-size:15px;line-height:1.6;color:#aaa;">
                <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#f0f0f0;">${escapeHtml(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface SendFilmRefusedParams {
  to: string;
  name: string;         // nom d'affichage du Responsable
  projectTitle: string;
  reasons: string[];    // phrases deja redigees (refusalMessages)
  note: string | null;  // texte libre de l'admin
}

// Refus d'un film : au Responsable seul. Texte valide par Maxime (08/10/2026).
export async function sendFilmRefusedEmail(p: SendFilmRefusedParams): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { sent: false, reason: "no_api_key" };

  const intro = `Merci d'avoir proposé « ${p.projectTitle} » sur Unkast. Nous l'avons regardé avec attention et nous ne pouvons pas le mettre en ligne pour le moment.`;
  const outro = "Tu peux proposer une nouvelle version ou un autre film quand tu veux, et ce refus ne compte pas dans ta limite de films.";
  const text = [
    `Bonjour ${p.name},`,
    "",
    intro,
    ...(p.reasons.length ? ["", "Ce qui nous a retenus :", ...p.reasons.map((r) => `- ${r}`)] : []),
    ...(p.note ? ["", p.note] : []),
    "",
    outro,
    "",
    "À bientôt,",
    "L'équipe Unkast",
  ].join("\n");
  const html = plainHtml(
    "Ton film n'a pas été retenu pour l'instant",
    [
      `<p style="margin:0 0 16px 0;">Bonjour <strong style="color:#f0f0f0;">${escapeHtml(p.name)}</strong>,</p>`,
      `<p style="margin:0 0 16px 0;">${escapeHtml(intro)}</p>`,
      p.reasons.length
        ? `<p style="margin:0 0 8px 0;color:#f0f0f0;">Ce qui nous a retenus :</p><ul style="margin:0 0 16px 0;padding-left:20px;">${p.reasons.map((r) => `<li style="margin:0 0 6px 0;">${escapeHtml(r)}</li>`).join("")}</ul>`
        : "",
      p.note ? `<p style="margin:0 0 16px 0;white-space:pre-wrap;">${escapeHtml(p.note)}</p>` : "",
      `<p style="margin:0 0 16px 0;">${escapeHtml(outro)}</p>`,
      `<p style="margin:0;">À bientôt,<br>L'équipe Unkast</p>`,
    ].join("")
  );

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: p.to,
      subject: `Ton film « ${p.projectTitle} » n'a pas été retenu pour l'instant`,
      html,
      text,
    });
    return { sent: true };
  } catch {
    return { sent: false, reason: "error" };
  }
}

export interface SendAdminNewFilmParams {
  projectTitle: string;
  ownerName: string;
  sourceTitle: string | null;
  sourceAuthor: string | null;
}

// Alerte admin : un film vient d'etre publie et attend sa validation.
// Destinataire : ADMIN_ALERT_EMAIL. Absente, aucun email ne part. Ne bloque
// jamais la publication : l'appelant ignore le resultat.
export async function sendAdminNewFilmEmail(p: SendAdminNewFilmParams): Promise<SendResult> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  const resend = getResend();
  if (!to || !resend) return { sent: false, reason: "no_api_key" };

  const url = `${siteUrl()}/admin?tab=films`;
  const origin = [p.sourceTitle, p.sourceAuthor].filter(Boolean).join(" · ");
  const text = [
    `Nouveau film en attente : « ${p.projectTitle} »`,
    `Publié par ${p.ownerName}`,
    ...(origin ? [`Vidéo d'origine : ${origin}`] : []),
    "",
    `Valider : ${url}`,
  ].join("\n");
  const html = plainHtml(
    "Nouveau film en attente",
    [
      `<p style="margin:0 0 8px 0;color:#f0f0f0;font-size:17px;">« ${escapeHtml(p.projectTitle)} »</p>`,
      `<p style="margin:0 0 8px 0;">Publié par ${escapeHtml(p.ownerName)}</p>`,
      origin ? `<p style="margin:0 0 8px 0;">Vidéo d'origine : ${escapeHtml(origin)}</p>` : "",
      `<p style="margin:24px 0 0 0;"><a href="${url}" style="display:inline-block;background:#C8FF00;color:#0d0d0d;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px;">Ouvrir les films à valider</a></p>`,
    ].join("")
  );

  try {
    await resend.emails.send({
      from: fromAddress(),
      to,
      subject: `Film à valider : « ${p.projectTitle} »`,
      html,
      text,
    });
    return { sent: true };
  } catch {
    return { sent: false, reason: "error" };
  }
}
