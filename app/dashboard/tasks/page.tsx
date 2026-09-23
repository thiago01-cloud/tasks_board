import Link from "next/link";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TaskBoard from "./TaskBoard";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const agent = await getCurrentAgent();
  const { mine } = await searchParams;
  const onlyMine = mine === "1";

  const tasks = await prisma.task.findMany({
    where: {
      companyId: agent!.companyId,
      ...(onlyMine ? { assignments: { some: { agentId: agent!.id ?? "" } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      assignments: {
        include: { agent: { include: { user: { select: { firstName: true, lastName: true } } } } },
      },
      _count: { select: { comments: true } },
      // Just done/not, per subtask — enough to show "2/5 sous-tâches" on
      // the card without a second query (see TaskCard.tsx).
      subtasks: { select: { done: true } },
    },
  });

  const boardTasks = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    progress: task.progress,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    commentCount: task._count.comments,
    subtaskTotal: task.subtasks.length,
    subtaskDone: task.subtasks.filter((s) => s.done).length,
    assignees: task.assignments.map((a) => ({
      id: a.agentId,
      firstName: a.agent.user.firstName,
      lastName: a.agent.user.lastName,
    })),
  }));

  return (
    <div>
      <div className="page-header">
        <h1>Tâches</h1>
        <Link href="/dashboard/tasks/new" className="button">
          + Nouvelle tâche
        </Link>
      </div>

      <TaskBoard tasks={boardTasks} onlyMine={onlyMine} />
    </div>
  );
}
