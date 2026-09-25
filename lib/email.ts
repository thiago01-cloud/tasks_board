// Thin wrapper around Resend (https://resend.com) for the one transactional
// email this app sends: a teammate's invite link (see
// POST /api/agents/invite and app/api/auth/accept-invite/route.ts).
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
}: {
  to: string;
  firstName: string;
  companyName: string;
  inviteUrl: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn(
      `RESEND_API_KEY absent — email d'invitation non envoyé à ${to}. Lien à partager manuellement : ${inviteUrl}`
    );
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${companyName} vous invite à rejoindre TASKS`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
          <p>Bonjour ${firstName},</p>
          <p><strong>${companyName}</strong> vous a ajouté(e) comme membre de son espace TASKS.</p>
          <p>Cliquez sur le lien ci-dessous pour accéder à la plateforme et choisir votre mot de passe :</p>
          <p style="margin: 24px 0;">
            <a href="${inviteUrl}" style="background: #2a3365; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Rejoindre TASKS
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
