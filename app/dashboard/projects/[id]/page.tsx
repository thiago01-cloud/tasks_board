import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageTitle } from "@/lib/constants";
import { canManageProject, computeProjectProgress } from "@/lib/projects";
import ProjectDetail from "./ProjectDetail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, select: { name: true } });
  return { title: pageTitle(project?.name || "Projet") };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");
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

  if (!project || project.companyId !== agent.companyId) notFound();

  const canManage = canManageProject(agent, project);

  return (
    <div>
      <Link
        href="/dashboard/projects"
        style={{ display: "inline-block", marginBottom: 16, fontSize: 13.5, color: "var(--color-text-muted)" }}
      >
        ← Retour aux projets
      </Link>

      <ProjectDetail
        project={{
          id: project.id,
          name: project.name,
          description: project.description,
          objective: project.objective,
          deliveryDate: project.deliveryDate ? project.deliveryDate.toISOString() : null,
          createdAt: project.createdAt.toISOString(),
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
        }}
        canManage={canManage}
      />
    </div>
  );
}
