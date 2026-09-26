// Thin wrapper around Resend (https://resend.com) for the one transactional
// email this app sends: a teammate's magic login link (see
// POST /api/agents/invite, POST /api/agents/invite/email, and
// app/api/auth/accept-invite/route.ts).
//
// Needs `RESEND_API_KEY` (Resend dashboard → API Keys) in the environment
// — see .env.example. Without it, sending is skipped and the invite link
// is logged instead (and handed back to the admin in the API response —
// see POST /api/agents/invite) so account creation never gets blocked on
// email being configured yet.
//
// Requires the `resend` package: run `npm install resend` once (see
// package.json — deliberately not committed here since this environment
// can't run npm install itself to verify the exact version).
import { Resend } from "resend";
import { formatDateTime } from "./dates";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Resend's own test sender: delivers to any real recipient with no setup,
// but shows as "onboarding@resend.dev" — switch RESEND_FROM_EMAIL once a
// sending domain is verified in Resend (Domains tab) for a proper
// "TASKS <no-reply@votredomaine.com>" from-address.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "TASKS <onboarding@resend.dev>";

export async function sendInviteEmail({
  to,
  firstName,
  companyName,
  inviteUrl,
  alreadyActive,
}: {
  to: string;
  firstName: string;
  companyName: string;
  inviteUrl: string;
  // See lib/invite.ts's inviteMessage() — same reasoning: this account may
  // already have a password, so the email shouldn't tell it to "choose"
  // one again.
  alreadyActive: boolean;
}): Promise<boolean> {
  if (!resend) {
    console.warn(
      `RESEND_API_KEY absent — email de connexion non envoyé à ${to}. Lien à partager manuellement : ${inviteUrl}`
    );
    return false;
  }

  const subject = alreadyActive
    ? `Votre lien de connexion à TASKS (${companyName})`
    : `${companyName} vous invite à rejoindre TASKS`;

  const intro = alreadyActive
    ? `<p>Voici votre lien de connexion à l&apos;espace TASKS de <strong>${companyName}</strong> :</p>`
    : `<p><strong>${companyName}</strong> vous a ajouté(e) comme membre de son espace TASKS.</p>
       <p>Cliquez sur le lien ci-dessous pour accéder à la plateforme et choisir votre mot de passe :</p>`;
  const buttonLabel = alreadyActive ? "Se connecter" : "Rejoindre TASKS";

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
          <p>Bonjour ${firstName},</p>
          ${intro}
          <p style="margin: 24px 0;">
            <a href="${inviteUrl}" style="background: #2a3365; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              ${buttonLabel}
            </a>
          </p>
          <p style="font-size: 13px; color: #666;">
            Ce lien est valable 7 jours. Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />
            <a href="${inviteUrl}">${inviteUrl}</a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend a refusé l'envoi:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Échec de l'envoi de l'email d'invitation:", err);
    return false;
  }
}

// The other transactional email this app sends: a "temps imparti à moitié/
// deux tiers écoulé" alert for a task, from the cron job in
// app/api/cron/task-alerts/route.ts. Same wrapper/fallback pattern as
// sendInviteEmail above — if Resend isn't configured, sending is skipped
// (the in-app notification, created separately by the caller, still goes
// through either way).
export async function sendTaskAlertEmail({
  to,
  firstName,
  taskTitle,
  taskUrl,
  thresholdLabel,
  dueDateIso,
}: {
  to: string;
  firstName: string;
  taskTitle: string;
  taskUrl: string;
  // "la moitié" | "les deux tiers" — dropped straight into the sentence
  // below, see the two THRESHOLDS entries in the cron route.
  thresholdLabel: string;
  dueDateIso: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn(`RESEND_API_KEY absent — alerte de délai non envoyée à ${to} pour "${taskTitle}".`);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `⏱ ${taskTitle} — ${thresholdLabel} du délai est écoulée`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
          <p>Bonjour ${firstName},</p>
          <p><strong>${thresholdLabel}</strong> du temps imparti pour la tâche <strong>${taskTitle}</strong> est déjà écoulée.</p>
          <p style="font-size: 13px; color: #666;">Échéance : ${formatDateTime(dueDateIso)}</p>
          <p style="margin: 24px 0;">
            <a href="${taskUrl}" style="background: #2a3365; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Voir la tâche
            </a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend a refusé l'envoi (alerte de délai):", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Échec de l'envoi de l'alerte de délai:", err);
    return false;
  }
}
