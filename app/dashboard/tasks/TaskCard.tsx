import Link from "next/link";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from "@/lib/enums";
import { formatDateTimeShort } from "@/lib/dates";
import CircularProgress from "./CircularProgress";

export type BoardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  dueDate: string | null;
  commentCount: number;
  subtaskTotal: number;
  subtaskDone: number;
  assignees: { id: string; firstName: string; lastName: string }[];
};

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function ChecklistIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6l1.3 1.3L7.5 5M4 12l1.3 1.3 2.2-2.3M4 18l1.3 1.3 2.2-2.3" />
    </svg>
  );
}

export default function TaskCard({ task }: { task: BoardTask }) {
  const overdue = task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date();
  const shownAssignees = task.assignees.slice(0, 3);
  const extraCount = task.assignees.length - shownAssignees.length;

  return (
    <Link
      href={`/dashboard/tasks/${task.id}`}
      className="task-card"
      // Bare presence-based attributes (not "true"/"false") so the CSS
      // selector below only has to check for existence — see .task-card
      // in globals.css for the very-light red/green background this
      // drives (overdue vs. done).
      data-overdue={overdue ? "" : undefined}
      data-done={task.status === "DONE" ? "" : undefined}
    >
      <p className="task-card-title">
        {task.title}
        {task.status === "IN_PROGRESS" && (
          <CircularProgress value={task.progress} size={28} strokeWidth={3} showLabel />
        )}
      </p>

      <div className="task-card-meta">
        <span
          className="badge"
          style={{ color: TASK_PRIORITY_COLORS[task.priority], borderColor: TASK_PRIORITY_COLORS[task.priority] }}
        >
          {TASK_PRIORITY_LABELS[task.priority] || task.priority}
        </span>
        {task.dueDate && (
          <span className={`task-card-due${overdue ? " overdue" : ""}`}>{formatDateTimeShort(task.dueDate)}</span>
        )}
      </div>

      <div className="task-card-meta" style={{ marginTop: 10 }}>
        <div className="avatar-stack">
          {shownAssignees.map((a) => (
            <span key={a.id} className="avatar-circle" title={`${a.firstName} ${a.lastName}`}>
              {initials(a.firstName, a.lastName)}
            </span>
          ))}
          {extraCount > 0 && <span className="avatar-circle avatar-circle-more">+{extraCount}</span>}
          {task.assignees.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Non assignée</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {task.subtaskTotal > 0 && (
            <span
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
              title={`${task.subtaskDone} sur ${task.subtaskTotal} sous-tâches terminées`}
            >
              <ChecklistIcon />
              {task.subtaskDone}/{task.subtaskTotal}
            </span>
          )}
          {task.commentCount > 0 && (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>💬 {task.commentCount}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
