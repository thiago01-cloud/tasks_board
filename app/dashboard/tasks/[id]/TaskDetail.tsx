"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/enums";
import {
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  formatDate,
  formatDateTime,
  formatDateTimeShort,
} from "@/lib/dates";
import CircularProgress, { progressColor } from "../CircularProgress";
import AssigneePicker, {
  fullyAssignedGroupIds,
  UserIcon,
  GroupIcon,
  type MemberOption,
  type GroupOption,
} from "../AssigneePicker";
import SubtaskList, { type SubtaskItem } from "./SubtaskList";
import { useConfirm } from "../../ConfirmProvider";

type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
};

type TaskData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  dueDate: string | null;
  createdAt: string;
  creator: { id: string; firstName: string; lastName: string };
  assigneeIds: string[];
  comments: CommentItem[];
  subtasks: SubtaskItem[];
};

export default function TaskDetail({
  task,
  members,
  groups,
  canManage,
  canChangeStatus,
  currentAgent,
}: {
  task: TaskData;
  members: MemberOption[];
  groups: GroupOption[];
  canManage: boolean;
  canChangeStatus: boolean;
  currentAgent: { id: string; firstName: string; lastName: string };
}) {
  const router = useRouter();
  const confirm = useConfirm();

  const [status, setStatus] = useState(task.status);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");

  // `progress` is the last value confirmed by the server; `progressDraft`
  // tracks the slider while it's being dragged so the UI feels immediate
  // without firing a PATCH on every pixel of movement (see handleSlider*
  // below — the request only goes out once the drag/keypress ends).
  const [progress, setProgress] = useState(task.progress);
  const [progressDraft, setProgressDraft] = useState(task.progress);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState("");

  // Once a task has subtasks, its progress is derived from them (sum of
  // done subtasks' weight — see lib/subtasks.ts) rather than settable by
  // hand, so the manual slider below is hidden in favor of SubtaskList,
  // which reports the recomputed value back up through this callback.
  const hasSubtasks = task.subtasks.length > 0;

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || "");
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.dueDate ? toDatetimeLocalValue(task.dueDate) : "");
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>(task.assigneeIds);
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [deleteLoading, setDeleteLoading] = useState(false);

  const [comments, setComments] = useState(task.comments);
  const [newComment, setNewComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  async function handleStatusChange(next: string) {
    if (next === status) return;
    const ok = await confirm({
      title: `Passer la tâche à « ${TASK_STATUS_LABELS[next] || next} » ?`,
      confirmLabel: "Confirmer",
    });
    if (!ok) return;

    const previous = status;
    const previousProgress = progress;
    setStatus(next);
    // Mirrors the server's own rule (see PATCH /api/tasks/[id]): marking a
    // task DONE snaps its progress to 100% too, so the two stay in sync
    // without waiting for a refresh — skipped when subtasks exist, since
    // there progress stays derived from them and isn't forced by status.
    if (next === "DONE" && !hasSubtasks) {
      setProgress(100);
      setProgressDraft(100);
    }
    setStatusLoading(true);
    setStatusError("");

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(previous);
        setProgress(previousProgress);
        setProgressDraft(previousProgress);
        setStatusError(data.error || "Une erreur est survenue.");
      } else {
        router.refresh();
      }
    } catch {
      setStatus(previous);
      setProgress(previousProgress);
      setProgressDraft(previousProgress);
      setStatusError("Impossible de contacter le serveur. Réessaie.");
    }
    setStatusLoading(false);
  }

  async function commitProgress(next: number) {
    const previous = progress;
    if (next === previous) return;
    setProgress(next);
    setProgressLoading(true);
    setProgressError("");

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: next }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setProgress(previous);
        setProgressDraft(previous);
        setProgressError(data.error || "Une erreur est survenue.");
      } else {
        router.refresh();
      }
    } catch {
      setProgress(previous);
      setProgressDraft(previous);
      setProgressError("Impossible de contacter le serveur. Réessaie.");
    }
    setProgressLoading(false);
  }

  function startEditing() {
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate ? toDatetimeLocalValue(task.dueDate) : "");
    setEditAssigneeIds(task.assigneeIds);
    setEditError("");
    setEditing(true);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    setEditLoading(true);

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          priority: editPriority,
          dueDate: fromDatetimeLocalValue(editDueDate),
          assigneeIds: editAssigneeIds,
          groupIds: fullyAssignedGroupIds(groups, editAssigneeIds),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setEditError(data.error || "Une erreur est survenue.");
        setEditLoading(false);
        return;
      }

      setEditLoading(false);
      setEditing(false);
      router.refresh();
    } catch {
      setEditError("Impossible de contacter le serveur. Réessaie.");
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Supprimer la tâche « ${task.title} » ?`,
      message: "Cette action est irréversible.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Suppression impossible.");
        setDeleteLoading(false);
        return;
      }

      router.push("/dashboard/tasks");
      router.refresh();
    } catch {
      alert("Impossible de contacter le serveur. Réessaie.");
      setDeleteLoading(false);
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCommentError("");
    if (!newComment.trim()) return;
    setCommentLoading(true);

    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCommentError(data.error || "Une erreur est survenue.");
        setCommentLoading(false);
        return;
      }

      setComments((current) => [...current, { ...data.comment, author: currentAgent }]);
      setNewComment("");
      setCommentLoading(false);
      router.refresh();
    } catch {
      setCommentError("Impossible de contacter le serveur. Réessaie.");
      setCommentLoading(false);
    }
  }

  const assignedMembers = members.filter((m) => task.assigneeIds.includes(m.id));
  // Groups this task is explicitly assigned to, for display — same rule
  // used when submitting the assignment (see fullyAssignedGroupIds's own
  // comment): a group counts as assigned exactly when every one of its
  // members is among the current assignees, so this can never disagree
  // with what was actually saved.
  const assignedGroupIds = fullyAssignedGroupIds(groups, task.assigneeIds);
  const assignedGroups = groups.filter((g) => assignedGroupIds.includes(g.id));

  return (
    <div className="two-column-grid">
      <div className="card">
        {!editing && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <h1 style={{ margin: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flex: 1 }}>
                <span>{task.title}</span>
                {status === "IN_PROGRESS" && <CircularProgress value={progress} size={32} strokeWidth={3} showLabel />}
              </h1>
              {canManage && (
                <button className="button-secondary button" style={{ padding: "6px 12px", fontSize: 13 }} onClick={startEditing}>
                  Modifier
                </button>
              )}
            </div>

            <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: "6px 0 18px" }}>
              Créée par {task.creator.firstName} {task.creator.lastName} le {formatDate(task.createdAt)}
            </p>

            {task.description && <p style={{ whiteSpace: "pre-wrap" }}>{task.description}</p>}
            {!task.description && (
              <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>Aucune description.</p>
            )}
          </>
        )}

        {!editing && (
          <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 20, paddingTop: 18 }}>
            <h3 style={{ marginTop: 0 }}>Sous-tâches</h3>
            <SubtaskList
              taskId={task.id}
              initialSubtasks={task.subtasks}
              canEdit={canChangeStatus}
              onProgressChange={(p) => {
                setProgress(p);
                setProgressDraft(p);
              }}
            />
          </div>
        )}

        {editing && (
          <form onSubmit={handleEditSave}>
            <div className="field">
              <label htmlFor="editTitle">Titre</label>
              <input id="editTitle" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="editDescription">Description</label>
              <textarea
                id="editDescription"
                rows={4}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="editPriority">Priorité</label>
              <select id="editPriority" value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="editDueDate">Échéance — date et heure</label>
              <input
                id="editDueDate"
                type="datetime-local"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Assigner à</label>
              <AssigneePicker
                members={members}
                groups={groups}
                selectedIds={editAssigneeIds}
                onChange={setEditAssigneeIds}
                disabled={editLoading}
              />
            </div>

            {editError && <p className="error-message">{editError}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="button" disabled={editLoading}>
                {editLoading ? "Enregistrement..." : "Enregistrer"}
              </button>
              <button
                type="button"
                className="button-secondary button"
                onClick={() => setEditing(false)}
                disabled={editLoading}
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 20, paddingTop: 18 }}>
          <h3 style={{ marginTop: 0 }}>Commentaires</h3>

          <div className="comment-list">
            {comments.length === 0 && (
              <p style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>Aucun commentaire pour l&apos;instant.</p>
            )}
            {comments.map((c) => (
              <div className="comment-item" key={c.id}>
                <p className="comment-author">
                  {c.author.firstName} {c.author.lastName}
                  <span className="comment-date">{formatDateTimeShort(c.createdAt)}</span>
                </p>
                <p className="comment-content">{c.content}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleCommentSubmit}>
            <div className="field">
              <textarea
                rows={3}
                placeholder="Ajouter un commentaire..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
            </div>
            {commentError && <p className="error-message">{commentError}</p>}
            <button type="submit" className="button-secondary button" disabled={commentLoading}>
              {commentLoading ? "Envoi..." : "Commenter"}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="status">Statut</label>
          <select
            id="status"
            value={status}
            disabled={!canChangeStatus || statusLoading}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {statusError && <p className="error-message">{statusError}</p>}
        </div>

        {hasSubtasks && (status === "IN_PROGRESS" || progress > 0) && (
          <div className="field">
            <label>Avancement</label>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress}%`, background: progressColor(progress) }} />
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>
              Calculé à partir des sous-tâches ({progress}%).
            </p>
          </div>
        )}

        {!hasSubtasks && status === "IN_PROGRESS" && (
          <div className="field">
            <label htmlFor="progress">Avancement</label>
            <div className="progress-editor">
              <input
                id="progress"
                type="range"
                min={0}
                max={100}
                step={5}
                value={progressDraft}
                disabled={!canChangeStatus || progressLoading}
                onChange={(e) => setProgressDraft(Number(e.target.value))}
                onMouseUp={(e) => commitProgress(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => commitProgress(Number((e.target as HTMLInputElement).value))}
                onKeyUp={(e) => commitProgress(Number((e.target as HTMLInputElement).value))}
              />
              <span className="progress-editor-value" style={{ color: progressColor(progressDraft) }}>
                {progressDraft}%
              </span>
            </div>
            <div className="progress-bar-track" style={{ marginTop: 6 }}>
              <div className="progress-bar-fill" style={{ width: `${progress}%`, background: progressColor(progress) }} />
            </div>
            {progressError && <p className="error-message">{progressError}</p>}
          </div>
        )}

        <div className="field">
          <label>Priorité</label>
          <p style={{ margin: 0 }}>
            <span
              className="badge"
              style={{ color: TASK_PRIORITY_COLORS[task.priority], borderColor: TASK_PRIORITY_COLORS[task.priority] }}
            >
              {TASK_PRIORITY_LABELS[task.priority] || task.priority}
            </span>
          </p>
        </div>

        {task.dueDate && (
          <div className="field">
            <label>Échéance</label>
            <p style={{ margin: 0 }}>{formatDateTime(task.dueDate)}</p>
          </div>
        )}

        <div className="field">
          <label>Assignée à</label>
          {assignedGroups.length === 0 && assignedMembers.length === 0 && (
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-muted)" }}>Personne pour l&apos;instant.</p>
          )}
          {(assignedGroups.length > 0 || assignedMembers.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {assignedGroups.map((g) => (
                <span
                  key={g.id}
                  className="assignee-chip assignee-chip-group"
                  data-active="true"
                  style={{ cursor: "default" }}
                >
                  <span className="assignee-chip-icon">
                    <GroupIcon />
                  </span>
                  {g.name}
                  <span className="assignee-chip-count">{g.memberIds.length}</span>
                </span>
              ))}
              {assignedMembers.map((m) => (
                <span key={m.id} className="assignee-chip" data-active="true" style={{ cursor: "default" }}>
                  <span className="assignee-chip-icon">
                    <UserIcon />
                  </span>
                  {m.firstName} {m.lastName}
                </span>
              ))}
            </div>
          )}
        </div>

        {canManage && (
          <button
            className="button-secondary button"
            style={{ width: "100%", color: "var(--color-danger)", borderColor: "var(--color-danger-tint)", marginTop: 8 }}
            onClick={handleDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? "Suppression..." : "Supprimer la tâche"}
          </button>
        )}
      </div>
    </div>
  );
}
