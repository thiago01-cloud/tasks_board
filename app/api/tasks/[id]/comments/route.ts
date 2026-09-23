import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgentEnsured } from "@/lib/auth";

// Adds a comment to a task. Any member of the task's company can comment
// — discussion isn't gated behind admin/manager the way editing is.
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

    const body = await request.json().catch(() => ({}));
    const content = (body.content || "").trim();
    if (!content) {
      return NextResponse.json({ error: "Le commentaire est vide." }, { status: 400 });
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { taskId: id, authorId: agent!.id, content },
      });

      // Notify everyone linked to the task (creator + assignees) except
      // whoever just wrote the comment — same "who's linked" rule as the
      // other task-interaction notifications in PATCH /api/tasks/[id].
      const recipients = new Set(task.assignments.map((a) => a.agentId));
      recipients.add(task.creatorId);
      recipients.delete(agent!.id);

      if (recipients.size > 0) {
        await tx.notification.createMany({
          data: [...recipients].map((agentId) => ({ agentId, type: "TASK_COMMENT", taskId: id })),
        });
      }

      return created;
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error("POST /api/tasks/[id]/comments failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}
