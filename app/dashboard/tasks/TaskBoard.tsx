import Link from "next/link";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/enums";
import TaskCard, { type BoardTask } from "./TaskCard";

export default function TaskBoard({ tasks, onlyMine }: { tasks: BoardTask[]; onlyMine: boolean }) {
  const byStatus = new Map<string, BoardTask[]>(TASK_STATUSES.map((status) => [status, []]));
  for (const task of tasks) {
    (byStatus.get(task.status) || byStatus.get("TODO")!).push(task);
  }

  return (
    <div>
      <div className="task-board-toolbar">
        <div className="task-filter-tabs">
          <Link href="/dashboard/tasks" className={`task-filter-tab${!onlyMine ? " active" : ""}`}>
            Toutes
          </Link>
          <Link href="/dashboard/tasks?mine=1" className={`task-filter-tab${onlyMine ? " active" : ""}`}>
            Assignées à moi
          </Link>
        </div>
      </div>

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
