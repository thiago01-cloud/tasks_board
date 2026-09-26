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
