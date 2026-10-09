import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageAgent, canManageAccount } from "@/lib/agents";
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
            country: true,
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

  // Whether each teammate has at least one active Web Push subscription
  // (see lib/push.ts's PushSubscription model) — surfaced as a badge on
  // TeamCard.tsx. Activating push is per-account and per-device (each
  // person does it themselves, from their own session, on "Mon compte"),
  // so an admin has no other way to tell whether a given teammate's task
  // notifications will actually reach their device, or whether they just
  // haven't turned it on yet.
  const pushSubscribers = await prisma.pushSubscription.findMany({
    where: { agentId: { in: companyMembers.map((m) => m.id) } },
    select: { agentId: true },
    distinct: ["agentId"],
  });
  const pushEnabledIds = new Set(pushSubscribers.map((s) => s.agentId));

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
              country: member.user.country,
              phone: member.user.phone,
              email: member.user.email,
              role: member.role,
              groupNames: member.groups.map((g) => g.name),
              canManageSubscription: member.canManageSubscription,
              pushEnabled: pushEnabledIds.has(member.id),
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
            // Whether the viewer may edit this teammate's account details
            // (name/phone/email/role) or reset their password — see
            // canManageAccount() in lib/agents.ts: the owner may act on
            // anyone, an admin on anyone but the owner (other admins
            // included), a manager on nobody this way.
            canManageAccount={canManageAccount(agent, member)}
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
