"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/enums";
import { fromDatetimeLocalValue } from "@/lib/dates";
import AssigneePicker, { fullyAssignedGroupIds, type MemberOption, type GroupOption } from "./AssigneePicker";

export default function TaskForm({ members, groups }: { members: MemberOption[]; groups: GroupOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [dueDate, setDueDate] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          priority,
          dueDate: fromDatetimeLocalValue(dueDate),
          assigneeIds,
          groupIds: fullyAssignedGroupIds(groups, assigneeIds),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      router.push(`/dashboard/tasks/${data.task.id}`);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur. Réessaie.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="title">Titre</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="field">
        <label htmlFor="description">Description (optionnel)</label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="priority">Priorité</label>
        <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="dueDate">Échéance — date et heure (optionnel)</label>
        <input
          id="dueDate"
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Assigner à (optionnel)</label>
        <AssigneePicker members={members} groups={groups} selectedIds={assigneeIds} onChange={setAssigneeIds} />
      </div>

      {error && <p className="error-message">{error}</p>}

      <button type="submit" className="button" disabled={loading}>
        {loading ? "Création..." : "Créer la tâche"}
      </button>
    </form>
  );
}
