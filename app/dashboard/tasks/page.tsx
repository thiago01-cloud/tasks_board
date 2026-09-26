import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TaskBoard from "./TaskBoard";
import { TaskNavigationProvider, TaskLoadingIndicator } from "./TaskNavigation";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ assignee?: string; priority?: string; group?: string }>;
}) {
  const agent = await getCurrentAgent();
  // Rare case: valid session cookie, but the agent/company/user it points
  // at was deleted in the meantime — see dashboard/layout.tsx's own guard.
  if (!agent) redirect("/login");

  const { assignee, priority, group } = await searchParams;
  // Presence, not truthiness: an explicit "Tous les membres" pick writes
  // ?assignee=all (see below and TaskFilters.tsx), so it shows up here as
  // a defined-but-different-from-the-cascade value, never as "absent".
  // Checking `assignee || priority || group` instead would treat that
  // explicit choice the same as nothing having been touched yet, and the
  // cascade below would keep overwriting it back to "Moi"/"Créé par
  // moi" — which is exactly the bug this guarded against.
  const hasExplicitFilter = assignee !== undefined || priority !== undefined || group !== undefined;

  // The "assigné" dropdown's own value — never left out of sync with what
  // actually gets filtered below. It carries one of four kinds of value:
  // a specific agent id, "created" ("tâches que j'ai créées"), "all"
  // ("Tous les membres" — deliberately a real sentinel, not "", so it
  // can't be confused with "not chosen yet"), or, only before the cascade
  // below runs, undefined.
  let assigneeFilterValue: string;
  let effectiveAssignee = "";
  let filterByCreator = false;
  let defaultView: "assigned" | "created" | "all" | null = null;

  if (hasExplicitFilter) {
    // A manually-typed/bookmarked URL could still set priority or group
    // without ever touching assignee — treat that missing assignee the
    // same as an explicit "all" rather than re-running the cascade for
    // just that one dimension.
    assigneeFilterValue = assignee ?? "all";
    if (assigneeFilterValue === "created") {
      filterByCreator = true;
    } else if (assigneeFilterValue !== "all") {
      effectiveAssignee = assigneeFilterValue;
    }
  } else if (agent!.id) {
    // No filter at all yet (a fresh visit to the page): pick the most
    // useful starting view automatically, and make the dropdown reflect
    // it too, not just the board —
    //   1. tasks assigned to the signed-in agent, if there are any → the
    //      dropdown selects "Moi";
    //   2. otherwise tasks they created themselves, if there are any →
    //      the dropdown selects "Créé par moi";
    //   3. otherwise every task in the company → the dropdown selects
    //      "Tous les membres".
    const assignedCount = await prisma.task.count({
      where: { companyId: agent!.companyId, assignments: { some: { agentId: agent!.id } } },
    });
    if (assignedCount > 0) {
      effectiveAssignee = agent!.id;
      assigneeFilterValue = agent!.id;
      defaultView = "assigned";
    } else {
      const createdCount = await prisma.task.count({
        where: { companyId: agent!.companyId, creatorId: agent!.id },
      });
      if (createdCount > 0) {
        filterByCreator = true;
        assigneeFilterValue = "created";
        defaultView = "created";
      } else {
        assigneeFilterValue = "all";
        defaultView = "all";
      }
    }
  } else {
    // No agent record at all (rare — an owner who never got one, see
    // getCurrentAgent()'s own comment) and nothing to base a cascade on.
    assigneeFilterValue = "all";
  }

  const [tasks, members, groups] = await Promise.all([
    prisma.task.findMany({
      where: {
        companyId: agent!.companyId,
        ...(effectiveAssignee ? { assignments: { some: { agentId: effectiveAssignee } } } : {}),
        ...(filterByCreator ? { creatorId: agent!.id ?? "" } : {}),
        ...(priority ? { priority } : {}),
        ...(group ? { assignedGroups: { some: { id: group } } } : {}),
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
    }),
    // For the "chaque membre" filter dropdown — every agent in the
    // company, not just those who happen to show up assigned to a task
    // currently on the board.
    prisma.agent.findMany({
      where: { companyId: agent!.companyId },
      orderBy: { joinedAt: "asc" },
      select: { id: true, user: { select: { firstName: true, lastName: true } } },
    }),
    // For the "groupes" filter dropdown, same reasoning.
    prisma.group.findMany({
      where: { companyId: agent!.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const boardTasks = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    progress: task.progress,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    hasLink: !!task.linkUrl,
    hasImage: !!task.imageUrl,
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
    // Wraps both the title (its loading ring) and the board (whose
    // TaskFilters.tsx triggers the navigation that ring is watching) — see
    // TaskNavigation.tsx for why this needs to be a shared client-side
    // provider rather than local state in either piece.
    <TaskNavigationProvider>
      <div>
        <div className="page-header">
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            Tâches
            <TaskLoadingIndicator />
          </h1>
          {(agent!.role === "ADMIN" || agent!.role === "MANAGER") && (
            <Link href="/dashboard/tasks/new" className="button">
              + Nouvelle tâche
            </Link>
          )}
        </div>

        <TaskBoard
          tasks={boardTasks}
          currentAgentId={agent!.id}
          members={members.map((m) => ({ id: m.id, name: `${m.user.firstName} ${m.user.lastName}` }))}
          groups={groups}
          filters={{ assignee: assigneeFilterValue, priority: priority || "", group: group || "" }}
          defaultView={defaultView}
        />
      </div>
    </TaskNavigationProvider>
  );
}
