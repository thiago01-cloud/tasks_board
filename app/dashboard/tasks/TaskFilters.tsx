"use client";

import { usePathname } from "next/navigation";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/enums";
import { useTaskFilterNavigate, TASK_FILTERS_STORAGE_KEY } from "./TaskNavigation";

type Member = { id: string; name: string };
type Group = { id: string; name: string };

// The three filter dropdowns above the board (assigné, priorité, groupe).
// Each one is just its own query param (?assignee=, ?priority=, ?group=) —
// page.tsx does the actual filtering server-side, this component only
// edits the URL. The "assigné" dropdown carries three kinds of value
// under one param: a specific agent id, the sentinel "created" for
// "Créé par moi", or the sentinel "all" for "Tous les membres" — that
// last one deliberately isn't "" (empty), because "" would be
// indistinguishable from the param being absent altogether, and page.tsx
// treats "absent" as "nothing chosen yet, run the smart default cascade".
// Picking "Tous les membres" has to write a real, present value or it
// would keep getting silently overridden back to "Moi"/"Créé par moi" by
// that cascade. No sentinel is needed for "Moi" — its value is just the
// signed-in agent's own id, same as any other member's option.
//
// `filters` always reflects what's ACTUALLY being shown, not just what's
// literally in the URL — including page.tsx's own default (nothing
// picked yet, so it fell back to "assigned to me", "created by me", or
// everyone). setParam() below builds the next URL from these effective
// values rather than from the current query string, so changing one
// dropdown (say, priorité) carries the other two's current — possibly
// still-implicit — values along with it instead of silently dropping
// them. That's what keeps the board and the dropdowns from ever
// disagreeing about what's on screen.
export default function TaskFilters({
  currentAgentId,
  members,
  groups,
  filters,
}: {
  currentAgentId: string | null;
  members: Member[];
  groups: Group[];
  filters: { assignee: string; priority: string; group: string; status: string };
}) {
  const pathname = usePathname();
  // Routed through TaskNavigationProvider (see page.tsx) instead of
  // useRouter() directly, so the same navigation drives the loading ring
  // next to the "Tâches" title.
  const navigate = useTaskFilterNavigate();

  function setParam(key: keyof typeof filters, value: string) {
    const next = { ...filters, [key]: value };
    const params = new URLSearchParams();
    if (next.assignee) params.set("assignee", next.assignee);
    if (next.priority) params.set("priority", next.priority);
    if (next.group) params.set("group", next.group);
    if (next.status) params.set("status", next.status);
    const qs = params.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  }

  // "Lorsqu'on change le filtre des membres... on réinitialise
  // automatiquement les filtres" — switching WHO you're looking at (my
  // tasks vs. someone else's, vs. everyone) changes what the other three
  // dropdowns even mean, so unlike setParam() above (which deliberately
  // carries the other dimensions along), this one drops priority/group/
  // status entirely rather than merging them into the new URL.
  function setAssignee(value: string) {
    const params = new URLSearchParams();
    if (value) params.set("assignee", value);
    const qs = params.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  }

  // "all" is assigné's own neutral value (see the comment above) — it
  // must NOT count as an active filter, or the reset button would show
  // permanently as soon as the cascade (or an explicit pick) lands there.
  const hasFilters =
    (!!filters.assignee && filters.assignee !== "all") || !!filters.priority || !!filters.group || !!filters.status;
  const otherMembers = members.filter((m) => m.id !== currentAgentId);

  // "Réinitialiser" also forgets the remembered filters (see FilterMemory
  // in TaskNavigation.tsx) — otherwise the very next bare visit to this
  // page would immediately restore the filters you just deliberately
  // cleared, making the button look like it didn't do anything.
  function handleReset() {
    try {
      window.localStorage.removeItem(TASK_FILTERS_STORAGE_KEY);
    } catch {
      // Private browsing / storage disabled — nothing to clear.
    }
    navigate(pathname);
  }

  return (
    <div className="task-filters">
      <select
        className="task-filter-select"
        aria-label="Filtrer par membre assigné"
        value={filters.assignee}
        onChange={(e) => setAssignee(e.target.value)}
      >
        <option value="all">Tous les membres</option>
        {currentAgentId && <option value={currentAgentId}>Moi</option>}
        {currentAgentId && <option value="created">Créé par moi</option>}
        {otherMembers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <select
        className="task-filter-select"
        aria-label="Filtrer par priorité"
        value={filters.priority}
        onChange={(e) => setParam("priority", e.target.value)}
      >
        <option value="">Toutes priorités</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {TASK_PRIORITY_LABELS[p]}
          </option>
        ))}
      </select>

      <select
        className="task-filter-select"
        aria-label="Filtrer par groupe"
        value={filters.group}
        onChange={(e) => setParam("group", e.target.value)}
      >
        <option value="">Tous les groupes</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      <select
        className="task-filter-select"
        aria-label="Filtrer par statut"
        value={filters.status}
        onChange={(e) => setParam("status", e.target.value)}
      >
        <option value="">Tous les statuts</option>
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === "TO_VALIDATE" ? "En attente de validation" : TASK_STATUS_LABELS[s]}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button type="button" className="task-filter-reset" onClick={handleReset}>
          Réinitialiser
        </button>
      )}
    </div>
  );
}
