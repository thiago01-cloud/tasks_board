import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgentEnsured, canValidateTask } from "@/lib/auth";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/enums";
import { normalizeOptionalUrl } from "@/lib/urls";

async function loadTaskForCompany(id: string, companyId: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: { assignments: { select: { agentId: true } }, subtasks: { select: { id: true } } },
  });
  if (!task || task.companyId !== companyId) return null;
  return task;
}

// Updates a task. Two permission tiers:
//  - `status` and `progress` alone can be changed by the task's creator,
//    an assignee, or an admin — the everyday "move it along the board" /
//    "update how far along it is" actions, open to whoever's actually
//    working the task. One exception within this tier: setting `status`
//    to DONE specifically — i.e. validating a task — is reserved for
//    whoever can validate it (see canValidateTask() in lib/auth.ts),
//    normally just its creator. See POST /api/tasks/[id]/reject for the
//    other half of that review (sending it back with a reason instead).
//  - Everything else (title, description, priority, due date, who's
//    assigned) is reserved for admins (which includes a company's OWNER —
//    see getCurrentAgent()'s role normalization), plus a MANAGER but only
//    on a task they created themselves — since it reshapes the task
//    rather than just tracking its progress. Deleting a task follows the
//    same rule — see DELETE below. Creating one only requires being an
//    admin or a manager (see POST /api/tasks) since there's no existing
//    task to be "not the creator of" yet.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  // Wrapped end to end, same reasoning as POST /api/tasks: without this, an
  // unexpected error leaves the client's fetch() unresolved and the calling
  // UI (status select, edit form) stuck loading forever with no feedback.
  try {
    const { id } = await params;
    const task = await loadTaskForCompany(id, agent!.companyId);
    if (!task) {
      return NextResponse.json({ error: "Tâche introuvable." }, { status: 404 });
    }

    const isCreator = task.creatorId === agent!.id;
    const isAssignee = task.assignments.some((a) => a.agentId === agent!.id);
    // Broad tier — status/progress: creator, an assignee, or an admin.
    const canWork = agent!.role === "ADMIN" || isCreator || isAssignee;
    // Strict tier — structural edits, assignment changes, delete: any
    // admin, or a manager but only on a task they created (see the
    // function comment above).
    const canManage = agent!.role === "ADMIN" || (agent!.role === "MANAGER" && isCreator);

    const body = await request.json().catch(() => ({}));
    // Built up field by field below, then passed straight to
    // prisma.task.update({ data }) — a plain Record<string, unknown> won't
    // structurally satisfy Prisma's TaskUpdateInput (every field there
    // expects a concrete type, not `unknown`), so this stays loosely typed
    // on purpose.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if (body.status !== undefined) {
      if (!canWork) {
        return NextResponse.json(
          { error: "Seuls le créateur, un assigné ou un admin peuvent changer le statut." },
          { status: 403 }
        );
      }
      if (!TASK_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
      }
      // DONE is the one status nobody just "sets" — it's the outcome of
      // validating a task that's already TO_VALIDATE (100% progress), and
      // only its creator (or an admin fallback — see canValidateTask() in
      // lib/auth.ts) gets to do that. Every other transition, including
      // *into* TO_VALIDATE by hand, stays open to canWork above; only the
      // last step is gated.
      if (body.status === "DONE") {
        if (task.status !== "TO_VALIDATE") {
          return NextResponse.json(
            { error: "Une tâche ne peut être marquée terminée qu'une fois à 100% et en attente de validation." },
            { status: 400 }
          );
        }
        const canValidate = await canValidateTask(
          { id: agent!.id, role: agent!.role },
          { creatorId: task.creatorId, companyId: agent!.companyId }
        );
        if (!canValidate) {
          return NextResponse.json(
            { error: "Seul le créateur de la tâche peut la valider." },
            { status: 403 }
          );
        }
      }
      data.status = body.status;
      // Marking a task DONE means it's fully done — unless the caller also
      // sent an explicit progress value in the same request, snap it to
      // 100% so the two fields don't silently disagree. Skipped once the
      // task has subtasks: progress is then derived from their weights
      // (see lib/subtasks.ts), and DONE doesn't necessarily mean every
      // subtask is checked off, so it must not be forced here.
      if (body.status === "DONE" && body.progress === undefined && task.subtasks.length === 0) {
        data.progress = 100;
      }
      // `completedAt` tracks the moment the task was actually validated
      // (see schema.prisma) — set on the way in, cleared on the way out,
      // and left alone on any other status change (e.g. TODO -> BLOCKED,
      // or TO_VALIDATE -> IN_PROGRESS via a rejection).
      if (body.status === "DONE" && task.status !== "DONE") {
        data.completedAt = new Date();
      } else if (body.status !== "DONE" && task.status === "DONE") {
        data.completedAt = null;
      }
    }

    if (body.progress !== undefined) {
      if (!canWork) {
        return NextResponse.json(
          { error: "Seuls le créateur, un assigné ou un admin peuvent changer l'avancement." },
          { status: 403 }
        );
      }
      if (task.subtasks.length > 0) {
        return NextResponse.json(
          { error: "L'avancement est calculé automatiquement à partir des sous-tâches." },
          { status: 400 }
        );
      }
      const progress = Number(body.progress);
      if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
        return NextResponse.json({ error: "L'avancement doit être un nombre entre 0 et 100." }, { status: 400 });
      }
      data.progress = Math.round(progress);
      // Mirror of lib/subtasks.ts's taskUpdateForProgress: reaching 100%
      // queues the task up for validation, not the other way around.
      // Skipped when `status` was already set explicitly in this same
      // request (that block already decided), or when it's already
      // TO_VALIDATE/DONE (no re-queuing on a no-op resend at 100%).
      if (
        data.progress === 100 &&
        body.status === undefined &&
        task.status !== "TO_VALIDATE" &&
        task.status !== "DONE"
      ) {
        data.status = "TO_VALIDATE";
      }
    }

    const wantsManagedEdit =
      body.title !== undefined ||
      body.description !== undefined ||
      body.priority !== undefined ||
      body.dueDate !== undefined ||
      body.linkUrl !== undefined ||
      body.imageUrl !== undefined ||
      body.assigneeIds !== undefined ||
      body.groupIds !== undefined;

    if (wantsManagedEdit && !canManage) {
      return NextResponse.json(
        {
          error:
            "Seuls les administrateurs, ou le manager qui a créé cette tâche, peuvent la modifier.",
        },
        { status: 403 }
      );
    }

    if (canManage) {
      if (body.title !== undefined) {
        const title = String(body.title || "").trim();
        if (!title) {
          return NextResponse.json({ error: "Le titre est requis." }, { status: 400 });
        }
        data.title = title;
      }
      if (body.description !== undefined) {
        data.description = String(body.description || "").trim() || null;
      }
      if (body.priority !== undefined) {
        if (!TASK_PRIORITIES.includes(body.priority)) {
          return NextResponse.json({ error: "Priorité invalide." }, { status: 400 });
        }
        data.priority = body.priority;
      }
      if (body.dueDate !== undefined) {
        if (!body.dueDate) {
          data.dueDate = null;
        } else {
          const parsed = new Date(body.dueDate);
          if (Number.isNaN(parsed.getTime())) {
            return NextResponse.json({ error: "Date d'échéance invalide." }, { status: 400 });
          }
          data.dueDate = parsed;
        }
      }
      if (body.linkUrl !== undefined) {
        const result = normalizeOptionalUrl(body.linkUrl);
        if (!result.ok) {
          return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
        }
        data.linkUrl = result.url;
      }
      if (body.imageUrl !== undefined) {
        const result = normalizeOptionalUrl(body.imageUrl);
        if (!result.ok) {
          return NextResponse.json({ error: "URL d'image invalide." }, { status: 400 });
        }
        data.imageUrl = result.url;
      }
    }

    if (Object.keys(data).length === 0 && body.assigneeIds === undefined && body.groupIds === undefined) {
      return NextResponse.json({ error: "Rien à mettre à jour." }, { status: 400 });
    }

    // Every interaction below (status, progress, the editable fields) is
    // compared against the task's PREVIOUS values, not just "was the field
    // present in the body" — the edit panel always resends title/
    // description/priority/dueDate together even when nothing actually
    // changed, and that must not fire a false "tâche modifiée" notification.
    const statusChanged = data.status !== undefined && data.status !== task.status;
    const progressChanged = data.status === undefined && data.progress !== undefined && data.progress !== task.progress;
    const editedFieldsChanged =
      (data.title !== undefined && data.title !== task.title) ||
      (data.description !== undefined && data.description !== task.description) ||
      (data.priority !== undefined && data.priority !== task.priority) ||
      (data.dueDate !== undefined &&
        (data.dueDate ? data.dueDate.getTime() : null) !== (task.dueDate ? task.dueDate.getTime() : null)) ||
      (data.linkUrl !== undefined && data.linkUrl !== task.linkUrl) ||
      (data.imageUrl !== undefined && data.imageUrl !== task.imageUrl);

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.task.update({ where: { id }, data });
      }

      // Tracks who's assigned after this request (defaults to who was
      // assigned before it, updated below if assigneeIds changed) — used
      // at the end to notify everyone linked to the task about status/
      // progress/edit interactions, same recipients as TASK_ASSIGNED.
      let finalAssigneeIds = new Set(task.assignments.map((a) => a.agentId));

      if (canManage && body.assigneeIds !== undefined) {
        const assigneeIds: string[] = Array.isArray(body.assigneeIds)
          ? body.assigneeIds.filter((v: unknown) => typeof v === "string")
          : [];

        const validAssignees = assigneeIds.length
          ? await tx.agent.findMany({
              where: { id: { in: assigneeIds }, companyId: agent!.companyId },
              select: { id: true },
            })
          : [];

        const previousIds = new Set(task.assignments.map((a) => a.agentId));
        const nextIds = new Set(validAssignees.map((a) => a.id));
        finalAssigneeIds = nextIds;

        await tx.assignment.deleteMany({ where: { taskId: id } });
        if (validAssignees.length) {
          await tx.assignment.createMany({
            data: validAssignees.map((a) => ({ taskId: id, agentId: a.id })),
          });
        }

        const newlyAdded = [...nextIds].filter((agentId) => !previousIds.has(agentId) && agentId !== agent!.id);
        if (newlyAdded.length) {
          await tx.notification.createMany({
            data: newlyAdded.map((agentId) => ({ agentId, type: "TASK_ASSIGNED", taskId: id })),
          });
        }
      }

      // Groups explicitly assigned to the task (distinct from the
      // individual assignments above) — `set` replaces the full list, same
      // approach as PATCH /api/groups/[id] uses for a group's own members.
      if (canManage && body.groupIds !== undefined) {
        const groupIds: string[] = Array.isArray(body.groupIds)
          ? body.groupIds.filter((v: unknown) => typeof v === "string")
          : [];

        const validGroups = groupIds.length
          ? await tx.group.findMany({
              where: { id: { in: groupIds }, companyId: agent!.companyId },
              select: { id: true },
            })
          : [];

        await tx.task.update({
          where: { id },
          data: { assignedGroups: { set: validGroups.map((g) => ({ id: g.id })) } },
        });
      }

      // Every interaction with the task notifies the people linked to it
      // (its creator + everyone currently assigned), except whoever just
      // performed the action. Status and progress are mutually exclusive
      // here — marking a task DONE auto-sets progress too (see above), and
      // that should read as one "statut changé" notification, not two.
      if (statusChanged || progressChanged || editedFieldsChanged) {
        const recipients = new Set(finalAssigneeIds);
        recipients.add(task.creatorId);
        recipients.delete(agent!.id);

        const notifTypes: string[] = [];
        // Reaching TO_VALIDATE gets its own notification type — see
        // lib/subtasks.ts's notificationTypeForProgress, which this
        // mirrors for the manual-status/manual-slider paths.
        if (statusChanged) notifTypes.push(data.status === "TO_VALIDATE" ? "TASK_TO_VALIDATE" : "TASK_STATUS_CHANGED");
        else if (progressChanged) notifTypes.push("TASK_PROGRESS_UPDATED");
        if (editedFieldsChanged) notifTypes.push("TASK_UPDATED");

        if (recipients.size > 0 && notifTypes.length > 0) {
          await tx.notification.createMany({
            data: [...recipients].flatMap((agentId) =>
              notifTypes.map((type) => ({ agentId, type, taskId: id }))
            ),
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/tasks/[id] failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}

// Deletes a task and everything hanging off it (assignments, comments,
// notifications) — SQLite here has no ON DELETE CASCADE configured, so
// this is done explicitly in one transaction. Same rule as editing a
// task's structural fields — see the PATCH handler's function comment:
// any admin, or a manager but only on a task they created.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  try {
    const { id } = await params;
    const task = await loadTaskForCompany(id, agent!.companyId);
    if (!task) {
      return NextResponse.json({ error: "Tâche introuvable." }, { status: 404 });
    }

    const canManage = agent!.role === "ADMIN" || (agent!.role === "MANAGER" && task.creatorId === agent!.id);
    if (!canManage) {
      return NextResponse.json(
        {
          error:
            "Seuls les administrateurs, ou le manager qui a créé cette tâche, peuvent la supprimer.",
        },
        { status: 403 }
      );
    }

    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { taskId: id } }),
      prisma.comment.deleteMany({ where: { taskId: id } }),
      prisma.assignment.deleteMany({ where: { taskId: id } }),
      prisma.subtask.deleteMany({ where: { taskId: id } }),
      prisma.task.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tasks/[id] failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}
