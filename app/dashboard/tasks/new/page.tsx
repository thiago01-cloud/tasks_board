import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageTitle } from "@/lib/constants";
import TaskForm from "../TaskForm";

export const metadata = {
  title: pageTitle("Nouvelle tâche"),
};

export default async function NewTaskPage() {
  const agent = await getCurrentAgent();

  const [members, groups] = await Promise.all([
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
  ]);

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
        />
      </div>
    </div>
  );
}
