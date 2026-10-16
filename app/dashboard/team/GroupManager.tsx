// SUPERSEDED — app/dashboard/team/page.tsx no longer imports this file.
// "Le menu équipe doit être organisé comme le système de dossier de
// Windows" replaced this always-expanded, indented tree with
// TeamFolderBrowser.tsx's drill-down browsing (one level at a time, via
// ?folder=<id>, with a breadcrumb back up) — the group CRUD logic below
// (create/rename/re-parent/delete, leader auto-promotion, cycle
// avoidance) was ported there rather than reused directly, since the tile
// layout and the "no parent picker at creation — you're already inside
// the folder you're creating into" rule don't fit this file's shape.
// Left in place only as dead-code reference (no shell access on this
// device to delete it outright) — safe to remove entirely if it's ever a
// nuisance.
"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "../ConfirmProvider";

export type GroupItem = {
  id: string;
  name: string;
  memberIds: string[];
  creatorId: string | null;
  // "Organisation d'entreprise" hierarchy — a group can itself sit inside
  // a larger one (département > service...) — see Group.parentId in
  // prisma/schema.prisma. Null = top-level.
  parentId: string | null;
  // This group's "chef" — appointing one (see POST/PATCH /api/groups)
  // auto-promotes a plain MEMBER to MANAGER, never a demotion.
  leaderId: string | null;
  leaderName: string | null;
};
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

const selectStyle: CSSProperties = { ...inputStyle, width: "100%" };

// This group and everything nested under it, at any depth — used to keep
// the "groupe parent" picker from offering a choice that would make a
// group its own (in)direct ancestor (the server rejects it too, see
// wouldCreateCycle() in lib/groups.ts, but filtering it out of the
// dropdown is friendlier than a round-trip error).
function descendantIds(groups: GroupItem[], rootId: string): Set<string> {
  const result = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of groups) {
      if (g.parentId && result.has(g.parentId) && !result.has(g.id)) {
        result.add(g.id);
        grew = true;
      }
    }
  }
  return result;
}

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

