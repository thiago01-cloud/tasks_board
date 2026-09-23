import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgentEnsured } from "@/lib/auth";
import { equalWeights, computeProgress } from "@/lib/subtasks";

async function loadTaskWithSubtasks(taskId: string, companyId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignments: { select: { agentId: true } },
      subtasks: { orderBy: { order: "asc" } },
    },
  });
  if (!task || task.companyId !== companyId) return null;
  return task;
}

// Toggles a subtask done/not-done, or renames it. A done toggle always
// moves the parent task's progress; a rename never does — either way the
// new progress is recomputed and diffed against the task's previous value
// before deciding whether to notify, same principle as PATCH
// /api/tasks/[id] uses for its own fields (never notify on a no-op save).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  try {
    const { id, subtaskId } = await params;
    const task = await loadTaskWithSubtasks(id, agent!.companyId);
    if (!task) {
      return NextResponse.json({ error: "Tâche introuvable." }, { status: 404 });
    }

    const subtask = task.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) {
      return NextResponse.json({ error: "Sous-tâche introuvable." }, { status: 404 });
    }

    const canManage = agent!.role !== "MEMBER" || task.creatorId === agent!.id;
    const isAssignee = task.assignments.some((a) => a.agentId === agent!.id);
    if (!canManage && !isAssignee) {
      return NextResponse.json(
        { error: "Seuls le créateur, un assigné ou un admin/manager peuvent modifier les sous-tâches." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (body.done !== undefined) data.done = Boolean(body.done);
    if (body.title !== undefined) {
      const title = String(body.title || "").trim();
      if (!title) {
        return NextResponse.json({ error: "Le titre de la sous-tâche est requis." }, { status: 400 });
      }
      data.title = title;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Rien à mettre à jour." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.subtask.update({ where: { id: subtaskId }, data });

      const nextSubtasks = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...data } : s));
      const nextProgress = computeProgress(nextSubtasks);
      if (nextProgress !== task.progress) {
        await tx.task.update({ where: { id }, data: { progress: nextProgress } });

        const recipients = new Set(task.assignments.map((a) => a.agentId));
        recipients.add(task.creatorId);
        recipients.delete(agent!.id);
        if (recipients.size > 0) {
          await tx.notification.createMany({
            data: [...recipients].map((agentId) => ({ agentId, type: "TASK_PROGRESS_UPDATED", taskId: id })),
          });
        }
      }

      return tx.subtask.findMany({ where: { taskId: id }, orderBy: { order: "asc" } });
    });

    return NextResponse.json({ subtasks: result });
  } catch (err) {
    console.error("PATCH /api/tasks/[id]/subtasks/[subtaskId] failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}

// Deletes a subtask and rebalances the remaining ones back to an equal
// split — see POST /api/tasks/[id]/subtasks's comment for why a reset
// rather than a proportional rescale.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  try {
    const { id, subtaskId } = await params;
    const task = await loadTaskWithSubtasks(id, agent!.companyId);
    if (!task) {
      return NextResponse.json({ error: "Tâche introuvable." }, { status: 404 });
    }

    const subtask = task.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) {
      return NextResponse.json({ error: "Sous-tâche introuvable." }, { status: 404 });
    }

    const canManage = agent!.role !== "MEMBER" || task.creatorId === agent!.id;
    const isAssignee = task.assignments.some((a) => a.agentId === agent!.id);
    if (!canManage && !isAssignee) {
      return NextResponse.json(
        { error: "Seuls le créateur, un assigné ou un admin/manager peuvent supprimer des sous-tâches." },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.subtask.delete({ where: { id: subtaskId } });

      const remaining = task.subtasks.filter((s) => s.id !== subtaskId);
      const weights = equalWeights(remaining.length);
      await Promise.all(
        remaining.map((s, i) => tx.subtask.update({ where: { id: s.id }, data: { weight: weights[i] } }))
      );

      const nextProgress = computeProgress(remaining.map((s, i) => ({ weight: weights[i], done: s.done })));
      if (nextProgress !== task.progress) {
        await tx.task.update({ where: { id }, data: { progress: nextProgress } });

        const recipients = new Set(task.assignments.map((a) => a.agentId));
        recipients.add(task.creatorId);
        recipients.delete(agent!.id);
        if (recipients.size > 0) {
          await tx.notification.createMany({
            data: [...recipients].map((agentId) => ({ agentId, type: "TASK_PROGRESS_UPDATED", taskId: id })),
          });
        }
      }

      return tx.subtask.findMany({ where: { taskId: id }, orderBy: { order: "asc" } });
    });

    return NextResponse.json({ subtasks: result });
  } catch (err) {
    console.error("DELETE /api/tasks/[id]/subtasks/[subtaskId] failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}
