import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageTitle } from "@/lib/constants";
import TaskForm from "../TaskForm";

export const metadata = {
  title: pageTitle("Nouvelle tâche"),
};

// Creating a task is reserved for admins and managers — see POST
// /api/tasks's own comment — so anyone else landing here directly (typed
// URL, stale link) is sent back rather than shown a form that would just
// fail on submit.
//
// "Les administrateurs doivent être capables d'ajouter des tâches au
// projet" — the "+ Nouvelle tâche" button on a project's own page (see
// ProjectDetail.tsx) lands here with ?projectId=<id>, which just
// pre-selects that project in the form below instead of needing a whole
// separate creation path: the task that comes out of it is a completely
// ordinary one (same assignment-to-a-group-or-person, same everything —
// "ayant le fonctionnement habituel") that happens to carry a project
// from the moment it's created, same as picking one manually from the
// dropdown always already let you do.
export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const agent = await getCurrentAgent();
  if (!agent || (agent.role !== "ADMIN" && agent.role !== "MANAGER")) redirect("/dashboard/tasks");

  const { projectId } = await searchParams;

  const [members, groups, projects] = await Promise.all([
    prisma.agent.findMany({
      where: { companyId: agent!.companyId },
      orderBy: { joinedAt: "asc" },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.group.findMany({
      where: { companyId: agent!.companyId },
      orderBy: { createdAt: "asc" },
      include: { agents: { select: { id: true } } },
    }),
    prisma.project.findMany({
      where: { companyId: agent!.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // A ?projectId that doesn't actually resolve in this company (stale
  // link, mistyped URL) just falls back to "aucun projet pré-rempli"
  // rather than erroring — same tolerant handling as the filter/folder
  // params elsewhere in this app.
  const defaultProjectId = projectId && projects.some((p) => p.id === projectId) ? projectId : "";

  return (
    <div>
      <div className="page-header">
        <h1>Nouvelle tâche</h1>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <TaskForm
          members={members.map((m) => ({
            id: m.id,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
          }))}
          groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.agents.map((a) => a.id) }))}
          projects={projects}
          defaultProjectId={defaultProjectId}
        />
      </div>
    </div>
  );
}
