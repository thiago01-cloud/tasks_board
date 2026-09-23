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
