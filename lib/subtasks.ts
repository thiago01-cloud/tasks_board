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
