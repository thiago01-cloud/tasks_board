import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TeamForm from "./TeamForm";
import TeamRow from "./TeamRow";
import GroupManager from "./GroupManager";
import TeamFabButtons from "./TeamFabButtons";

export default async function TeamPage() {
  const agent = await getCurrentAgent();
  if (!agent || agent.role !== "ADMIN") redirect("/dashboard");

  const [companyMembers, groups] = await Promise.all([
    prisma.agent.findMany({
      where: { companyId: agent.companyId },
      orderBy: { joinedAt: "asc" },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        groups: { select: { id: true, name: true } },
      },
    }),
    prisma.group.findMany({
      where: { companyId: agent.companyId },
      orderBy: { createdAt: "asc" },
      include: { agents: { select: { id: true } } },
    }),
  ]);

  const memberOptions = companyMembers.map((m) => ({
    id: m.id,
    name: `${m.user.firstName} ${m.user.lastName}`,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>Équipe</h1>
      </div>

      {/* Simple single-column stack (table, then forms) instead of a
          side-by-side split — splitting the width in two left the members
          table with too little room for its columns and forced an inner
          horizontal scrollbar even on desktop. Full-width blocks give the
          table room to breathe and read top to bottom, one under the other. */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Groupes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {companyMembers.map((member) => (
                <TeamRow
                  key={member.id}
                  agent={{
                    id: member.id,
                    firstName: member.user.firstName,
                    lastName: member.user.lastName,
                    phone: member.user.phone,
                    email: member.user.email,
                    role: member.role,
                    groupNames: member.groups.map((g) => g.name),
                  }}
                  isMe={member.userId === agent.userId}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div id="add-agent-form" className="card scroll-target" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Ajouter un membre</h3>
        <TeamForm />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Groupes</h3>
        <GroupManager
          groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.agents.map((a) => a.id) }))}
          members={memberOptions}
        />
      </div>

      <TeamFabButtons />
    </div>
  );
}
