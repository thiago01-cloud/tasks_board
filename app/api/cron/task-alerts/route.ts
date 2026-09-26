import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTaskAlertEmail } from "@/lib/email";

// Cron job (see vercel.json's `crons` entry) — checks every task that
// still has a due date and isn't DONE for whether it has just crossed the
// 50% or 2/3 mark of its "temps imparti" (allotted time = échéance -
// création, the same creation→due-date convention already used by
// TaskDetail.tsx's "Performance" readout on a finished task), and, the
// first time it does, notifies everyone linked to it — its creator and
// every assignee — both in-app (NotificationBell.tsx picks up the new
// types automatically via lib/enums.ts) and by email.
//
// Protected by CRON_SECRET (see .env.example): Vercel's own Cron sends
// this bearer token automatically for routes it triggers, matching the
// value set in the project's environment variables — without it (e.g. in
// local dev, where CRON_SECRET is normally left unset) the check is
// skipped so this stays easy to hit by hand while testing.
const THRESHOLDS: { type: string; ratio: number; label: string }[] = [
  { type: "TASK_HALF_TIME_ELAPSED", ratio: 0.5, label: "la moitié" },
  { type: "TASK_TWO_THIRDS_TIME_ELAPSED", ratio: 2 / 3, label: "les deux tiers" },
];

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  const origin = new URL(request.url).origin;
  const now = Date.now();

  const tasks = await prisma.task.findMany({
    where: { dueDate: { not: null }, status: { not: "DONE" } },
    select: {
      id: true,
      title: true,
      dueDate: true,
      createdAt: true,
      creatorId: true,
      creator: { select: { user: { select: { firstName: true, email: true } } } },
      assignments: {
        select: { agent: { select: { id: true, user: { select: { firstName: true, email: true } } } } },
      },
    },
  });

  let notificationsCreated = 0;

  for (const task of tasks) {
    const createdAt = task.createdAt.getTime();
    const due = task.dueDate!.getTime();
    const total = due - createdAt;
    // Malformed/edge data (a due date at or before creation) — nothing
    // meaningful to compute a percentage-elapsed against.
    if (total <= 0) continue;
    const ratio = (now - createdAt) / total;

    const reached = THRESHOLDS.filter((t) => ratio >= t.ratio);
    if (reached.length === 0) continue;

    // Recipients: every assignee + the creator, de-duplicated (the
    // creator may also be an assignee) — same set PATCH /api/tasks/[id]
    // notifies on a status/progress/edit change.
    const recipients = new Map<string, { firstName: string; email: string | null }>();
    for (const a of task.assignments) {
      recipients.set(a.agent.id, { firstName: a.agent.user.firstName, email: a.agent.user.email });
    }
    recipients.set(task.creatorId, { firstName: task.creator.user.firstName, email: task.creator.user.email });

    for (const threshold of reached) {
      // Dedup: the cron runs on a schedule, so once a task has crossed a
      // threshold, every later run sees the same (or a further-elapsed)
      // ratio again — only fire the first time. The whole recipient set
      // is always notified together, so "does any notification of this
      // type already exist for this task" is enough to know it already
      // went out, without tracking per-recipient state.
      const already = await prisma.notification.findFirst({
        where: { taskId: task.id, type: threshold.type },
        select: { id: true },
      });
      if (already) continue;

      await prisma.notification.createMany({
        data: [...recipients.keys()].map((agentId) => ({ agentId, type: threshold.type, taskId: task.id })),
      });
      notificationsCreated += recipients.size;

      const taskUrl = `${origin}/dashboard/tasks/${task.id}`;
      for (const info of recipients.values()) {
        if (!info.email) continue;
        await sendTaskAlertEmail({
          to: info.email,
          firstName: info.firstName,
          taskTitle: task.title,
          taskUrl,
          thresholdLabel: threshold.label,
          dueDateIso: task.dueDate!.toISOString(),
        });
      }
    }
  }

  return NextResponse.json({ ok: true, notificationsCreated });
}
