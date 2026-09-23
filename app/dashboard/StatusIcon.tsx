// Small outline icons for a task status — same inline-SVG, no-dependency
// convention as TaskCard's ChecklistIcon (stroke=currentColor, rounded
// caps). Used on the dashboard's status stat cards so they're not just
// bare numbers.
export default function StatusIcon({
  status,
  size = 22,
}: {
  status: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (status) {
    case "TODO":
      // Empty checklist circle: nothing started yet.
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      );
    case "IN_PROGRESS":
      // Clock: work under way.
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5v4.5l3 2" />
        </svg>
      );
    case "BLOCKED":
      // Octagon with a bar: stopped.
      return (
        <svg {...common}>
          <path d="M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7l5-5z" />
          <path d="M8.5 12h7" />
        </svg>
      );
    case "DONE":
      // Check circle: complete.
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.5 12.3l2.4 2.4 4.6-5" />
        </svg>
      );
    default:
      return null;
  }
}
