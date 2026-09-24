// Helpers shared by the subtasks API routes (app/api/tasks/[id]/subtasks)
// and, for the sum-of-done-weights rule, documented here for
// SubtaskList.tsx too even though it doesn't import this file (client
// component — the server always recomputes and returns the authoritative
// numbers, the UI just displays them).

// Splits 100 percentage points as evenly as possible across `count`
// subtasks, remainder going to the first entries, so the result always
// sums to EXACTLY 100 (never 99 or 101 from integer rounding).
// equalWeights(3) -> [34, 33, 33], equalWeights(4) -> [25, 25, 25, 25].
export function equalWeights(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

// A task's progress, once it has subtasks, is just the sum of the weights
// of the ones marked done — this is the single source of truth used
// everywhere progress is recomputed (add/remove/toggle/reweight).
export function computeProgress(subtasks: { weight: number; done: boolean }[]): number {
  return subtasks.reduce((sum, s) => (s.done ? sum + s.weight : sum), 0);
}

// Data to pass to `tx.task.update` whenever a subtask change moves the
// parent task's progress — always carries the new `progress`, and also
// flips `status` to TO_VALIDATE the moment it reaches 100%, mirroring
// PATCH /api/tasks/[id]'s rule for the manual slider. Not `completedAt`
// yet, and not straight to DONE either — DONE is now reserved for once
// the task's creator (or an admin fallback — see canValidateTask() in
// lib/auth.ts) actually validates it, which is also the moment
// `completedAt` gets set (see PATCH /api/tasks/[id]); reaching 100% only
// queues it up for that review. Deliberately one-directional: progress
// dropping back down later (e.g. a subtask reweighted or deleted after
// the task was auto-queued) never reopens it — only the forward "just
// finished" transition is automatic. Skipped once already TO_VALIDATE or
// DONE, so re-toggling subtasks at 100% doesn't keep re-queuing it.
export function taskUpdateForProgress(
  nextProgress: number,
  currentStatus: string
): { progress: number; status?: string } {
  if (nextProgress === 100 && currentStatus !== "TO_VALIDATE" && currentStatus !== "DONE") {
    return { progress: nextProgress, status: "TO_VALIDATE" };
  }
  return { progress: nextProgress };
}

// Which notification type a progress-driven update should send — status
// change wins over a plain progress update when the two coincide (same
// "one notification, not two" rule PATCH /api/tasks/[id] follows), and
// reaching TO_VALIDATE specifically gets its own type so whoever can
// validate the task sees a clear "à valider" notification rather than a
// generic "statut changé" one.
export function notificationTypeForProgress(update: { status?: string }): string {
  if (update.status === "TO_VALIDATE") return "TASK_TO_VALIDATE";
  return update.status ? "TASK_STATUS_CHANGED" : "TASK_PROGRESS_UPDATED";
}
