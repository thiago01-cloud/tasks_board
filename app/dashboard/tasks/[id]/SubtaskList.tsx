"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { progressColor } from "../CircularProgress";
import { useConfirm } from "../../ConfirmProvider";

export type SubtaskItem = {
  id: string;
  title: string;
  weight: number;
  done: boolean;
  order: number;
};

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// A task's checkable breakdown: each subtask carries a weight (percentage
// points of the parent task's overall progress), the full set always
// summing to exactly 100 — enforced server-side (see the subtasks API
// routes), this component just reflects whatever it gets back. Default
// split is equal (100/N); "Ajuster les pourcentages" lets whoever's
// working the task reweight by hand to reflect each step's real
// complexity, as long as the total still lands on exactly 100%.
export default function SubtaskList({
  taskId,
  initialSubtasks,
  canEdit,
  onProgressChange,
}: {
  taskId: string;
  initialSubtasks: SubtaskItem[];
  canEdit: boolean;
  onProgressChange: (progress: number) => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [subtasks, setSubtasks] = useState(initialSubtasks);

  const [newTitle, setNewTitle] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const [adjusting, setAdjusting] = useState(false);
  const [draftWeights, setDraftWeights] = useState<Record<string, string>>({});
  const [reweightError, setReweightError] = useState("");
  const [reweightLoading, setReweightLoading] = useState(false);

  function applyResult(next: SubtaskItem[]) {
    setSubtasks(next);
    const progress = next.reduce((sum, s) => (s.done ? sum + s.weight : sum), 0);
    onProgressChange(progress);
    router.refresh();
  }

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    if (!newTitle.trim()) return;
    setAddLoading(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAddError(data.error || "Une erreur est survenue.");
      } else {
        applyResult(data.subtasks);
        setNewTitle("");
      }
    } catch {
      setAddError("Impossible de contacter le serveur. Réessaie.");
    }
    setAddLoading(false);
  }

  async function toggleDone(subtask: SubtaskItem) {
    // Only the "validation" direction (not done -> done) is gated —
    // unchecking is a correction, not a commitment, so it stays direct.
    if (!subtask.done) {
      const ok = await confirm({
        title: `Valider « ${subtask.title} » ?`,
        message: "Cette sous-tâche sera marquée comme terminée et l'avancement de la tâche sera mis à jour.",
        confirmLabel: "Valider",
      });
      if (!ok) return;
    }
    setToggleLoadingId(subtask.id);
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !subtask.done }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) applyResult(data.subtasks);
    } catch {
      // Best effort — the checkbox just stays as it was.
    }
    setToggleLoadingId(null);
  }

  async function removeSubtask(subtask: SubtaskItem) {
    const ok = await confirm({
      title: `Supprimer la sous-tâche « ${subtask.title} » ?`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setDeleteLoadingId(subtask.id);
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtask.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) applyResult(data.subtasks);
    } catch {
      // Best effort.
    }
    setDeleteLoadingId(null);
  }

  function startAdjusting() {
    const draft: Record<string, string> = {};
    subtasks.forEach((s) => {
      draft[s.id] = String(s.weight);
    });
    setDraftWeights(draft);
    setReweightError("");
    setAdjusting(true);
  }

  const draftTotal = subtasks.reduce((sum, s) => sum + (Number(draftWeights[s.id]) || 0), 0);

  async function saveWeights(e: React.FormEvent) {
    e.preventDefault();
    setReweightError("");
    if (draftTotal !== 100) {
      setReweightError(`Le total doit faire exactement 100% (actuellement ${draftTotal}%).`);
      return;
    }
    setReweightLoading(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weights: Object.fromEntries(subtasks.map((s) => [s.id, Number(draftWeights[s.id]) || 0])),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setReweightError(data.error || "Une erreur est survenue.");
      } else {
        applyResult(data.subtasks);
        setAdjusting(false);
      }
    } catch {
      setReweightError("Impossible de contacter le serveur. Réessaie.");
    }
    setReweightLoading(false);
  }

  const progress = subtasks.reduce((sum, s) => (s.done ? sum + s.weight : sum), 0);

  return (
    <div>
      {subtasks.length > 0 && (
        <div className="progress-bar-track" style={{ marginBottom: 14 }}>
          <div className="progress-bar-fill" style={{ width: `${progress}%`, background: progressColor(progress) }} />
        </div>
      )}

      {subtasks.length === 0 && (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13.5, margin: "0 0 12px" }}>
          Aucune sous-tâche pour l&apos;instant.
        </p>
      )}

      <div className="subtask-list">
        {subtasks.map((s) => (
          <div className="subtask-item" key={s.id} data-done={s.done ? "true" : undefined}>
            <button
              type="button"
              className="subtask-checkbox"
              onClick={() => toggleDone(s)}
              disabled={!canEdit || toggleLoadingId === s.id}
              aria-label={s.done ? "Marquer comme non terminée" : "Marquer comme terminée"}
            >
              {s.done && <CheckIcon />}
            </button>
            <span className="subtask-title">{s.title}</span>
            <span className="subtask-weight">{s.weight}%</span>
            {canEdit && (
              <button
                type="button"
                className="subtask-delete"
                onClick={() => removeSubtask(s)}
                disabled={deleteLoadingId === s.id}
                aria-label="Supprimer la sous-tâche"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {canEdit && subtasks.length > 1 && !adjusting && (
        <button
          type="button"
          className="button-secondary button"
          style={{ marginTop: 10, padding: "6px 12px", fontSize: 13 }}
          onClick={startAdjusting}
        >
          Ajuster les pourcentages
        </button>
      )}

      {canEdit && adjusting && (
        <form onSubmit={saveWeights} style={{ marginTop: 10, borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
          {subtasks.map((s) => (
            <div key={s.id} className="subtask-reweight-row">
              <span className="subtask-reweight-title">{s.title}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={draftWeights[s.id] ?? ""}
                onChange={(e) => setDraftWeights((prev) => ({ ...prev, [s.id]: e.target.value }))}
                style={{ width: 64 }}
              />
              <span>%</span>
            </div>
          ))}
          <p style={{ fontSize: 13, fontWeight: 600, margin: "6px 0", color: draftTotal === 100 ? "var(--color-success)" : "var(--color-danger)" }}>
            Total : {draftTotal}%
          </p>
          {reweightError && <p className="error-message">{reweightError}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="button" disabled={reweightLoading || draftTotal !== 100}>
              {reweightLoading ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              type="button"
              className="button-secondary button"
              onClick={() => setAdjusting(false)}
              disabled={reweightLoading}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {canEdit && (
        <form onSubmit={addSubtask} style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <input
            placeholder="Nouvelle sous-tâche..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="button-secondary button" style={{ padding: "8px 14px", fontSize: 13 }} disabled={addLoading}>
            {addLoading ? "Ajout..." : "Ajouter"}
          </button>
        </form>
      )}
      {addError && <p className="error-message">{addError}</p>}
    </div>
  );
}
