"use client";

export type MemberOption = { id: string; firstName: string; lastName: string };
export type GroupOption = { id: string; name: string; memberIds: string[] };

// A task is only linked to a group when the group itself was assigned —
// not merely because the individually-picked agents happen to all belong
// to it. In this UI, "the group was assigned" and "every one of its
// members is selected" are the same thing (that's exactly what lights up
// a group chip as active — see toggleGroup below), so the caller derives
// the groupIds to submit with this one rule, kept here so the form and
// the chip's own "active" state can never disagree.
export function fullyAssignedGroupIds(groups: GroupOption[], selectedIds: string[]): string[] {
  return groups
    .filter((g) => g.memberIds.length > 0 && g.memberIds.every((id) => selectedIds.includes(id)))
    .map((g) => g.id);
}

// Small inline icons (no external icon library) — a single silhouette for
// an individual member chip, two overlapping silhouettes for a group chip.
// stroke="currentColor" so they inherit the chip's text color automatically
// (white when active, the muted chip color otherwise). Exported so the
// task detail's read-only "Assignée à" display (TaskDetail.tsx) can reuse
// the exact same chip look instead of duplicating the SVGs.
export function UserIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function GroupIcon() {
  return (
    <svg
      width="14"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M13.5 3.13a4 4 0 0 1 0 7.75" />
      <path d="M13 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="7" cy="7" r="4" />
    </svg>
  );
}

// Lets a task be assigned to individual agents and/or, as a shortcut, to
// a whole group at once. Used by both the new-task form and the task
// detail's edit panel — replaces the old plain checkbox list (native
// checkboxes rendered oddly cramped once the row had to fit a group
// selector too, and didn't scale well to many members) with a grid of
// toggle "chips", which also gives room for the group row above it.
export default function AssigneePicker({
  members = [],
  groups = [],
  selectedIds = [],
  onChange,
  disabled,
}: {
  members?: MemberOption[];
  groups?: GroupOption[];
  selectedIds?: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  function toggleMember(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((a) => a !== id) : [...selectedIds, id]);
  }

  // A group chip reads as "active" once every one of its members is
  // currently selected. Clicking it adds the whole group in one go if it
  // wasn't fully selected yet, or removes the whole group if it was —
  // a quick way to assign/unassign a team on top of picking members one
  // by one below.
  function toggleGroup(group: GroupOption) {
    const allSelected = group.memberIds.length > 0 && group.memberIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter((id) => !group.memberIds.includes(id)));
    } else {
      const next = new Set(selectedIds);
      for (const id of group.memberIds) next.add(id);
      onChange(Array.from(next));
    }
  }

  if (members.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
        Aucun autre membre dans l&apos;équipe pour l&apos;instant.
      </p>
    );
  }

  return (
    <div>
      {groups.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {groups.map((g) => {
            const active = g.memberIds.length > 0 && g.memberIds.every((id) => selectedIds.includes(id));
            return (
              <button
                type="button"
                key={g.id}
                onClick={() => toggleGroup(g)}
                disabled={disabled || g.memberIds.length === 0}
                className="assignee-chip assignee-chip-group"
                data-active={active ? "true" : undefined}
                title={`${g.memberIds.length} membre${g.memberIds.length > 1 ? "s" : ""} — clique pour ${active ? "retirer" : "assigner"} tout le groupe`}
              >
                <span className="assignee-chip-icon">
                  <GroupIcon />
                </span>
                {g.name}
                <span className="assignee-chip-count">{g.memberIds.length}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="assignee-grid">
        {members.map((m) => {
          const active = selectedIds.includes(m.id);
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => toggleMember(m.id)}
              disabled={disabled}
              className="assignee-chip"
              data-active={active ? "true" : undefined}
            >
              <span className="assignee-chip-icon">
                <UserIcon />
              </span>
              {m.firstName} {m.lastName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
