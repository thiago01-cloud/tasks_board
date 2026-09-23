import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageTitle } from "@/lib/constants";
import TaskDetail from "./TaskDetail";

export const metadata = {
  title: pageTitle("Détail de la tâche"),
};

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const agent = await getCurrentAgent();
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

  const canManage = agent!.role !== "MEMBER" || task.creatorId === agent!.id;
  const isAssignee = task.assignments.some((a) => a.agentId === agent!.id);

  const taskData = {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    progress: task.progress,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
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
        canChangeStatus={canManage || isAssignee}
        currentAgent={{ id: agent!.id || "", firstName: agent!.firstName, lastName: agent!.lastName }}
      />
    </div>
  );
}
