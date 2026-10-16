"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "../ConfirmProvider";
import TeamCard from "./TeamCard";

export type GroupItem = {
  id: string;
  name: string;
  memberIds: string[];
  creatorId: string | null;
  // "Organisation d'entreprise" hierarchy — a group can itself sit inside
  // a larger one (département > service...) — see Group.parentId in
  // prisma/schema.prisma. Null = top-level, i.e. sits at the Équipe root.
  parentId: string | null;
  leaderId: string | null;
  leaderName: string | null;
};
export type MemberOption = { id: string; name: string };

// What page.tsx hands down for every agent this browser might render as a
// card — the plain TeamCard fields plus the four permission booleans
// page.tsx already computed for it (canManageAgent()/canManageAccount() in
// lib/agents.ts) so neither TeamCard nor this file has to recompute them
// per render, at root or ten folders deep.
export type TeamMemberCard = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  country: string;
  phone: string;
  email: string | null;
  role: string;
  groupNames: string[];
  canManageSubscription: boolean;
  pushEnabled: boolean;
  color: string;
  canManage: boolean;
  canDelete: boolean;
  canGrantSubscriptionManager: boolean;
  canManageAccount: boolean;
};

const inputStyle: CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};
const selectStyle: CSSProperties = { ...inputStyle, width: "100%" };

// This group and everything nested under it, at any depth — keeps a
// group's own "dossier parent" picker (in GroupEditForm below) from
// offering a choice that would make it its own (in)direct ancestor. The
// server rejects this too (see wouldCreateCycle() in lib/groups.ts), but
// filtering it out of the dropdown is friendlier than a round-trip error.
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

function FolderIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

// Toggle "chips" rather than native checkboxes — same pattern already used
// for picking assignees on a task (AssigneePicker/.assignee-*).
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

function LeaderSelect({
  idPrefix,
  members,
  leaderId,
  onChange,
  disabled,
}: {
  idPrefix: string;
  members: MemberOption[];
  leaderId: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label
        htmlFor={`${idPrefix}-leader`}
        style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 5 }}
      >
        Chef de groupe (optionnel)
      </label>
      <select
        id={`${idPrefix}-leader`}
        value={leaderId}
        onChange={(e) => onChange(e.target.value)}
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
  );
}

// Rename, move (re-parent) and/or replace a group's membership/chef — used
// both for a child group (edited from its own tile in the grid below) and
// for the CURRENT folder's own group (edited from the controls right under
// the breadcrumb, since there's no tile to click "Modifier" on for "the
// folder you're currently standing in"). Always sends the full member set
// (see PATCH /api/groups/[id] — it uses Prisma's `set`, not a diff).
function GroupEditForm({
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

  const excluded = descendantIds(groups, group.id);
  const parentOptions = groups.filter((g) => !excluded.has(g.id));

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
    <form onSubmit={handleSave} className="card" style={{ marginBottom: 20 }}>
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor={`group-name-${group.id}`}>Nom du groupe</label>
        <input id={`group-name-${group.id}`} value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label
          htmlFor={`group-parent-${group.id}`}
          style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 5 }}
        >
          Dossier parent
        </label>
        <select
          id={`group-parent-${group.id}`}
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          disabled={loading || parentOptions.length === 0}
          style={selectStyle}
        >
          <option value="">Aucun — groupe de premier niveau (racine de l&apos;équipe)</option>
          {parentOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--color-text-muted)" }}>
          Change l&apos;emplacement de ce groupe dans la hiérarchie — comme déplacer un dossier.
        </p>
      </div>

      <LeaderSelect
        idPrefix={`group-${group.id}`}
        members={members}
        leaderId={leaderId}
        onChange={handleLeaderChange}
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

