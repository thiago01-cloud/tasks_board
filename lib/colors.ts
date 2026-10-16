// Per-agent color ("chaque agent doit avoir une couleur", "les couleurs
// attribuées aux utilisateurs sont uniques") — used to tell teammates
// apart at a glance on avatars/initials circles (TeamCard.tsx,
// TeamMemberDetail.tsx, TaskCard.tsx's assignee avatar-stack).
//
// Uniqueness can only be guaranteed by looking at the whole company at
// once — a plain per-agent hash has no way to know what color anyone
// else already has — so this is a batch function, not a per-agent
// lookup: callers always run it over every agent in the company (or at
// least every agent that might show up alongside the ones being
// rendered) and read the result back out of the returned map.
//
// Agent.color (prisma/schema.prisma) is nullable and only set once
// someone actually chooses one (see PATCH /api/account/color, "Mon
// compte") — the database itself also enforces uniqueness among those
// explicit picks (`@@unique([companyId, color])`), so two agents can
// never both have the same STORED color. assignAgentColors() below is
// what additionally guarantees no two agents ever show the same color on
// screen, by deriving a free fallback for everyone who hasn't picked one
// yet.
const PALETTE = [
  "#2a3365", // navy (app's own primary)
  "#1a8a4c", // green
  "#b3261e", // red
  "#c2760c", // amber
  "#6d28d9", // violet
  "#0e7490", // teal
  "#be185d", // pink
  "#4d7c0f", // olive
  "#b45309", // orange
  "#1d4ed8", // blue
  "#047857", // emerald
  "#7c2d12", // brown
];

// Deterministic starting point (same agent id -> same first guess), so a
// teammate's fallback color stays as stable as possible across
// renders/sessions rather than jumping around for no reason.
function hashToIndex(id: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % size;
}

// Finds a color for `id` that isn't in `taken` yet: starts from the id's
// own deterministic palette slot and probes forward through the fixed
// palette. Once every palette color is already taken — a company with
// more agents than curated colors — falls back to generated hues spaced
// by the golden angle (~137.5°), which spreads any number of points
// around the hue wheel without repeating, so uniqueness holds even past
// the palette's size (those generated colors just won't appear as an
// option in the "Ma couleur" picker, which only ever offers the fixed
// palette — see ColorPickerCard.tsx).
function nextFreeColor(id: string, taken: ReadonlySet<string>): string {
  const size = PALETTE.length;
  const start = hashToIndex(id, size);
  for (let i = 0; i < size; i++) {
    const candidate = PALETTE[(start + i) % size];
    if (!taken.has(candidate)) return candidate;
  }
  let hue = hashToIndex(id, 360);
  let candidate = `hsl(${hue}, 55%, 38%)`;
  let guard = 0;
  while (taken.has(candidate) && guard < 1000) {
    hue = (hue + 137) % 360;
    candidate = `hsl(${hue}, 55%, 38%)`;
    guard++;
  }
  return candidate;
}

// Assigns every agent in `agents` a color, guaranteeing no two of them
// share one. Explicit picks (a non-null `color`) always win and are
// never reassigned; anyone without one gets the nearest free palette
// slot. Sorted by id first so the result is stable across calls for the
// same input set (important since the fallback half of this has no
// persistence of its own — it's recomputed on every call).
export function assignAgentColors<T extends { id: string; color?: string | null }>(
  agents: T[]
): Map<string, string> {
  const sorted = [...agents].sort((a, b) => a.id.localeCompare(b.id));
  const taken = new Set<string>();
  const result = new Map<string, string>();

  for (const agent of sorted) {
    if (agent.color && !taken.has(agent.color)) {
      taken.add(agent.color);
      result.set(agent.id, agent.color);
    }
  }

  for (const agent of sorted) {
    if (result.has(agent.id)) continue;
    const color = nextFreeColor(agent.id, taken);
    taken.add(color);
    result.set(agent.id, color);
  }

  return result;
}

export const AGENT_COLOR_PALETTE = PALETTE;
