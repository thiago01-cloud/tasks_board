import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/enums";
import CircularProgress, { progressColor } from "./tasks/CircularProgress";
import StatusIcon from "./StatusIcon";

// Same inline-SVG, single-stroke convention as StatusIcon — for the two
// stat cards that aren't a task status (see the first stat grid below).
function OverdueIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5 21.5 19.5H2.5z" />
      <path d="M12 9.5v4" />
      <path d="M12 16.2v.01" />
    </svg>
  );
}

function NewThisWeekIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v4M16 3v4" />
      <path d="M12 13v5M9.5 15.5h5" />
    </svg>
  );
}

export default async function DashboardPage() {
  const agent = await getCurrentAgent();
  // Rare case: the session cookie is still a valid token, but the agent,
  // company, or user it points at was deleted in the meantime (see
  // dashboard/layout.tsx's own guard, which normally catches this first —
  // this one is a defensive fallback for when this page's own data fetch
  // resolves before that redirect takes effect).
  if (!agent) redirect("/login");
  const companyId = agent.companyId;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [statusCounts, priorityCounts, myOpenCount, overdueCount, createdThisWeek, avgProgress, doneWithDeadline, members, groupCount, tasksWithGroups] =
    await Promise.all([
      prisma.task.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
      prisma.task.groupBy({ by: ["priority"], where: { companyId }, _count: { _all: true } }),
      prisma.task.count({
        where: {
          companyId,
          status: { not: "DONE" },
          assignments: { some: { agentId: agent!.id ?? "" } },
        },
      }),
      prisma.task.count({
        where: { companyId, status: { not: "DONE" }, dueDate: { lt: new Date() } },
      }),
      prisma.task.count({ where: { companyId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.task.aggregate({ where: { companyId, status: "IN_PROGRESS" }, _avg: { progress: true } }),
      // For "Taux d'efficience" below: only DONE tasks that actually had a
      // deadline can be judged on-time or late — same "completedAt vs
      // dueDate" comparison TaskDetail.tsx already shows per task (see its
      // own "Performance" field), just aggregated here across the company.
      prisma.task.findMany({
        where: { companyId, status: "DONE", dueDate: { not: null }, completedAt: { not: null } },
        select: { dueDate: true, completedAt: true },
      }),
      // One row per team member, carrying every assignment's task id +
      // status — enough to derive the open-task count and completion rate
      // below, per member.
      prisma.agent.findMany({
        where: { companyId },
        orderBy: { joinedAt: "asc" },
        include: {
          user: { select: { firstName: true, lastName: true } },
          assignments: { select: { taskId: true, task: { select: { status: true } } } },
        },
      }),
      prisma.group.count({ where: { companyId } }),
      // For "Avancement par groupe" below: each task's own explicitly
      // assigned groups (Task.assignedGroups) — NOT inferred from its
      // individual assignees' group membership. Assigning a task to every
      // member of a group one by one doesn't link it to that group; only
      // picking the group itself (its chip in AssigneePicker) does.
      prisma.task.findMany({
        where: { companyId },
        select: { status: true, assignedGroups: { select: { id: true, name: true } } },
      }),
    ]);

  const countByStatus: Record<string, number> = {};
  for (const row of statusCounts) countByStatus[row.status] = row._count._all;
  const total = statusCounts.reduce((sum, row) => sum + row._count._all, 0);

  const countByPriority: Record<string, number> = {};
  for (const row of priorityCounts) countByPriority[row.priority] = row._count._all;

  const completionRate = total > 0 ? Math.round(((countByStatus.DONE || 0) / total) * 100) : 0;
  const inProgressCount = countByStatus.IN_PROGRESS || 0;
  const avgInProgress = avgProgress._avg.progress != null ? Math.round(avgProgress._avg.progress) : 0;

  // Taux de retard: share of currently OPEN tasks (not yet DONE) that are
  // already overdue — a leading indicator, unlike completionRate above.
  const openCount = total - (countByStatus.DONE || 0);
  const overdueRate = openCount > 0 ? Math.round((overdueCount / openCount) * 100) : 0;

  // Taux d'efficience: of the DONE tasks that had a deadline, the share
  // finished on time or early (completedAt <= dueDate) — the same
  // per-task "À l'heure / En retard / En avance" comparison TaskDetail.tsx
  // shows, aggregated. null (not 0) when there's no such task yet, so the
  // card can show "—" instead of a misleading 0%.
  const onTimeCount = doneWithDeadline.filter(
    (t) => new Date(t.completedAt!).getTime() <= new Date(t.dueDate!).getTime()
  ).length;
  const efficiencyRate =
    doneWithDeadline.length > 0 ? Math.round((onTimeCount / doneWithDeadline.length) * 100) : null;

  // Per-member: open-task count (for the workload bar) + completion rate
  // (done / total assigned) for the new "avancement par membre" list.
  const memberStats = members.map((m) => {
    const totalAssigned = m.assignments.length;
    const doneAssigned = m.assignments.filter((a) => a.task.status === "DONE").length;
    return {
      id: m.id,
      name: `${m.user.firstName} ${m.user.lastName}`,
      openCount: totalAssigned - doneAssigned,
      totalAssigned,
      completionRate: totalAssigned > 0 ? Math.round((doneAssigned / totalAssigned) * 100) : null,
    };
  });

  // Per-group: only tasks that group was itself explicitly assigned to
  // (see Task.assignedGroups) — not every task any of its members happens
  // to be individually assigned. A task can carry several groups at once,
  // so it feeds every one of them; a "Sans groupe" bucket covers tasks
  // with no group assigned at all.
  const groupBuckets = new Map<string, { name: string; statuses: string[] }>();
  for (const t of tasksWithGroups) {
    const taskGroups = t.assignedGroups.length > 0 ? t.assignedGroups : [{ id: "", name: "Sans groupe" }];
    for (const g of taskGroups) {
      if (!groupBuckets.has(g.id)) groupBuckets.set(g.id, { name: g.name, statuses: [] });
      groupBuckets.get(g.id)!.statuses.push(t.status);
    }
  }
  const groupStats = Array.from(groupBuckets.entries())
    .map(([key, bucket]) => {
      const doneCount = bucket.statuses.filter((s) => s === "DONE").length;
      return {
        key,
        name: bucket.name,
        total: bucket.statuses.length,
        completionRate: bucket.statuses.length > 0 ? Math.round((doneCount / bucket.statuses.length) * 100) : null,
      };
    })
    // "Sans groupe" always last, otherwise alphabetical.
    .sort((a, b) => (a.key === "" ? 1 : b.key === "" ? -1 : a.name.localeCompare(b.name)));

  const statTitleStyle: CSSProperties = {
    margin: "0 0 4px",
    fontSize: 12.5,
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  };

  return (
    <div>
      <div className="page-header">
        <h1>Bienvenue, {agent?.firstName}</h1>
      </div>

      <div className="field-grid field-grid-4" style={{ marginBottom: 20 }}>
        {TASK_STATUSES.map((status) => (
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }} key={status}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: TASK_STATUS_COLORS[status],
                background: `color-mix(in srgb, ${TASK_STATUS_COLORS[status]} 14%, transparent)`,
              }}
            >
              <StatusIcon status={status} />
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={statTitleStyle}>{TASK_STATUS_LABELS[status]}</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{countByStatus[status] || 0}</p>
            </div>
          </div>
        ))}

        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderColor: overdueCount > 0 ? "var(--color-danger)" : undefined,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "var(--color-danger)",
              background: "color-mix(in srgb, var(--color-danger) 14%, transparent)",
            }}
          >
            <OverdueIcon />
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={statTitleStyle}>En retard</p>
            <p
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 700,
                color: overdueCount > 0 ? "var(--color-danger)" : undefined,
              }}
            >
              {overdueCount}
            </p>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "var(--color-primary)",
              background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
            }}
          >
            <NewThisWeekIcon />
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={statTitleStyle}>Créées cette semaine</p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{createdThisWeek}</p>
          </div>
        </div>
      </div>

      {total > 0 && (
        <>
          <div className="field-grid field-grid-4" style={{ marginBottom: 20 }}>
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <CircularProgress value={completionRate} size={54} strokeWidth={5} showLabel />
              <div style={{ textAlign: "right" }}>
                <p style={statTitleStyle}>Taux de complétion</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                  {countByStatus.DONE || 0} / {total} tâches
                </p>
              </div>
            </div>

            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {inProgressCount > 0 ? (
                <CircularProgress value={avgInProgress} size={54} strokeWidth={5} showLabel />
              ) : (
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    border: "3px solid var(--color-border)",
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ textAlign: "right" }}>
                <p style={statTitleStyle}>Avancement moyen</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                  {inProgressCount > 0
                    ? `${inProgressCount} tâche${inProgressCount > 1 ? "s" : ""} en cours`
                    : "Aucune tâche en cours"}
                </p>
              </div>
            </div>

            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <CircularProgress value={overdueRate} size={54} strokeWidth={5} showLabel invertColor />
              <div style={{ textAlign: "right" }}>
                <p style={statTitleStyle}>Taux de retard</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                  {overdueCount} / {openCount} tâche{openCount > 1 ? "s" : ""} ouverte{openCount > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {efficiencyRate != null ? (
                <CircularProgress value={efficiencyRate} size={54} strokeWidth={5} showLabel />
              ) : (
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    border: "3px solid var(--color-border)",
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ textAlign: "right" }}>
                <p style={statTitleStyle}>Taux d&apos;efficience</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                  {efficiencyRate != null
                    ? `${onTimeCount} / ${doneWithDeadline.length} tâche${doneWithDeadline.length > 1 ? "s" : ""} à l'heure`
                    : "Aucune tâche terminée avec échéance"}
                </p>
              </div>
            </div>
          </div>

          <div className="field-grid field-grid-2" style={{ marginBottom: 20 }}>
            <div className="card">
              <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700 }}>Répartition par priorité</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {TASK_PRIORITIES.map((priority) => {
                  const count = countByPriority[priority] || 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={priority} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        className="badge"
                        style={{
                          color: TASK_PRIORITY_COLORS[priority],
                          borderColor: TASK_PRIORITY_COLORS[priority],
                          minWidth: 64,
                          textAlign: "center",
                        }}
                      >
                        {TASK_PRIORITY_LABELS[priority]}
                      </span>
                      <div className="progress-bar-track">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${pct}%`, background: TASK_PRIORITY_COLORS[priority] }}
                        />
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--color-text-muted)", minWidth: 24, textAlign: "right" }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {memberStats.length > 1 && (
              <div className="card">
                <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700 }}>Avancement par membre</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {memberStats.map((m) => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          fontSize: 13,
                          minWidth: 100,
                          color: "var(--color-text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={m.name}
                      >
                        {m.name}
                      </span>
                      <div className="progress-bar-track">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${m.completionRate ?? 0}%`,
                            background: m.completionRate != null ? progressColor(m.completionRate) : "var(--color-border)",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--color-text-muted)", minWidth: 34, textAlign: "right" }}>
                        {m.completionRate != null ? `${m.completionRate}%` : "—"}
                      </span>
                      <span
                        className="badge"
                        style={{ minWidth: 96, textAlign: "center" }}
                        title="Nombre de tâches assignées à cette personne qui ne sont pas encore terminées"
                      >
                        {m.openCount} tâche{m.openCount > 1 ? "s" : ""} en attente
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {groupCount > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700 }}>Avancement par groupe</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {groupStats.map((g) => (
                  <div key={g.key || "none"} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        fontSize: 13,
                        minWidth: 140,
                        color: g.key === "" ? "var(--color-text-muted)" : "var(--color-text)",
                        fontStyle: g.key === "" ? "italic" : "normal",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={g.name}
                    >
                      {g.name}
                    </span>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${g.completionRate ?? 0}%`,
                          background: g.completionRate != null ? progressColor(g.completionRate) : "var(--color-border)",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12.5, color: "var(--color-text-muted)", minWidth: 34, textAlign: "right" }}>
                      {g.completionRate != null ? `${g.completionRate}%` : "—"}
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--color-text-muted)", minWidth: 60, textAlign: "right" }}>
                      {g.total} tâche{g.total > 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="card">
        {total === 0 && (agent!.role === "ADMIN" || agent!.role === "MANAGER") && (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Aucune tâche pour l&apos;instant.{" "}
            <Link href="/dashboard/tasks/new" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
              Créez la première
            </Link>
            .
          </p>
        )}
        {total === 0 && agent!.role !== "ADMIN" && agent!.role !== "MANAGER" && (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Aucune tâche pour l&apos;instant. Un administrateur ou un manager doit d&apos;abord en créer une.
          </p>
        )}
        {total > 0 && (
          <p style={{ margin: 0 }}>
            {myOpenCount > 0
              ? `Vous avez ${myOpenCount} tâche${myOpenCount > 1 ? "s" : ""} en cours qui vous ${myOpenCount > 1 ? "sont" : "est"} assignée${myOpenCount > 1 ? "s" : ""}.`
              : "Aucune tâche en cours ne vous est assignée."}{" "}
            <Link href="/dashboard/tasks" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
              Voir le tableau des tâches
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
