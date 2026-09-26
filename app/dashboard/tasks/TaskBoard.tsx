import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/enums";
import TaskCard, { type BoardTask } from "./TaskCard";
import TaskFilters from "./TaskFilters";

// One-line note shown above the board only when no filter was picked at
// all and page.tsx fell back to its own default — see the cascade
// described there (assigned to you → created by you → everyone's tasks).
// Disappears the moment any filter is touched (including "Moi", which
// looks the same as the "assigned" default but is now an explicit choice
// — see TaskFilters.tsx).
const DEFAULT_VIEW_NOTICES: Record<string, string> = {
  assigned: "Par défaut : tâches qui vous sont assignées.",
  created: "Aucune tâche ne vous est assignée — affichage des tâches que vous avez créées.",
  all: "Aucune tâche ne vous est assignée ni créée par vous — affichage de toutes les tâches.",
};

export default function TaskBoard({
  tasks,
  currentAgentId,
  members,
  groups,
  filters,
  defaultView,
}: {
  tasks: BoardTask[];
  currentAgentId: string | null;
  members: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  filters: { assignee: string; priority: string; group: string };
  defaultView: "assigned" | "created" | "all" | null;
}) {
  const byStatus = new Map<string, BoardTask[]>(TASK_STATUSES.map((status) => [status, []]));
  for (const task of tasks) {
    (byStatus.get(task.status) || byStatus.get("TODO")!).push(task);
  }

  return (
    <div>
      <div className="task-board-toolbar">
        <TaskFilters currentAgentId={currentAgentId} members={members} groups={groups} filters={filters} />
      </div>

      {defaultView && DEFAULT_VIEW_NOTICES[defaultView] && (
        <p className="task-default-notice">{DEFAULT_VIEW_NOTICES[defaultView]}</p>
      )}

      <div className="task-board-scroll">
        <div className="task-board">
          {TASK_STATUSES.map((status) => {
            const columnTasks = byStatus.get(status) || [];
            return (
              <div className="task-column" key={status}>
                <div className="task-column-header">
                  <span className="task-column-title">{TASK_STATUS_LABELS[status]}</span>
                  <span className="task-column-count">{columnTasks.length}</span>
                </div>
                {columnTasks.length === 0 && <p className="task-empty-column">Aucune tâche</p>}
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
