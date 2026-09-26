import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageAgent } from "@/lib/agents";
import TeamForm from "./TeamForm";
import TeamCard from "./TeamCard";
import GroupManager from "./GroupManager";
import TeamFabButtons from "./TeamFabButtons";

export default async function TeamPage() {
  const agent = await getCurrentAgent();
  // Admins get the full page; managers get it too (to create groups — see
  // GroupManager) but with "Ajouter un membre" and each member's
  // "Supprimer" hidden, since add/remove staff stays admin-only (see
  // POST/DELETE /api/agents). Anyone else is redirected away.
  if (!agent || (agent.role !== "ADMIN" && agent.role !== "MANAGER")) redirect("/dashboard");
  const isAdmin = agent.role === "ADMIN";
  // Whether the viewer is the company's OWNER (compared by User.id, not
  // session role — see lib/auth.ts's SessionRole comment) — the only
  // account allowed to grant/revoke another agent's right to manage the
  // subscription (see TeamCard.tsx's toggle and PATCH
  // /api/agents/[id]/subscription-manager).
  const isOwner = agent.userId === agent.ownerId;

  const [companyMembers, groups] = await Promise.all([
    prisma.agent.findMany({
      where: { companyId: agent.companyId },
      orderBy: { joinedAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            passwordSetAt: true,
          },
        },
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

      {/* Card grid (was a table) — reads better at a glance and doesn't
          force a horizontal scrollbar on narrower screens. */}
      <div className="team-grid" style={{ marginBottom: 20 }}>
        {companyMembers.map((member) => (
          <TeamCard
            key={member.id}
            agent={{
              id: member.id,
              userId: member.userId,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              phone: member.user.phone,
              email: member.user.email,
              role: member.role,
              groupNames: member.groups.map((g) => g.name),
              canManageSubscription: member.canManageSubscription,
            }}
            isMe={member.userId === agent.userId}
            // Whether the viewer (admin or manager) may share this
            // teammate's login link — see canManageAgent() in
            // lib/agents.ts: an admin may act on anyone but the company's
            // owner, a manager only on accounts they themselves added.
            canManage={canManageAgent(agent, member, agent.ownerId)}
            canDelete={isAdmin && canManageAgent(agent, member, agent.ownerId)}
            // Only the owner ever sees this toggle at all — TeamCard.tsx
            // also hides it on the owner's own (isMe) row, since the
            // owner always has the right regardless of this flag.
            canGrantSubscriptionManager={isOwner}
          />
        ))}
      </div>

      {isAdmin && (
        <div id="add-agent-form" className="card scroll-target" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Ajouter un membre</h3>
          <TeamForm />
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Groupes</h3>
        <GroupManager
          groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.agents.map((a) => a.id), creatorId: g.creatorId }))}
          members={memberOptions}
          currentAgentId={agent.id ?? ""}
          isAdmin={isAdmin}
        />
      </div>

      <TeamFabButtons isAdmin={isAdmin} />
    </div>
  );
}
