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
    // Explicit annotation (not just inferred from the call) — without it,
    // TS flags this as an implicit `any`: `current` feeds `currentId` at
    // the end of the loop body, which this same call then reads back at
    // the top of the next iteration, and the compiler won't resolve a
    // type through that loop-carried cycle on its own (TS7022).
    const current: { parentId: string | null; companyId: string } | null = await prisma.group.findUnique({
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

// "Un manager est toujours rattaché à un groupe. On ne peut pas avoir de
// manager sans groupe, sinon il manage quoi? S'il y a des managers sans
// groupe, alors on le remet à l'état de membre." — the flip side of
// promoteLeaderIfNeeded() above: being made a group's chef can only ever
// promote (MEMBER -> MANAGER), so this is what keeps the other direction
// honest. Call it, inside the same transaction, right after ANY change
// that could leave an agent belonging to zero groups — removing them from
// a group's member list, deleting a group outright, or setting their role
// to MANAGER directly from "Modifier le compte" — and it quietly corrects
// MANAGER back down to MEMBER only when that agent now has no group left
// to manage. No-op otherwise (still has a group, or isn't a MANAGER to
// begin with). Never touches ADMIN.
export async function demoteGrouplessManager(
  tx: Pick<typeof prisma, "agent">,
  agentId: string
): Promise<void> {
  const agent = await tx.agent.findUnique({
    where: { id: agentId },
    select: { role: true, groups: { select: { id: true }, take: 1 } },
  });
  if (agent && agent.role === "MANAGER" && agent.groups.length === 0) {
    await tx.agent.update({ where: { id: agentId }, data: { role: "MEMBER" } });
  }
}
