"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TASK_STATUS_LABELS, TASK_PRIORITY_COLORS } from "@/lib/enums";
import { formatDate, formatDateTime } from "@/lib/dates";
import { useConfirm } from "../../ConfirmProvider";
import ProjectForm from "../ProjectForm";
import ProjectProgressBar from "../ProjectProgressBar";

type ProjectTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  dueDate: string | null;
};

type ProjectData = {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  deliveryDate: string | null;
  createdAt: string;
  creator: { firstName: string; lastName: string } | null;
  progress: number;
  tasks: ProjectTask[];
};

export default function ProjectDetail({ project, canManage }: { project: ProjectData; canManage: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDelete() {
    const ok = await confirm({
      title: `Supprimer le projet « ${project.name} » ?`,
      message: "Les tâches qui y sont attachées ne seront pas supprimées, seulement détachées.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Suppression impossible.");
        setDeleteLoading(false);
        return;
      }
      router.push("/dashboard/projects");
      router.refresh();
    } catch {
      alert("Impossible de contacter le serveur. Réessayez.");
      setDeleteLoading(false);
    }
  }

  return (
    <div className="two-column-grid">
      <div className="card">
        {!editing && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <h1 style={{ margin: 0 }}>{project.name}</h1>
              {canManage && (
                <button
                  className="button-secondary button"
                  style={{ padding: "6px 12px", fontSize: 13 }}
                  onClick={() => setEditing(true)}
                >
                  Modifier
                </button>
              )}
            </div>

            <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: "6px 0 18px" }}>
              {project.creator && (
                <>
                  Créé par {project.creator.firstName} {project.creator.lastName} le {formatDate(project.createdAt)}
                </>
              )}
            </p>

            {project.objective && (
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Objectif</h3>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{project.objective}</p>
              </div>
            )}

            {project.description && (
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Description</h3>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{project.description}</p>
              </div>
            )}

            {!project.description && !project.objective && (
              <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>Aucune description.</p>
            )}
          </>
        )}

        {editing && (
          <ProjectForm
            project={project}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        )}

        <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 20, paddingTop: 18 }}>
          <h3 style={{ marginTop: 0 }}>Tâches ({project.tasks.length})</h3>
          {project.tasks.length === 0 && (
            <p style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>
              Aucune tâche attachée à ce projet pour l&apos;instant.
            </p>
          )}
          {project.tasks.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/tasks/${t.id}`}
              className="task-card"
              style={{ display: "block", marginBottom: 8 }}
            >
              <p className="task-card-title">{t.title}</p>
              <div className="task-card-meta">
                <span
                  className="badge"
                  style={{ color: TASK_PRIORITY_COLORS[t.priority], borderColor: TASK_PRIORITY_COLORS[t.priority] }}
                >
                  {TASK_STATUS_LABELS[t.status] || t.status}
                </span>
                {t.dueDate && <span className="task-card-due">{formatDateTime(t.dueDate)}</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="field">
          <label>Avancement</label>
          <ProjectProgressBar progress={project.progress} />
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>
            Calculé automatiquement à partir de la moyenne d&apos;avancement des tâches du projet.
          </p>
        </div>

        {project.deliveryDate && (
          <div className="field">
            <label>Date de livraison</label>
            <p style={{ margin: 0 }}>{formatDateTime(project.deliveryDate)}</p>
          </div>
        )}

        {canManage && (
          <button
            className="button-secondary button"
            style={{ width: "100%", color: "var(--color-danger)", borderColor: "var(--color-danger-tint)", marginTop: 8 }}
            onClick={handleDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? "Suppression..." : "Supprimer le projet"}
          </button>
        )}
      </div>
    </div>
  );
}
