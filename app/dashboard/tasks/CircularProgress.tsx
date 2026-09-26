// Color band for a 0-100 progress value — reused by the ring below, the
// mirrored linear bar and the slider's live value in TaskDetail.tsx, so
// the same percentage always reads the same color everywhere: barely
// started reads as a warning (red), well underway settles into the app's
// own blue, and essentially done reads as success (green).
export function progressColor(value: number): string {
  const clamped = Math.min(100, Math.max(0, value));
  if (clamped < 25) return "var(--color-danger)";
  if (clamped < 50) return "var(--color-accent)";
  if (clamped < 75) return "var(--color-primary)";
  return "var(--color-success)";
}

// Small SVG ring showing a 0-100 progress value. Used right next to a
// task's title wherever it's shown "in progress" — the board card and the
// detail page header — so the completion level is visible at a glance
// without opening the editable slider (see TaskDetail.tsx) to check it.
export default function CircularProgress({
  value,
  size = 20,
  strokeWidth = 3,
  showLabel = false,
  invertColor = false,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  // For a rate where LOWER is better (e.g. "Taux de retard" on the
  // dashboard) — the ring still fills to the real `value` and the label
  // still shows the real percentage, only the color band flips, so a high
  // rate reads as a warning instead of misleadingly as success.
  invertColor?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;
  const color = progressColor(invertColor ? 100 - clamped : clamped);

  return (
    <span
      className="circular-progress"
      style={{ width: size, height: size }}
      title={`${clamped}% d'avancement`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {showLabel && (
        <span className="circular-progress-label" style={{ fontSize: Math.max(9, size * 0.26), color }}>
          {clamped}%
        </span>
      )}
    </span>
  );
}
