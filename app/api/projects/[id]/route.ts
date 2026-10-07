import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent, requireAgentEnsured } from "@/lib/auth";
import { canManageProject, computeProjectProgress } from "@/lib/projects";

// Project detail, with its linked tasks — open to every connected member,
// same reasoning as GET /api/projects.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent();
  if (error) return error;

  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        creator: { include: { user: { select: { firstName: true, lastName: true } } } },
        tasks: {
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, status: true, priority: true, progress: true, dueDate: true },
        },
      },
    });

    if (!project || project.companyId !== agent!.companyId) {
      return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        objective: project.objective,
        deliveryDate: project.deliveryDate ? project.deliveryDate.toISOString() : null,
        createdAt: project.createdAt.toISOString(),
        creatorId: project.creatorId,
        creator: project.creator
          ? { firstName: project.creator.user.firstName, lastName: project.creator.user.lastName }
          : null,
        progress: computeProjectProgress(project.tasks),
        tasks: project.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          progress: t.progress,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        })),
      },
      canManage: canManageProject(agent!, project),
    });
  } catch (err) {
    console.error("GET /api/projects/[id] failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}

// Edits a project's own fields. Reserved to any admin, or to the manager
// who created it — same tier as PATCH /api/groups/[id].
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.companyId !== agent!.companyId) {
      return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
    }

    if (!canManageProject(agent!, project)) {
      return NextResponse.json(
        {
          error:
            "Seuls les administrateurs, ou le manager qui a créé ce projet, peuvent le modifier.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if (body.name !== undefined) {
      const name = String(body.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "Le nom du projet est requis." }, { status: 400 });
      }
      data.name = name;
    }
    if (body.description !== undefined) {
      data.description = String(body.description || "").trim() || null;
    }
    if (body.objective !== undefined) {
      data.objective = String(body.objective || "").trim() || null;
    }
    if (body.deliveryDate !== undefined) {
      if (!body.deliveryDate) {
        data.deliveryDate = null;
      } else {
        const parsed = new Date(body.deliveryDate);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Date de livraison invalide." }, { status: 400 });
        }
        data.deliveryDate = parsed;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Rien à mettre à jour." }, { status: 400 });
    }

    await prisma.project.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/projects/[id] failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}

// Deletes a project. Its tasks are NOT deleted — Task.projectId is
// onDelete: SetNull (see schema.prisma), so they're just unlinked and
// stay visible/manageable on the regular task board, same spirit as
// deleting a Group leaving its former members untouched.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.companyId !== agent!.companyId) {
      return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
    }

    if (!canManageProject(agent!, project)) {
      return NextResponse.json(
        {
          error:
            "Seuls les administrateurs, ou le manager qui a créé ce projet, peuvent le supprimer.",
        },
        { status: 403 }
      );
    }

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/projects/[id] failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}
