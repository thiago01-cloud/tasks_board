import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgentEnsured } from "@/lib/auth";
import { TASK_PRIORITIES } from "@/lib/enums";
import { validGroupIds } from "@/lib/groups";

// Creates a task in the current company. Reserved for admins (which
// includes a company's OWNER — see getCurrentAgent()'s role normalization
// in lib/auth.ts) and managers — a MANAGER can create tasks freely, but
// can only edit/delete the ones they created themselves afterward (see
// PATCH/DELETE /api/tasks/[id]). Everyday work on a task already in
// progress (status, progress, subtasks, comments) stays open to its
// assignees regardless of role.
export async function POST(request: Request) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  if (agent!.role !== "ADMIN" && agent!.role !== "MANAGER") {
    return NextResponse.json(
      { error: "Seuls les administrateurs et les managers peuvent créer une tâche." },
      { status: 403 }
    );
  }

  // Wrapped end to end: an unexpected error here (a bad transaction, a
  // stale Prisma Client after a schema change, ...) must still send a
  // response — otherwise the client's fetch() hangs forever and the
  // "Création..." button never comes back, with nothing but a silent
  // failure server-side (see the console.error below) to explain why.
  try {
    const body = await request.json().catch(() => ({}));
    const title = (body.title || "").trim();
    const description = (body.description || "").trim() || null;
    const priority = TASK_PRIORITIES.includes(body.priority) ? body.priority : "NORMAL";
    const assigneeIds: string[] = Array.isArray(body.assigneeIds)
      ? body.assigneeIds.filter((id: unknown) => typeof id === "string")
      : [];
    // Groups explicitly assigned (via the group chip in AssigneePicker) —
    // separate from assigneeIds: individually assigning every member of a
    // group does NOT, by itself, link the task to that group. See
    // Task.assignedGroups in schema.prisma.
    const groupIds = await validGroupIds(agent!.companyId, body.groupIds);

    let dueDate: Date | null = null;
    if (body.dueDate) {
      const parsed = new Date(body.dueDate);
      if (!Number.isNaN(parsed.getTime())) dueDate = parsed;
    }

    if (!title) {
      return NextResponse.json({ error: "Le titre est requis." }, { status: 400 });
    }

    // Only accept assignees who are actually staff of this company.
    const validAssignees = assigneeIds.length
      ? await prisma.agent.findMany({
          where: { id: { in: assigneeIds }, companyId: agent!.companyId },
          select: { id: true },
        })
      : [];

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          companyId: agent!.companyId,
          title,
          description,
          priority,
          dueDate,
          creatorId: agent!.id,
          assignments: {
            create: validAssignees.map((a) => ({ agentId: a.id })),
          },
          assignedGroups: {
            connect: groupIds.map((id) => ({ id })),
          },
        },
      });

      if (validAssignees.length) {
        await tx.notification.createMany({
          data: validAssignees
            .filter((a) => a.id !== agent!.id)
            .map((a) => ({ agentId: a.id, type: "TASK_ASSIGNED", taskId: created.id })),
        });
      }

      return created;
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error("POST /api/tasks failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}
