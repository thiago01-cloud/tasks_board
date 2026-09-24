import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgentEnsured, canValidateTask } from "@/lib/auth";

// The other half of task validation (see PATCH /api/tasks/[id]'s handling
// of `status: "DONE"`): whoever can validate a task that's currently
// TO_VALIDATE (its creator, or an admin fallback — see canValidateTask()
// in lib/auth.ts) can instead refuse it, which sends it back to
// IN_PROGRESS. Unlike validating, a reason is mandatory — it's stored as a
// regular comment on the task, visible in the same thread as everything
// else, and everyone linked to the task (creator + assignees, minus
// whoever just rejected it) gets notified.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignments: { select: { agentId: true } } },
    });
    if (!task || task.companyId !== agent!.companyId) {
      return NextResponse.json({ error: "Tâche introuvable." }, { status: 404 });
    }

    if (task.status !== "TO_VALIDATE") {
      return NextResponse.json(
        { error: "Cette tâche n'est pas en attente de validation." },
        { status: 400 }
      );
    }

    const canValidate = await canValidateTask(
      { id: agent!.id, role: agent!.role },
      { creatorId: task.creatorId, companyId: agent!.companyId }
    );
    if (!canValidate) {
      return NextResponse.json(
        { error: "Seul le créateur de la tâche peut la renvoyer en cours." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason = (body.reason || "").trim();
    if (!reason) {
      return NextResponse.json(
        { error: "Un motif est requis pour renvoyer la tâche en cours." },
        { status: 400 }
      );
    }

    const comment = await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data: { status: "IN_PROGRESS" } });

      const created = await tx.comment.create({
        data: { taskId: id, authorId: agent!.id, content: `Tâche renvoyée en cours — motif : ${reason}` },
      });

      // Same "who's linked" recipient rule as every other task-interaction
      // notification (see PATCH /api/tasks/[id] and POST .../comments).
      const recipients = new Set(task.assignments.map((a) => a.agentId));
      recipients.add(task.creatorId);
      recipients.delete(agent!.id);

      if (recipients.size > 0) {
        await tx.notification.createMany({
          data: [...recipients].map((agentId) => ({ agentId, type: "TASK_REJECTED", taskId: id })),
        });
      }

      return created;
    });

    return NextResponse.json({ ok: true, comment });
  } catch (err) {
    console.error("POST /api/tasks/[id]/reject failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}
