import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent, requireAgentEnsured } from "@/lib/auth";
import { computeProjectProgress } from "@/lib/projects";

// Lists the company's projects, each with its computed progress and task
// count — open to every connected member (same as GET /api/groups): a
// MEMBER needs to see which projects exist and how they're doing, even
// though only admins/managers can create or manage one (see POST below
// and PATCH/DELETE /api/projects/[id]).
export async function GET() {
  const { agent, error } = await requireAgent();
  if (error) return error;

  try {
    const projects = await prisma.project.findMany({
      where: { companyId: agent!.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        tasks: { select: { progress: true } },
        creator: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        objective: p.objective,
        deliveryDate: p.deliveryDate ? p.deliveryDate.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        creatorId: p.creatorId,
        taskCount: p.tasks.length,
        progress: computeProjectProgress(p.tasks),
      })),
    });
  } catch (err) {
    console.error("GET /api/projects failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}

// Creates a project. Reserved for admins and managers — same tier as
// creating a task (see POST /api/tasks) or a group (see POST /api/groups):
// a manager can create one freely, but can only edit/delete the ones they
// created themselves afterward (see PATCH/DELETE /api/projects/[id]).
export async function POST(request: Request) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  if (agent!.role !== "ADMIN" && agent!.role !== "MANAGER") {
    return NextResponse.json(
      { error: "Seuls les administrateurs et les managers peuvent créer un projet." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom du projet est requis." }, { status: 400 });
    }
    const description = (body.description || "").trim() || null;
    const objective = (body.objective || "").trim() || null;

    let deliveryDate: Date | null = null;
    if (body.deliveryDate) {
      const parsed = new Date(body.deliveryDate);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Date de livraison invalide." }, { status: 400 });
      }
      deliveryDate = parsed;
    }

    const project = await prisma.project.create({
      data: {
        companyId: agent!.companyId,
        name,
        description,
        objective,
        deliveryDate,
        creatorId: agent!.id,
      },
    });

    return NextResponse.json(
      {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          objective: project.objective,
          deliveryDate: project.deliveryDate ? project.deliveryDate.toISOString() : null,
          createdAt: project.createdAt.toISOString(),
          creatorId: project.creatorId,
          taskCount: 0,
          progress: 0,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/projects failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}
