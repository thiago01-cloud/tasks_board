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

function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

export default function TeamCard({
  agent,
  isMe,
  canDelete,
}: {
  agent: TeamMember;
  isMe: boolean;
  canDelete: boolean;
}) {
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
    <div className="card team-card">
      <div className="team-card-top">
        <div className="team-card-avatar">{initials(agent.firstName, agent.lastName)}</div>
        <div className="team-card-identity">
          <p className="team-card-name">
            {agent.firstName} {agent.lastName}
            {isMe && " (toi)"}
          </p>
          <p className="team-card-role">{AGENT_ROLE_LABELS[agent.role] || "Membre"}</p>
        </div>
        <span className="badge">{AGENT_ROLE_LABELS[agent.role] || "Membre"}</span>
      </div>

      <div className="team-card-groups">
        {agent.groupNames.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>Sans groupe</span>
        ) : (
          agent.groupNames.map((name) => (
            <span key={name} className="badge">
              {name}
            </span>
          ))
        )}
      </div>

      <div className="team-card-contact">
        <span className="team-card-contact-row" title={agent.email || undefined}>
          <MailIcon />
          {agent.email || "—"}
        </span>
        <span className="team-card-contact-row" title={agent.phone}>
          <PhoneIcon />
          {agent.phone}
        </span>
      </div>

      {!isMe && canDelete && (
        <div className="team-card-actions">
          <button
            className="button-secondary button"
            style={{ padding: "5px 10px", fontSize: 13 }}
            onClick={handleDelete}
            disabled={loading}
          >
            Supprimer
          </button>
        </div>
      )}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
