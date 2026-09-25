"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "../ConfirmProvider";

export type GroupItem = { id: string; name: string; memberIds: string[]; creatorId: string | null };
export type MemberOption = { id: string; name: string };

// Bare (not-in-".field") inputs used in the horizontal "create" row below
// need their border/padding set directly — ".field input" in globals.css
// only styles inputs inside a ".field" wrapper.
const inputStyle: CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};

// Toggle "chips" rather than native checkboxes — the same pattern already
// used for picking assignees on a task (AssigneePicker/.assignee-*), which
// sidesteps the odd, hard-to-pin-down rendering of a plain checkbox list
// (name pushed far from its checkbox) and gives a consistent look for
// "pick some people" everywhere in the app.
function MemberCheckboxes({
  members,
  selectedIds,
  onToggle,
  disabled,
}: {
  members: MemberOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  if (members.length === 0) {
    return (
      <p style={{ margin: "6px 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>
        Aucun membre dans l&apos;équipe pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="assignee-grid">
      {members.map((m) => {
        const active = selectedIds.includes(m.id);
        return (
          <button
            type="button"
            key={m.id}
            onClick={() => onToggle(m.id)}
            disabled={disabled}
            className="assignee-chip"
            data-active={active ? "true" : undefined}
          >
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

// Inline edit panel for one existing group: rename + replace its member
// list. Submitting always sends the full member set (see
// PATCH /api/groups/[id] — it uses Prisma's `set`, not a diff).
function GroupEditor({
  group,
  members,
  onDone,
  onCancel,
}: {
  group: GroupItem;
  members: MemberOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [memberIds, setMemberIds] = useState<string[]>(group.memberIds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleMember(id: string) {
    setMemberIds((current) => (current.includes(id) ? current.filter((m) => m !== id) : [...current, id]));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Le nom du groupe est requis.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, memberIds }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      setLoading(false);
      router.refresh();
      onDone();
    } catch {
      setError("Impossible de contacter le serveur. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12 }}
    >
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor={`group-name-${group.id}`}>Nom du groupe</label>
        <input id={`group-name-${group.id}`} value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
      </div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label>Membres</label>
        <MemberCheckboxes members={members} selectedIds={memberIds} onToggle={toggleMember} disabled={loading} />
      </div>

      {error && <p className="error-message">{error}</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" className="button" style={{ padding: "6px 12px", fontSize: 13 }} disabled={loading}>
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button
          type="button"
          className="button-secondary button"
          style={{ padding: "6px 12px", fontSize: 13 }}
          onClick={onCancel}
          disabled={loading}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

export default function GroupManager({
  groups,
  members,
  currentAgentId,
  isAdmin,
}: {
  groups: GroupItem[];
  members: MemberOption[];
  currentAgentId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();

  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  function toggleNewMember(id: string) {
    setMemberIds((current) => (current.includes(id) ? current.filter((m) => m !== id) : [...current, id]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (!name.trim()) return;
    setCreateLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, memberIds }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCreateError(data.error || "Une erreur est survenue.");
        setCreateLoading(false);
        return;
      }

      setName("");
      setMemberIds([]);
      setCreateLoading(false);
      router.refresh();
    } catch {
      setCreateError("Impossible de contacter le serveur. Réessayez.");
      setCreateLoading(false);
    }
  }

  async function handleDelete(group: GroupItem) {
    const ok = await confirm({
      title: `Supprimer le groupe « ${group.name} » ?`,
      message: "Les membres ne seront pas supprimés, juste retirés du groupe.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(group.id);
    setDeleteError("");

    try {
      const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Suppression impossible.");
        setDeletingId(null);
        return;
      }

      setDeletingId(null);
      router.refresh();
    } catch {
      setDeleteError("Impossible de contacter le serveur. Réessayez.");
      setDeletingId(null);
    }
  }

  return (
    <div>
      {groups.length === 0 && (
        <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--color-text-muted)" }}>
          Aucun groupe pour l&apos;instant.
        </p>
      )}

      {groups.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {groups.map((group) => {
            // Any admin can manage any group; a manager only the ones they
            // created themselves — same rule enforced server-side in
            // PATCH/DELETE /api/groups/[id].
            const canManageThis = isAdmin || group.creatorId === currentAgentId;

            return editingId === group.id ? (
              <GroupEditor
                key={group.id}
                group={group}
                members={members}
                onDone={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={group.id} className="group-list-row">
                <span className="group-list-name">
                  {group.name}{" "}
                  <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                    ({group.memberIds.length} membre{group.memberIds.length > 1 ? "s" : ""})
                  </span>
                </span>
                {canManageThis && (
                  <div className="group-list-actions">
                    <button
                      type="button"
                      className="button-secondary button"
                      style={{ padding: "5px 10px", fontSize: 12.5 }}
                      onClick={() => setEditingId(group.id)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="button-secondary button"
                      style={{
                        padding: "5px 10px",
                        fontSize: 12.5,
                        color: "var(--color-danger)",
                        borderColor: "var(--color-danger-tint)",
                      }}
                      onClick={() => handleDelete(group)}
                      disabled={deletingId === group.id}
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteError && <p className="error-message">{deleteError}</p>}

      <form
        id="add-group-form"
        onSubmit={handleCreate}
        className="scroll-target"
        style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14 }}
      >
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700 }}>Créer un groupe</p>
        <div style={{ marginBottom: 10 }}>
          <input
            placeholder="Nom du groupe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ ...inputStyle, width: "100%" }}
            disabled={createLoading}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 5 }}>
            Membres
          </label>
          <MemberCheckboxes members={members} selectedIds={memberIds} onToggle={toggleNewMember} disabled={createLoading} />
        </div>
        {createError && <p className="error-message">{createError}</p>}
        <button type="submit" className="button" disabled={createLoading}>
          {createLoading ? "Création..." : "Créer le groupe"}
        </button>
      </form>
    </div>
  );
}
