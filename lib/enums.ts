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
  DONE: "Terminée",
};

// Board column order (left to right).
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

export const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: "#6b7280",
  IN_PROGRESS: "#2a3365",
  BLOCKED: "#b3261e",
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
  TASK_ASSIGNED: "Assignée à toi",
  TASK_STATUS_CHANGED: "Statut changé",
  TASK_PROGRESS_UPDATED: "Avancement mis à jour",
  TASK_UPDATED: "Tâche modifiée",
  TASK_COMMENT: "Nouveau commentaire",
};
