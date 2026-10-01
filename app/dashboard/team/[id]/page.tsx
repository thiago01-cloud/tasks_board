import { notFound, redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageAgent, canManageAccount } from "@/lib/agents";
import { pageTitle } from "@/lib/constants";
import TeamMemberDetail from "./TeamMemberDetail";

export const metadata = {
  title: pageTitle("Détail du compte"),
};

// One teammate's full management view — everything that used to be
// crammed as buttons onto their card in the Équipe grid (see
// TeamCard.tsx's own comment): share the login link, edit the account,
// reset the password, grant/revoke subscription management, delete. Same
// permission computations as app/dashboard/team/page.tsx, just scoped to
// a single member instead of the whole list.
export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const agent = await getCurrentAgent();
  if (!agent || (agent.role !== "ADMIN" && agent.role !== "MANAGER")) redirect("/dashboard");
  const isAdmin = agent.role === "ADMIN";
  const isOwner = agent.userId === agent.ownerId;

  const { id } = await params;
  const member = await prisma.agent.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, country: true, phone: true, email: true },
      },
      groups: { select: { id: true, name: true } },
    },
  });
  if (!member || member.companyId !== agent.companyId) notFound();

  // Nothing to manage on your own card this way — "Mon compte" is where
  // that lives (see app/dashboard/account). Rather than render an
  // actionless page, send it straight there.
  if (member.userId === agent.userId) redirect("/dashboard/account");

  return (
    <TeamMemberDetail
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
      }}
      canManage={canManageAgent(agent, member, agent.ownerId)}
      canDelete={isAdmin && canManageAgent(agent, member, agent.ownerId)}
      canGrantSubscriptionManager={isOwner}
      canManageAccount={canManageAccount(agent, member)}
    />
  );
}
