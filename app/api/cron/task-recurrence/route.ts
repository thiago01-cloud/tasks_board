import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { catchUpRecurrenceDate } from "@/lib/recurrence";
import { sendPushToAgents, pushPayloadForTask } from "@/lib/push";

// Cron job (see vercel.json's `crons` entry) — resets every recurring
// task ("tâches répétitives" — see Task.isRecurring in schema.prisma)
// whose `dueDate` has been reached: back to TODO/0%, its subtasks (if
// any) all unchecked, and `dueDate` moved forward to its next occurrence
// (see catchUpRecurrenceDate in lib/recurrence.ts). Runs regardless of the
// task's current status — a recurring task always comes back on its fixed
// schedule rather than staying stuck wherever it was left (see the
// isRecurring field's own comment in schema.prisma for the reasoning).
//
// Separate cron entry from app/api/cron/task-alerts (which only reads
// tasks, never resets them) rather than folding this into that one route —
// keeps each job's failure/retry independent, and Vercel's Hobby plan
// allows up to 100 cron jobs per project, each capped at once/day, which
// this and task-alerts both already respect.
//
// Protected by CRON_SECRET the same way as task-alerts — see that route's
// own comment.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: { isRecurring: true, dueDate: { lte: now } },
    include: {
      assignments: { select: { agentId: true } },
      subtasks: { select: { id: true } },
    },
  });

  let resetCount = 0;

  for (const task of tasks) {
    const nextDueDate = catchUpRecurrenceDate(task.dueDate!, now, task);
    // An invalid/incomplete recurrence config (shouldn't normally happen —
    // the API routes validate it on the way in) — leave the task alone
    // rather than reset it to a date that doesn't mean anything.
    if (!nextDueDate) {
      console.error(`Tâche récurrente ${task.id} : configuration de récurrence invalide, ignorée.`);
      continue;
    }

    const recipients = new Set(task.assignments.map((a) => a.agentId));
    recipients.add(task.creatorId);

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: task.id },
        data: {
          status: "TODO",
          progress: 0,
          completedAt: null,
          dueDate: nextDueDate,
        },
      });
      if (task.subtasks.length > 0) {
        await tx.subtask.updateMany({ where: { taskId: task.id }, data: { done: false } });
      }
      if (recipients.size > 0) {
        await tx.notification.createMany({
          data: [...recipients].map((agentId) => ({ agentId, type: "TASK_RECURRENCE_RESET", taskId: task.id })),
        });
      }
    });

    resetCount += 1;

    if (recipients.size > 0) {
      await sendPushToAgents(recipients, pushPayloadForTask("TASK_RECURRENCE_RESET", task));
    }
  }

  return NextResponse.json({ ok: true, resetCount });
}
