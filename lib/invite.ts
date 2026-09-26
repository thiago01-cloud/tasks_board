// Shared by every place that mints or sends a teammate's magic login link
// (see POST /api/agents/invite, POST /api/agents/invite/link,
// POST /api/agents/invite/email, and GET /api/auth/accept-invite, which
// verifies what this signs) — kept in one place so the token's shape/TTL
// can't drift between them.
//
// Same token and link for two different moments: right after
// POST /api/agents/invite creates a brand new account (nobody has a
// password yet), and any later time an admin/manager hits "Partager le
// lien de connexion" on a team card — including for a member who has long
// since set their own password (see TeamCard.tsx; the button is available
// there for everyone, not just accounts still mid-onboarding, as a standing
// "help them back in" shortcut). GET /api/auth/accept-invite logs the link
// in either way and only routes it to app/set-password when it actually
// still needs one.
import { signToken } from "./token";

const INVITE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function buildInviteUrl(userId: string, origin: string): Promise<string> {
  const token = await signToken(
    { userId, purpose: "invite" },
    process.env.JWT_SECRET as string,
    INVITE_TOKEN_TTL_SECONDS
  );
  return `${origin}/api/auth/accept-invite?token=${encodeURIComponent(token)}`;
}

// The WhatsApp/email message text — wording depends on whether this
// account has already set its own password (`alreadyActive`), since
// "choose your password" would be misleading for someone who already has
// one; they just get logged straight in instead.
export function inviteMessage(
  firstName: string,
  companyName: string,
  inviteUrl: string,
  alreadyActive: boolean
): string {
  return alreadyActive
    ? `Bonjour ${firstName}, voici votre lien de connexion à TASKS (${companyName}) : ${inviteUrl}`
    : `Bonjour ${firstName}, ${companyName} vous invite à rejoindre TASKS. Cliquez sur ce lien pour vous connecter et choisir votre mot de passe : ${inviteUrl}`;
}
