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
