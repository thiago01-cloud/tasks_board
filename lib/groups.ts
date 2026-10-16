import { prisma } from "./prisma";

// Shared by POST /api/groups and PATCH /api/groups/[id]: keeps only the
// ids that are actually staff of this company — silently dropping
// anything else (a stale id, an id from another company) rather than
// erroring, since the caller is a checkbox list the user just submitted.
export async function validMemberIds(companyId: string, memberIds: unknown): Promise<string[]> {
  const ids = Array.isArray(memberIds) ? memberIds.filter((id): id is string => typeof id === "string") : [];
  if (ids.length === 0) return [];
  const agents = await prisma.agent.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true },
  });
  return agents.map((a) => a.id);
}

// Same idea, for the groups a task is being explicitly assigned to (see
// POST /api/tasks and PATCH /api/tasks/[id] — Task.assignedGroups).
export async function validGroupIds(companyId: string, groupIds: unknown): Promise<string[]> {
  const ids = Array.isArray(groupIds) ? groupIds.filter((id): id is string => typeof id === "string") : [];
  if (ids.length === 0) return [];
  const groups = await prisma.group.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true },
  });
  return groups.map((g) => g.id);
}

// Walks `candidateParentId`'s own ancestor chain (parent, grandparent...)
// looking for `groupId` — used to reject a parent pick that would make a
// group its own (in)direct ancestor (e.g. "Ventes" contains "Ventes Nord"
// which you then try to make the parent of "Ventes"). A group also can't
// be its own direct parent, checked by the caller before this even runs.
// Company-scoped and capped at a generous depth so a corrupted/cyclical
// row already in the database (shouldn't happen, but this guards against
// ever compounding that) can't spin forever.
export async function wouldCreateCycle(
  companyId: string,
  groupId: string,
  candidateParentId: string
): Promise<boolean> {
  let currentId: string | null = candidateParentId;
  for (let depth = 0; currentId && depth < 50; depth++) {
    if (currentId === groupId) return true;
    const current = await prisma.group.findUnique({
      where: { id: currentId },
      select: { parentId: true, companyId: true },
    });
    if (!current || current.companyId !== companyId) return false;
    currentId = current.parentId;
  }
  return false;
}

// Appointing a group's "chef" automatically promotes a plain MEMBER to
// MANAGER — per the product decision: a department/service head needs at
// least manager-level standing. Never a demotion: an agent who's already
// MANAGER or ADMIN keeps their role as-is. No-op if `leaderId` is null
// (removing a chef) or the agent record can't be found. Takes `tx` so it
// can run inside the same transaction as the group create/update it's
// called from.
export async function promoteLeaderIfNeeded(
  tx: Pick<typeof prisma, "agent">,
  leaderId: string | null
): Promise<void> {
  if (!leaderId) return;
  const leader = await tx.agent.findUnique({ where: { id: leaderId }, select: { role: true } });
  if (leader && leader.role === "MEMBER") {
    await tx.agent.update({ where: { id: leaderId }, data: { role: "MANAGER" } });
  }
}
