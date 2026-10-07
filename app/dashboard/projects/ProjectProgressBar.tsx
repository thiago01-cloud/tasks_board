import { progressColor } from "../tasks/CircularProgress";

// Small reusable progress bar for a project's computed progress (see
// computeProjectProgress in lib/projects.ts) — reuses the same track/fill
// CSS classes and color scale as a task's own progress bar
// (TaskDetail.tsx), just without the slider/editing behavior: a project's
// progress is never set by hand, only derived from its tasks.
export default function ProjectProgressBar({ progress }: { progress: number }) {
  return (
    <div>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${progress}%`, background: progressColor(progress) }} />
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>{progress}%</p>
    </div>
  );
}
