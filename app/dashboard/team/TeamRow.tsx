"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AGENT_ROLE_LABELS } from "@/lib/enums";
import { useConfirm } from "../ConfirmProvider";

type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  role: string;
  groupNames: string[];
};

export default function TeamRow({ agent, isMe }: { agent: TeamMember; isMe: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const ok = await confirm({
      title: `Supprimer le compte de ${agent.firstName} ${agent.lastName} ?`,
      message: "Cette action est irréversible.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Suppression impossible.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur. Réessaie.");
      setLoading(false);
    }
  }

  return (
    <tr>
      <td>{agent.firstName} {agent.lastName}</td>
      <td>{agent.phone}</td>
      <td>{agent.email || "—"}</td>
      <td>
        <span className="badge">{AGENT_ROLE_LABELS[agent.role] || "Membre"}</span>
      </td>
      <td>
        {agent.groupNames.length === 0 && (
          <span style={{ fontSize: 12.5, color: "var(--color-text-muted)", fontStyle: "italic" }}>Sans groupe</span>
        )}
        {agent.groupNames.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {agent.groupNames.map((name) => (
              <span key={name} className="badge">
                {name}
              </span>
            ))}
          </div>
        )}
      </td>
      <td>
        {!isMe && (
          <button
            className="button-secondary button"
            style={{ padding: "5px 10px", fontSize: 13 }}
            onClick={handleDelete}
            disabled={loading}
          >
            Supprimer
          </button>
        )}
        {error && <div className="error-message">{error}</div>}
      </td>
    </tr>
  );
}
