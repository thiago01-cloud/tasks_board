// Shared by every route that returns an Agent (GET/POST /api/agents,
// POST /api/agents/invite): kept out of app/api/agents/route.ts because
// Next.js route files may only export HTTP method handlers (GET, POST,
// ...) and a small fixed set of config values — any other named export
// (flattenAgent, AGENT_INCLUDE) fails the build with "... is not a valid
// Route export field."
export const AGENT_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
} as const;

export function flattenAgent(a: {
  id: string;
  role: string;
  joinedAt: Date;
  userId: string;
  user: { id: string; firstName: string; lastName: string; phone: string; email: string | null };
}) {
  return {
    id: a.id,
    role: a.role,
    joinedAt: a.joinedAt,
    userId: a.userId,
    firstName: a.user.firstName,
    lastName: a.user.lastName,
    phone: a.user.phone,
    email: a.user.email,
  };
}

// Whether `actor` (the signed-in admin/manager) may manage `target` —
// share its login link again (see POST /api/agents/invite/link,
// POST /api/agents/invite/email) or remove it (DELETE /api/agents/[id]).
// Same tier as groups (see canManageGroup() in
// app/api/groups/[id]/route.ts), plus one more exception specific to
// accounts: the company owner's own Agent record is off limits to
// everyone else, admins included — there's no route for the owner to be
// managed this way by someone else, only by themselves (and they'd never
// see the option on their own card anyway, see TeamCard.tsx's own `isMe`
// check).
export function canManageAgent(
  actor: { role: string; id: string | null },
  target: { userId: string; createdByAgentId: string | null },
  ownerId: string
): boolean {
  if (target.userId === ownerId) return false;
  return actor.role === "ADMIN" || (actor.role === "MANAGER" && target.createdByAgentId === actor.id);
}

// Whether `actor` may edit `target`'s account details (name, country,
// phone, email, role) or trigger a password reset for them — see PATCH
// /api/agents/[id]/account and POST /api/agents/[id]/reset-password.
// Broader than canManageAgent() above (which only governs sharing the
// login link again and removing the account): here, the company's OWNER
// (compared by User.id, never by session role — Agent.role itself never
// stores "OWNER", see SessionRole's own comment in lib/auth.ts) may act on
// ANYONE, admins included, while an ADMIN may act on anyone but the owner
// — including other admins. A MANAGER/MEMBER can't manage anyone else's
// account this way at all. And nobody, owner included, manages their OWN
// account through this path — that's always PATCH /api/account /
// PATCH /api/account/password instead (see "Mon compte"), which is also
// the only place role is simply never offered as a field to change.
export function canManageAccount(
  actor: { userId: string; ownerId: string; role: string },
  target: { userId: string }
): boolean {
  if (target.userId === actor.userId) return false;
  const actorIsOwner = actor.userId === actor.ownerId;
  if (target.userId === actor.ownerId) return actorIsOwner;
  return actorIsOwner || actor.role === "ADMIN";
}