// One "folder" tile — a group shown at this level, clickable to drill into
// it (same mental model as opening a folder in Windows Explorer). The
// Modifier/Supprimer buttons are separate sibling buttons, not nested
// inside the clickable area, so a click on them never also triggers the
// navigation.
function GroupTile({
  group,
  childCount,
  canManageThis,
  onOpen,
  onEdit,
  onDelete,
  deleting,
}: {
  group: GroupItem;
  childCount: number;
  canManageThis: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="team-folder-tile">
      <button type="button" onClick={onOpen} className="team-folder-tile-open">
        <span className="team-folder-icon">
          <FolderIcon />
        </span>
        <span className="team-folder-body">
          <p className="team-folder-name">{group.name}</p>
          <span className="team-folder-meta">
            <span>
              {group.memberIds.length} membre{group.memberIds.length !== 1 ? "s" : ""}
            </span>
            {childCount > 0 && (
              <span>
                · {childCount} sous-groupe{childCount > 1 ? "s" : ""}
              </span>
            )}
            {group.leaderName && <span className="badge">👑 {group.leaderName}</span>}
          </span>
        </span>
      </button>
      {canManageThis && (
        <div className="team-folder-actions">
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

// The Équipe page's main browser — "le menu équipe doit être organisé comme
// le système de dossier de Windows" ("the team menu should be organized
// like Windows' folder system"): page.tsx resolves which groups and which
// agents belong at the CURRENT level (root, or inside whichever group
// `?folder=` points to) and hands them here as `childGroups` (sub-folders
// to drill into) and `agentsHere` (the people who live directly at this
// level — everyone ungrouped at the root, or a group's own direct members,
// chef first). Drilling into a group is just a navigation to
// `?folder=<id>` (see goToFolder below), which re-runs page.tsx's server
// query for that new level — the same "filters via the URL" pattern
// already used on the Tâches page, rather than client-side tree state.
export default function TeamFolderBrowser({
  folderId,
  currentFolder,
  childGroups,
  agentsHere,
  allGroups,
  allMembers,
  currentAgentId,
  currentUserId,
  isAdmin,
  canCreateGroup,
}: {
  folderId: string | null;
  currentFolder: GroupItem | null;
  childGroups: GroupItem[];
  agentsHere: TeamMemberCard[];
  allGroups: GroupItem[];
  allMembers: MemberOption[];
  currentAgentId: string;
  currentUserId: string;
  isAdmin: boolean;
  canCreateGroup: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();

  const [editingCurrent, setEditingCurrent] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  function goToFolder(id: string | null) {
    router.push(id ? `/dashboard/team?folder=${id}` : "/dashboard/team");
  }

  function toggleNewMember(id: string) {
    setMemberIds((current) => (current.includes(id) ? current.filter((m) => m !== id) : [...current, id]));
  }

  function handleNewLeaderChange(id: string) {
    setLeaderId(id);
    if (id && !memberIds.includes(id)) {
      setMemberIds((current) => [...current, id]);
    }
  }

  // New groups are created directly inside whatever folder is currently
  // open (`parentId: folderId`, root included) — like "Nouveau dossier" in
  // a file explorer always landing in the folder you're viewing. Moving
  // one elsewhere afterward is still possible from its "Modifier" form
  // (GroupEditForm's own "Dossier parent" picker).
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (!name.trim()) return;
    setCreateLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, memberIds, parentId: folderId, leaderId: leaderId || null }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCreateError(data.error || "Une erreur est survenue.");
        setCreateLoading(false);
        return;
      }

      setName("");
      setMemberIds([]);
      setLeaderId("");
      setCreateLoading(false);
      router.refresh();
    } catch {
      setCreateError("Impossible de contacter le serveur. Réessayez.");
      setCreateLoading(false);
    }
  }

  async function handleDelete(group: GroupItem, afterDelete: () => void) {
    const ok = await confirm({
      title: `Supprimer le groupe « ${group.name} » ?`,
      message:
        "Les membres ne seront pas supprimés, juste retirés du groupe. Ses sous-groupes, s'il en a, repassent au premier niveau.",
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
      afterDelete();
    } catch {
      setDeleteError("Impossible de contacter le serveur. Réessayez.");
      setDeletingId(null);
    }
  }

  // The tile being edited is pulled out of the grid entirely while its
  // form is open (rendered once, above, rather than inline in a 3-column
  // grid where a wide form would look cramped) — same idea as the old
  // GroupManager swapping a GroupRow for a GroupEditor in place, just laid
  // out for tiles instead of a flat list.
  const visibleChildGroups = childGroups.filter((g) => g.id !== editingChildId);
  const editingChildGroup = editingChildId ? childGroups.find((g) => g.id === editingChildId) ?? null : null;
  const canManageCurrent = !!currentFolder && (isAdmin || currentFolder.creatorId === currentAgentId);

  return (
    <div>
      {currentFolder && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          {currentFolder.leaderName && (
            <span className="badge" style={{ color: "var(--color-accent)", borderColor: "var(--color-accent)" }}>
              👑 Chef : {currentFolder.leaderName}
            </span>
          )}
          {canManageCurrent && !editingCurrent && (
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <button
                type="button"
                className="button-secondary button"
                style={{ padding: "5px 10px", fontSize: 12.5 }}
                onClick={() => setEditingCurrent(true)}
              >
                Modifier ce groupe
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
                onClick={() => handleDelete(currentFolder!, () => goToFolder(currentFolder!.parentId))}
                disabled={deletingId === currentFolder.id}
              >
                Supprimer ce groupe
              </button>
            </div>
          )}
        </div>
      )}

      {editingCurrent && currentFolder && (
        <GroupEditForm
          group={currentFolder}
          groups={allGroups}
          members={allMembers}
          onDone={() => setEditingCurrent(false)}
          onCancel={() => setEditingCurrent(false)}
        />
      )}

      {editingChildGroup && (
        <GroupEditForm
          group={editingChildGroup}
          groups={allGroups}
          members={allMembers}
          onDone={() => setEditingChildId(null)}
          onCancel={() => setEditingChildId(null)}
        />
      )}

      {deleteError && <p className="error-message">{deleteError}</p>}

      {visibleChildGroups.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p className="team-section-title">Groupes</p>
          <div className="team-folder-grid">
            {visibleChildGroups.map((group) => {
              const canManageThis = isAdmin || group.creatorId === currentAgentId;
              const childCount = allGroups.filter((g) => g.parentId === group.id).length;
              return (
                <GroupTile
                  key={group.id}
                  group={group}
                  childCount={childCount}
                  canManageThis={canManageThis}
                  onOpen={() => goToFolder(group.id)}
                  onEdit={() => setEditingChildId(group.id)}
                  onDelete={() => handleDelete(group, () => router.refresh())}
                  deleting={deletingId === group.id}
                />
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <p className="team-section-title">{folderId === null ? "Sans groupe" : "Membres"}</p>
        {agentsHere.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-muted)", fontStyle: "italic" }}>
            {folderId === null ? "Tout le monde appartient déjà à un groupe." : "Ce groupe n'a aucun membre direct."}
          </p>
        ) : (
          <div className="team-grid">
            {agentsHere.map((member) => (
              <TeamCard
                key={member.id}
                agent={member}
                isMe={member.userId === currentUserId}
                canManage={member.canManage}
                canDelete={member.canDelete}
                canGrantSubscriptionManager={member.canGrantSubscriptionManager}
                canManageAccount={member.canManageAccount}
              />
            ))}
          </div>
        )}
      </div>

      {canCreateGroup && (
        <form id="add-group-form" onSubmit={handleCreate} className="card scroll-target">
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700 }}>
            {folderId === null ? "Créer un groupe" : "Créer un sous-groupe"}
          </p>
          <div style={{ marginBottom: 10 }}>
            <input
              placeholder="Nom du groupe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
              disabled={createLoading}
            />
          </div>

          <LeaderSelect
            idPrefix="new-group"
            members={allMembers}
            leaderId={leaderId}
            onChange={handleNewLeaderChange}
            disabled={createLoading}
          />

          <div style={{ marginBottom: 10 }}>
            <label
              style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 5 }}
            >
              Membres
            </label>
            <MemberCheckboxes members={allMembers} selectedIds={memberIds} onToggle={toggleNewMember} disabled={createLoading} />
          </div>
          {createError && <p className="error-message">{createError}</p>}
          <button type="submit" className="button" disabled={createLoading}>
            {createLoading ? "Création..." : folderId === null ? "Créer le groupe" : "Créer le sous-groupe"}
          </button>
        </form>
      )}
    </div>
  );
}
