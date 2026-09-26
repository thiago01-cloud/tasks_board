import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAgent, canValidateTask } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageTitle } from "@/lib/constants";
import TaskDetail from "./TaskDetail";

export const metadata = {
  title: pageTitle("Détail de la tâche"),
};

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const agent = await getCurrentAgent();
  // Rare case: valid session cookie, but the agent/company/user it points
  // at was deleted in the meantime — see dashboard/layout.tsx's own guard.
  if (!agent) redirect("/login");
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      creator: { include: { user: { select: { firstName: true, lastName: true } } } },
      assignments: { select: { agentId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { include: { user: { select: { firstName: true, lastName: true } } } } },
      },
      subtasks: { orderBy: { order: "asc" } },
    },
  });

  if (!task || task.companyId !== agent!.companyId) notFound();

  const [members, groups] = await Promise.all([
    prisma.agent.findMany({
      where: { companyId: agent!.companyId },
      orderBy: { joinedAt: "asc" },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.group.findMany({
      where: { companyId: agent!.companyId },
      orderBy: { createdAt: "asc" },
      include: { agents: { select: { id: true } } },
    }),
  ]);

  const isCreator = task.creatorId === agent!.id;
  const isAssignee = task.assignments.some((a) => a.agentId === agent!.id);
  // Structural edits (the "Modifier" panel) and delete: any admin, or a
  // manager but only on a task they created themselves — see
  // PATCH/DELETE /api/tasks/[id]'s own comments for the full rule.
  const canManage = agent!.role === "ADMIN" || (agent!.role === "MANAGER" && isCreator);
  // Status/progress stay open to whoever's actually working the task.
  const canChangeStatus = canManage || isCreator || isAssignee;
  // Whether this agent can validate/reject the task once it's TO_VALIDATE
  // — see canValidateTask()'s own comment in lib/auth.ts. Computed here
  // rather than passed the raw creatorId so TaskDetail (client-side)
  // never has to reimplement the admin-fallback rule.
  const canValidate = await canValidateTask(
    { id: agent!.id, role: agent!.role },
    { creatorId: task.creatorId, companyId: agent!.companyId }
  );

  const taskData = {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    progress: task.progress,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    linkUrl: task.linkUrl,
    imageUrl: task.imageUrl,
    createdAt: task.createdAt.toISOString(),
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    creator: {
      id: task.creator.id,
      firstName: task.creator.user.firstName,
      lastName: task.creator.user.lastName,
    },
    assigneeIds: task.assignments.map((a) => a.agentId),
    comments: task.comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      author: { id: c.author.id, firstName: c.author.user.firstName, lastName: c.author.user.lastName },
    })),
    subtasks: task.subtasks.map((s) => ({ id: s.id, title: s.title, weight: s.weight, done: s.done, order: s.order })),
  };

  return (
    <div>
      <Link
        href="/dashboard/tasks"
        style={{ display: "inline-block", marginBottom: 16, fontSize: 13.5, color: "var(--color-text-muted)" }}
      >
        ← Retour aux tâches
      </Link>

      <TaskDetail
        task={taskData}
        members={members.map((m) => ({
          id: m.id,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
        }))}
        groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.agents.map((a) => a.id) }))}
        canManage={canManage}
        canChangeStatus={canChangeStatus}
        canValidate={canValidate}
        currentAgent={{ id: agent!.id || "", firstName: agent!.firstName, lastName: agent!.lastName }}
      />
    </div>
  );
}
