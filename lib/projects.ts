import { prisma } from "./prisma";

// Mirrors canManageGroup() in app/api/groups/[id]/route.ts: any admin, or
// the manager who created this project, same tier as groups and tasks.
// A project created before `creatorId` existed, or whose creator has
// since left the company, falls back to admin-only.
export function canManageProject(
  agent: { role: string; id: string | null },
  project: { creatorId: string | null }
): boolean {
  return agent.role === "ADMIN" || (agent.role === "MANAGER" && project.creatorId === agent.id);
}

// Shared by POST /api/tasks and PATCH /api/tasks/[id]: a task's
// `projectId` must point at a real project of the SAME company, or be
// cleared entirely — same "silently drop anything else" reasoning as
// validMemberIds/validGroupIds in lib/groups.ts (the caller is a <select>
// the user just submitted, not something worth hard-erroring over).
export async function validProjectId(companyId: string, projectId: unknown): Promise<string | null> {
  if (typeof projectId !== "string" || !projectId) return null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
  return project ? project.id : null;
}

// A project's progress is never stored — always the average of its own
// tasks' `progress` at read time (0 for a project with no tasks yet),
// exactly as Task.progress itself is derived from its subtasks once it
// has any (see Subtask's comment in schema.prisma). Keeps a project's
// number from ever silently drifting out of sync with the tasks under it.
export function computeProjectProgress(tasks: { progress: number }[]): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((sum, t) => sum + t.progress, 0);
  return Math.round(total / tasks.length);
}
