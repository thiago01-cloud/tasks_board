// Shared by every place that mints or sends a teammate's invite link (see
// POST /api/agents/invite, POST /api/agents/invite/email, and
// GET /api/auth/accept-invite, which verifies what this signs) — kept in
// one place so the token's shape/TTL can't drift between them.
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

// The WhatsApp message text, shared between POST /api/agents/invite (which
// builds the wa.me link right away) and anywhere else that might want the
// exact same wording later.
export function inviteMessage(firstName: string, companyName: string, inviteUrl: string): string {
  return `Bonjour ${firstName}, ${companyName} vous invite à rejoindre TASKS. Cliquez sur ce lien pour vous connecter et choisir votre mot de passe : ${inviteUrl}`;
}
