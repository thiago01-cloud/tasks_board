"use client";

import { RECURRENCE_TYPES, RECURRENCE_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/enums";

// Shared by TaskForm.tsx (creation) and TaskDetail.tsx's edit panel —
// keeps the "tâche récurrente" checkbox + its type-specific fields
// (jour du mois / jour de la semaine / intervalle en jours) in one place
// so both forms stay in sync with lib/recurrence.ts's own validation
// rules (see parseRecurrenceInput there) instead of drifting apart.
export type RecurrenceState = {
  isRecurring: boolean;
  recurrenceType: string; // one of RECURRENCE_TYPES, meaningless while !isRecurring
  recurrenceDayOfMonth: string; // kept as the raw <input> string; parsed on submit
  recurrenceDayOfWeek: string;
  recurrenceIntervalDays: string;
};

export const INITIAL_RECURRENCE_STATE: RecurrenceState = {
  isRecurring: false,
  recurrenceType: "MONTHLY",
  recurrenceDayOfMonth: "",
  recurrenceDayOfWeek: "1",
  recurrenceIntervalDays: "",
};

// Builds a RecurrenceState from however a task's own fields came back from
// the API (TaskDetail.tsx's `task` prop) — null defaults to the same
// blanks INITIAL_RECURRENCE_STATE uses, so switching the checkbox on
// starts from a sensible type rather than an empty one.
export function recurrenceStateFromTask(task: {
  isRecurring: boolean;
  recurrenceType: string | null;
  recurrenceDayOfMonth: number | null;
  recurrenceDayOfWeek: number | null;
  recurrenceIntervalDays: number | null;
}): RecurrenceState {
  return {
    isRecurring: task.isRecurring,
    recurrenceType: task.recurrenceType || "MONTHLY",
    recurrenceDayOfMonth: task.recurrenceDayOfMonth != null ? String(task.recurrenceDayOfMonth) : "",
    recurrenceDayOfWeek: task.recurrenceDayOfWeek != null ? String(task.recurrenceDayOfWeek) : "1",
    recurrenceIntervalDays: task.recurrenceIntervalDays != null ? String(task.recurrenceIntervalDays) : "",
  };
}

// Converts the form's string-based state into the JSON payload
// POST /api/tasks and PATCH /api/tasks/[id] expect (see
// parseRecurrenceInput in lib/recurrence.ts, which validates this
// server-side too — this is just what gets sent, not the source of truth).
export function recurrencePayload(state: RecurrenceState) {
  if (!state.isRecurring) {
    return { isRecurring: false };
  }
  return {
    isRecurring: true,
    recurrenceType: state.recurrenceType,
    recurrenceDayOfMonth: state.recurrenceType === "MONTHLY" ? Number(state.recurrenceDayOfMonth) : undefined,
    recurrenceDayOfWeek: state.recurrenceType === "WEEKLY" ? Number(state.recurrenceDayOfWeek) : undefined,
    recurrenceIntervalDays: state.recurrenceType === "CUSTOM" ? Number(state.recurrenceIntervalDays) : undefined,
  };
}

export default function RecurrenceFields({
  value,
  onChange,
  disabled,
}: {
  value: RecurrenceState;
  onChange: (next: RecurrenceState) => void;
  disabled?: boolean;
}) {
  function set<K extends keyof RecurrenceState>(key: K, v: RecurrenceState[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="field">
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={value.isRecurring}
          onChange={(e) => set("isRecurring", e.target.checked)}
          disabled={disabled}
          style={{ width: "auto" }}
        />
        Tâche récurrente
      </label>
      <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>
        Une seule tâche qui se réinitialise automatiquement à l&apos;échéance (ex. le paiement des
        salaires chaque mois) plutôt que d&apos;en recréer une à chaque fois.
      </p>

      {value.isRecurring && (
        <div style={{ marginTop: 10, paddingLeft: 2 }}>
          <div className="field">
            <label htmlFor="recurrenceType">Fréquence</label>
            <select
              id="recurrenceType"
              value={value.recurrenceType}
              onChange={(e) => set("recurrenceType", e.target.value)}
              disabled={disabled}
            >
              {RECURRENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RECURRENCE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {value.recurrenceType === "MONTHLY" && (
            <div className="field">
              <label htmlFor="recurrenceDayOfMonth">Jour du mois</label>
              <input
                id="recurrenceDayOfMonth"
                type="number"
                min={1}
                max={31}
                placeholder="Ex. 22"
                value={value.recurrenceDayOfMonth}
                onChange={(e) => set("recurrenceDayOfMonth", e.target.value)}
                disabled={disabled}
                required
              />
            </div>
          )}

          {value.recurrenceType === "WEEKLY" && (
            <div className="field">
              <label htmlFor="recurrenceDayOfWeek">Jour de la semaine</label>
              <select
                id="recurrenceDayOfWeek"
                value={value.recurrenceDayOfWeek}
                onChange={(e) => set("recurrenceDayOfWeek", e.target.value)}
                disabled={disabled}
              >
                {WEEKDAY_LABELS.map((label, index) => (
                  <option key={index} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {value.recurrenceType === "CUSTOM" && (
            <div className="field">
              <label htmlFor="recurrenceIntervalDays">Intervalle — tous les combien de jours</label>
              <input
                id="recurrenceIntervalDays"
                type="number"
                min={1}
                placeholder="Ex. 15"
                value={value.recurrenceIntervalDays}
                onChange={(e) => set("recurrenceIntervalDays", e.target.value)}
                disabled={disabled}
                required
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
