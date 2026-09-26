// French labels for the enum-like values defined in prisma/schema.prisma
// (stored as String since SQLite has no native enum type — see that
// file's header comment). Centralized here to stay consistent across
// forms, filters and display pages.

export const AGENT_ROLE_LABELS: Record<string, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MANAGER: "Manager",
  MEMBER: "Membre",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  BLOCKED: "Bloquée",
  // Reached automatically once progress hits 100% (manually or via
  // subtasks — see lib/subtasks.ts's taskUpdateForProgress) — not a final
  // state: the task's creator (or an admin, only if that creator has since
  // left the company — see canValidateTask() in lib/auth.ts) still has to
  // validate it before it becomes truly DONE, or send it back to "En
  // cours" with a reason (see POST /api/tasks/[id]/reject). DONE itself is
  // never reachable any other way — see PATCH /api/tasks/[id].
  TO_VALIDATE: "À valider",
  DONE: "Terminée",
};

// Board column order (left to right).
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "TO_VALIDATE", "DONE"] as const;

export const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: "#6b7280",
  IN_PROGRESS: "#2a3365",
  BLOCKED: "#b3261e",
  TO_VALIDATE: "#c2760c",
  DONE: "#1a8a4c",
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  LOW: "#6b7280",
  NORMAL: "#2a3365",
  HIGH: "#f59e0b",
  URGENT: "#b3261e",
};

// Every interaction with a task (assignment, status/progress change, edit,
// comment) creates one row per notified agent — see PATCH /api/tasks/[id]
// and POST /api/tasks/[id]/comments — surfaced by the bell in the sidebar
// (NotificationBell.tsx).
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  TASK_ASSIGNED: "Assignée à vous",
  TASK_STATUS_CHANGED: "Statut changé",
  TASK_PROGRESS_UPDATED: "Avancement mis à jour",
  TASK_UPDATED: "Tâche modifiée",
  TASK_COMMENT: "Nouveau commentaire",
  // Sent to whoever can validate the task (its creator, or an admin
  // fallback) the moment it reaches 100% — see TASK_STATUS_LABELS.TO_VALIDATE.
  TASK_TO_VALIDATE: "À valider",
  // Sent to its assignees when that validation is refused — see POST
  // /api/tasks/[id]/reject.
  TASK_REJECTED: "Renvoyée en cours",
  // Sent by the cron job in app/api/cron/task-alerts/route.ts once a
  // task's "temps imparti" (creation → échéance, same convention as the
  // Performance readout in TaskDetail.tsx) has half/two-thirds elapsed —
  // one-shot per task per threshold, to its creator and every assignee.
  TASK_HALF_TIME_ELAPSED: "Moitié du délai écoulée",
  TASK_TWO_THIRDS_TIME_ELAPSED: "Deux tiers du délai écoulés",
};
