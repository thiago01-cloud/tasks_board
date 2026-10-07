"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toDatetimeLocalValue } from "@/lib/dates";

export type ProjectData = {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  deliveryDate: string | null;
};

// Shared by app/dashboard/projects/new/page.tsx (creation) and
// ProjectDetail.tsx's own edit panel — `project` being set switches this
// from a POST to a PATCH, same pattern as GroupEditor.tsx vs. the
// team page's own "new group" form.
export default function ProjectForm({
  project,
  onSaved,
  onCancel,
}: {
  project?: ProjectData;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(project?.name || "");
  const [description, setDescription] = useState(project?.description || "");
  const [objective, setObjective] = useState(project?.objective || "");
  const [deliveryDate, setDeliveryDate] = useState(
    project?.deliveryDate ? toDatetimeLocalValue(project.deliveryDate) : ""
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = {
      name,
      description,
      objective,
      deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : null,
    };

    try {
      const res = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", {
        method: project ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      if (project) {
        onSaved?.();
        router.refresh();
      } else {
        router.push(`/dashboard/projects/${data.project.id}`);
      }
    } catch {
      setError("Impossible de contacter le serveur. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="projectName">Nom</label>
        <input id="projectName" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="field">
        <label htmlFor="projectDescription">Description (optionnel)</label>
        <textarea
          id="projectDescription"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="projectObjective">Objectif (optionnel)</label>
        <textarea
          id="projectObjective"
          rows={2}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="projectDeliveryDate">Date de livraison (optionnel)</label>
        <input
          id="projectDeliveryDate"
          type="datetime-local"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
        />
      </div>

      {error && <p className="error-message">{error}</p>}

      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="button" disabled={loading}>
          {loading ? "Enregistrement..." : project ? "Enregistrer" : "Créer le projet"}
        </button>
        {onCancel && (
          <button type="button" className="button-secondary button" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
