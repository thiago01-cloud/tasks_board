// Computes the next occurrence date for a recurring task ("tâches
// répétitives" — see Task.isRecurring and its sibling recurrence* fields
// in prisma/schema.prisma). Used by app/api/cron/task-recurrence/route.ts
// each time a recurring task's `dueDate` has been reached, to move it
// forward rather than spawning a new task — see that model's own comment
// for why there's only ever one row per recurring task.
//
// Also used by POST /api/tasks and PATCH /api/tasks/[id] (see
// parseRecurrenceInput below) to validate and normalize the matching form
// fields on TaskForm.tsx/TaskDetail.tsx before writing them.
//
// Always computed FROM the task's previous `dueDate` (not from "now"), so
// a fixed schedule ("tous les 22 du mois") stays anchored to that date no
// matter when the cron actually runs or when the task was validated — the
// same reasoning POST /api/cron/task-alerts already relies on for its own
// creation→due-date percentages.
import { RECURRENCE_TYPES } from "./enums";

export type RecurrenceConfig = {
  recurrenceType: string | null;
  recurrenceDayOfMonth: number | null;
  recurrenceDayOfWeek: number | null;
  recurrenceIntervalDays: number | null;
};

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Advances `date` by exactly one calendar month, landing on `dayOfMonth`
// (clamped to that target month's last real day — e.g. asking for the
// 31st in April lands on April 30th) while preserving the time-of-day.
// Falls back to just keeping the same day-of-month as `date` itself if no
// explicit `dayOfMonth` was configured (shouldn't normally happen once the
// UI requires it for MONTHLY, but keeps this total rather than throwing).
function addOneMonthClamped(date: Date, dayOfMonth: number | null): Date {
  const targetDay = dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 31 ? dayOfMonth : date.getDate();
  // Day 0 of the month AFTER the target month = the target month's own
  // last day — the standard JS trick for "how many days does this month
  // have", used here to clamp (e.g. day 31 requested for a 30-day month).
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // the month after `date`'s month (0-indexed + 1 == next month, 0-indexed)
  const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(targetDay, lastDayOfTargetMonth);

  const next = new Date(date);
  next.setFullYear(year, month, clampedDay);
  return next;
}

// Returns the next occurrence's due date, or null if the config is
// incomplete/invalid (missing/unrecognized type, or a CUSTOM task with no
// interval set) — callers should leave the task as-is rather than reset it
// when this returns null, since there'd be nothing sensible to reset it to.
export function nextRecurrenceDate(from: Date, config: RecurrenceConfig): Date | null {
  switch (config.recurrenceType) {
    case "DAILY":
      return addDays(from, 1);
    case "WEEKLY":
      // +7 days always lands back on the same weekday as `from` —
      // recurrenceDayOfWeek is stored for display only (see its comment
      // in schema.prisma), not re-read here.
      return addDays(from, 7);
    case "MONTHLY":
      return addOneMonthClamped(from, config.recurrenceDayOfMonth);
    case "CUSTOM": {
      const interval = config.recurrenceIntervalDays;
      if (!interval || interval < 1) return null;
      return addDays(from, interval);
    }
    default:
      return null;
  }
}

// Repeatedly advances past `now` — covers the cron having missed one or
// more cycles (e.g. it didn't run for a few days), so a task is always
// moved to the next occurrence that's actually still in the future rather
// than the very next one after its old, long-past due date. Returns null
// under the same conditions as nextRecurrenceDate (and stops early, rather
// than looping forever, if a step ever fails to advance).
export function catchUpRecurrenceDate(from: Date, now: Date, config: RecurrenceConfig): Date | null {
  let next = nextRecurrenceDate(from, config);
  // Safety cap: a CUSTOM interval could theoretically be large enough that
  // this never needs more than a handful of iterations in practice, but
  // nothing here should ever spin unboundedly on bad data.
  for (let i = 0; next && next.getTime() <= now.getTime() && i < 1000; i++) {
    const after = nextRecurrenceDate(next, config);
    if (!after || after.getTime() <= next.getTime()) break;
    next = after;
  }
  return next;
}

export type RecurrenceUpdate = {
  isRecurring: boolean;
  recurrenceType: string | null;
  recurrenceDayOfMonth: number | null;
  recurrenceDayOfWeek: number | null;
  recurrenceIntervalDays: number | null;
};

// Shared by POST /api/tasks and PATCH /api/tasks/[id]: validates and
// normalizes the recurrence-related fields the task form submits
// (`isRecurring`, `recurrenceType`, and whichever of
// recurrenceDayOfMonth/recurrenceDayOfWeek/recurrenceIntervalDays applies
// to that type), returning Prisma-ready values with every field the
// chosen type doesn't use forced back to null — so switching a task from
// MONTHLY to DAILY, say, can never leave a stale recurrenceDayOfMonth
// behind. `body.isRecurring` falsy/absent short-circuits to "not
// recurring", clearing every recurrence field regardless of what else was
// sent — same "the caller is a form that resends everything" reasoning as
// validMemberIds/validGroupIds in lib/groups.ts.
export function parseRecurrenceInput(
  body: Record<string, unknown>
): { ok: true; data: RecurrenceUpdate } | { ok: false; error: string } {
  if (!body.isRecurring) {
    return {
      ok: true,
      data: {
        isRecurring: false,
        recurrenceType: null,
        recurrenceDayOfMonth: null,
        recurrenceDayOfWeek: null,
        recurrenceIntervalDays: null,
      },
    };
  }

  const recurrenceType = typeof body.recurrenceType === "string" ? body.recurrenceType : "";
  if (!RECURRENCE_TYPES.includes(recurrenceType as (typeof RECURRENCE_TYPES)[number])) {
    return { ok: false, error: "Type de récurrence invalide." };
  }

  let recurrenceDayOfMonth: number | null = null;
  let recurrenceDayOfWeek: number | null = null;
  let recurrenceIntervalDays: number | null = null;

  if (recurrenceType === "MONTHLY") {
    const day = Number(body.recurrenceDayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return { ok: false, error: "Le jour du mois doit être compris entre 1 et 31." };
    }
    recurrenceDayOfMonth = day;
  } else if (recurrenceType === "WEEKLY") {
    const day = Number(body.recurrenceDayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return { ok: false, error: "Le jour de la semaine est invalide." };
    }
    recurrenceDayOfWeek = day;
  } else if (recurrenceType === "CUSTOM") {
    const interval = Number(body.recurrenceIntervalDays);
    if (!Number.isInteger(interval) || interval < 1) {
      return { ok: false, error: "L'intervalle doit être un nombre de jours supérieur à 0." };
    }
    recurrenceIntervalDays = interval;
  }

  return {
    ok: true,
    data: { isRecurring: true, recurrenceType, recurrenceDayOfMonth, recurrenceDayOfWeek, recurrenceIntervalDays },
  };
}