// Parent-group and chef pickers, shared by the create form and
// GroupEditor below. `excludeParentIds` keeps a group (and its own
// descendants, for the editor) out of its own "groupe parent" dropdown.
function HierarchyFields({
  idPrefix,
  groups,
  excludeParentIds,
  parentId,
  onParentChange,
  members,
  leaderId,
  onLeaderChange,
  disabled,
}: {
  idPrefix: string;
  groups: GroupItem[];
  excludeParentIds: Set<string>;
  parentId: string;
  onParentChange: (id: string) => void;
  members: MemberOption[];
  leaderId: string;
  onLeaderChange: (id: string) => void;
  disabled: boolean;
}) {
  const parentOptions = groups.filter((g) => !excludeParentIds.has(g.id));

  return (
    <div className="field-grid field-grid-2" style={{ marginBottom: 10 }}>
      <div>
        <label
          htmlFor={`${idPrefix}-parent`}
          style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 5 }}
        >
          Groupe parent (optionnel)
        </label>
        <select
          id={`${idPrefix}-parent`}
          value={parentId}
          onChange={(e) => onParentChange(e.target.value)}
          disabled={disabled || parentOptions.length === 0}
          style={selectStyle}
        >
          <option value="">Aucun — groupe de premier niveau</option>
          {parentOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}-leader`}
          style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 5 }}
        >
          Chef de groupe (optionnel)
        </label>
        <select
          id={`${idPrefix}-leader`}
          value={leaderId}
          onChange={(e) => onLeaderChange(e.target.value)}
          disabled={disabled || members.length === 0}
          style={selectStyle}
        >
          <option value="">Aucun chef désigné</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--color-text-muted)" }}>
          Un simple membre nommé chef devient automatiquement manager.
        </p>
      </div>
    </div>
  );
}

// Inline edit panel for one existing group: rename, re-parent, replace its
// member list and/or its chef. Submitting always sends the full member
// set (see PATCH /api/groups/[id] — it uses Prisma's `set`, not a diff).
function GroupEditor({
  group,
  groups,
  members,
  onDone,
  onCancel,
}: {
  group: GroupItem;
  groups: GroupItem[];
  members: MemberOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [memberIds, setMemberIds] = useState<string[]>(group.memberIds);
  const [parentId, setParentId] = useState(group.parentId || "");
  const [leaderId, setLeaderId] = useState(group.leaderId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleMember(id: string) {
    setMemberIds((current) => (current.includes(id) ? current.filter((m) => m !== id) : [...current, id]));
  }

  // A chef who isn't already checked as a member gets added automatically
  // — appointing someone as this group's leader without them belonging to
  // it would be a confusing state to leave on screen.
  function handleLeaderChange(id: string) {
    setLeaderId(id);
    if (id && !memberIds.includes(id)) {
      setMemberIds((current) => [...current, id]);
    }
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
        body: JSON.stringify({ name: trimmed, memberIds, parentId: parentId || null, leaderId: leaderId || null }),
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

      <HierarchyFields
        idPrefix={`group-${group.id}`}
        groups={groups}
        excludeParentIds={descendantIds(groups, group.id)}
        parentId={parentId}
        onParentChange={setParentId}
        members={members}
        leaderId={leaderId}
        onLeaderChange={handleLeaderChange}
        disabled={loading}
      />

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

// One row in the nested tree, indented per depth — see renderTree() below.
function GroupRow({
  group,
  depth,
  canManageThis,
  onEdit,
  onDelete,
  deleting,
}: {
  group: GroupItem;
  depth: number;
  canManageThis: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="group-list-row" style={{ marginLeft: depth * 22 }}>
      <span className="group-list-name">
        {depth > 0 && <span style={{ color: "var(--color-text-muted)" }}>↳ </span>}
        {group.name}{" "}
        <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
          ({group.memberIds.length} membre{group.memberIds.length > 1 ? "s" : ""})
        </span>
        {group.leaderName && (
          <span className="badge" style={{ marginLeft: 8 }}>
            Chef : {group.leaderName}
          </span>
        )}
      </span>
      {canManageThis && (
        <div className="group-list-actions">
          <button
            type="button"
            className="button-secondary button"
            style={{ padding: "5px 10px", fontSize: 12.5 }}
            onClick={onEdit}
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
            onClick={onDelete}
            disabled={deleting}
          >
            Supprimer
          </button>
        </div>
      )}
    </div>
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
  const [parentId, setParentId] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  function toggleNewMember(id: string) {
    setMemberIds((current) => (current.includes(id) ? current.filter((m) => m !== id) : [...current, id]));
  }

  function handleNewLeaderChange(id: string) {
    setLeaderId(id);
    if (id && !memberIds.includes(id)) {
      setMemberIds((current) => [...current, id]);
    }
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
        body: JSON.stringify({ name, memberIds, parentId: parentId || null, leaderId: leaderId || null }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCreateError(data.error || "Une erreur est survenue.");
        setCreateLoading(false);
        return;
      }

      setName("");
      setMemberIds([]);
      setParentId("");
      setLeaderId("");
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
      message: "Les membres ne seront pas supprimés, juste retirés du groupe. Ses sous-groupes, s'il en a, repassent au premier niveau.",
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

  // Depth-first: every top-level group, immediately followed by its own
  // children (recursively) — this is what turns the flat list into a
  // visually nested org chart (département > service > ...) via each
  // row's indentation (see GroupRow's `depth`).
  function renderTree(parentId: string | null, depth: number): React.ReactNode[] {
    return groups
      .filter((g) => (g.parentId || null) === parentId)
      .flatMap((group) => {
        const canManageThis = isAdmin || group.creatorId === currentAgentId;
        const row =
          editingId === group.id ? (
            <GroupEditor
              key={group.id}
              group={group}
              groups={groups}
              members={members}
              onDone={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <GroupRow
              key={group.id}
              group={group}
              depth={depth}
              canManageThis={canManageThis}
              onEdit={() => setEditingId(group.id)}
              onDelete={() => handleDelete(group)}
              deleting={deletingId === group.id}
            />
          );
        return [row, ...renderTree(group.id, depth + 1)];
      });
  }

  const tree = renderTree(null, 0);

  return (
    <div>
      {groups.length === 0 && (
        <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--color-text-muted)" }}>
          Aucun groupe pour l&apos;instant.
        </p>
      )}

      {groups.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>{tree}</div>}

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

        <HierarchyFields
          idPrefix="new-group"
          groups={groups}
          excludeParentIds={new Set<string>()}
          parentId={parentId}
          onParentChange={setParentId}
          members={members}
          leaderId={leaderId}
          onLeaderChange={handleNewLeaderChange}
          disabled={createLoading}
        />

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
