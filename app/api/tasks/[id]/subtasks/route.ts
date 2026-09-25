import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgentEnsured } from "@/lib/auth";
import { equalWeights, computeProgress, taskUpdateForProgress, notificationTypeForProgress } from "@/lib/subtasks";

async function loadTaskWithSubtasks(id: string, companyId: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignments: { select: { agentId: true } },
      subtasks: { orderBy: { order: "asc" } },
    },
  });
  if (!task || task.companyId !== companyId) return null;
  return task;
}

// Adds a subtask to a task, then resets every subtask's weight (including
// the new one) to an equal split — see lib/subtasks.ts's equalWeights().
// Same tradeoff as removing one (DELETE in [subtaskId]/route.ts): simple
// and predictable rather than trying to preserve earlier manual
// proportions, which the agent can always redo via "Ajuster les
// pourcentages" (PATCH below) after the structure settles.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  try {
    const { id } = await params;
    const task = await loadTaskWithSubtasks(id, agent!.companyId);
    if (!task) {
      return NextResponse.json({ error: "Tâche introuvable." }, { status: 404 });
    }

    const canManage = agent!.role !== "MEMBER" || task.creatorId === agent!.id;
    const isAssignee = task.assignments.some((a) => a.agentId === agent!.id);
    if (!canManage && !isAssignee) {
      return NextResponse.json(
        { error: "Seuls le créateur, un assigné ou un admin/manager peuvent ajouter des sous-tâches." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Le titre de la sous-tâche est requis." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.subtask.create({
        data: { taskId: id, title, order: task.subtasks.length },
      });

      const all = [...task.subtasks, created];
      const weights = equalWeights(all.length);
      await Promise.all(
        all.map((s, i) => tx.subtask.update({ where: { id: s.id }, data: { weight: weights[i] } }))
      );

      const nextProgress = computeProgress(all.map((s, i) => ({ weight: weights[i], done: s.done })));
      if (nextProgress !== task.progress) {
        const update = taskUpdateForProgress(nextProgress, task.status);
        await tx.task.update({ where: { id }, data: update });

        const recipients = new Set(task.assignments.map((a) => a.agentId));
        recipients.add(task.creatorId);
        recipients.delete(agent!.id);
        if (recipients.size > 0) {
          await tx.notification.createMany({
            data: [...recipients].map((agentId) => ({ agentId, type: notificationTypeForProgress(update), taskId: id })),
          });
        }
      }

      return tx.subtask.findMany({ where: { taskId: id }, orderBy: { order: "asc" } });
    });

    return NextResponse.json({ subtasks: result }, { status: 201 });
  } catch (err) {
    console.error("POST /api/tasks/[id]/subtasks failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}

// Manual reweighting — the "Ajuster les pourcentages" panel. Replaces
// every subtask's weight at once (it's a full set, not a partial patch),
// and the new set must sum to exactly 100, same rule as the equal-split
// default.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  try {
    const { id } = await params;
    const task = await loadTaskWithSubtasks(id, agent!.companyId);
    if (!task) {
      return NextResponse.json({ error: "Tâche introuvable." }, { status: 404 });
    }

    const canManage = agent!.role !== "MEMBER" || task.creatorId === agent!.id;
    const isAssignee = task.assignments.some((a) => a.agentId === agent!.id);
    if (!canManage && !isAssignee) {
      return NextResponse.json(
        { error: "Seuls le créateur, un assigné ou un admin/manager peuvent modifier les pourcentages." },
        { status: 403 }
      );
    }

    if (task.subtasks.length === 0) {
      return NextResponse.json({ error: "Cette tâche n'a pas de sous-tâches." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const weights = body.weights;
    if (!weights || typeof weights !== "object") {
      return NextResponse.json({ error: "Pourcentages invalides." }, { status: 400 });
    }

    let total = 0;
    const parsed: Record<string, number> = {};
    for (const s of task.subtasks) {
      const value = Number((weights as Record<string, unknown>)[s.id]);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return NextResponse.json(
          { error: "Chaque pourcentage doit être un nombre entre 0 et 100." },
          { status: 400 }
        );
      }
      parsed[s.id] = Math.round(value);
      total += parsed[s.id];
    }
    if (total !== 100) {
      return NextResponse.json(
        { error: `Le total doit faire exactement 100% (actuellement ${total}%).` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await Promise.all(
        task.subtasks.map((s) => tx.subtask.update({ where: { id: s.id }, data: { weight: parsed[s.id] } }))
      );

      const nextProgress = computeProgress(task.subtasks.map((s) => ({ weight: parsed[s.id], done: s.done })));
      if (nextProgress !== task.progress) {
        const update = taskUpdateForProgress(nextProgress, task.status);
        await tx.task.update({ where: { id }, data: update });

        const recipients = new Set(task.assignments.map((a) => a.agentId));
        recipients.add(task.creatorId);
        recipients.delete(agent!.id);
        if (recipients.size > 0) {
          await tx.notification.createMany({
            data: [...recipients].map((agentId) => ({ agentId, type: notificationTypeForProgress(update), taskId: id })),
          });
        }
      }

      return tx.subtask.findMany({ where: { taskId: id }, orderBy: { order: "asc" } });
    });

    return NextResponse.json({ subtasks: result });
  } catch (err) {
    console.error("PATCH /api/tasks/[id]/subtasks failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}
