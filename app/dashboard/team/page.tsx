import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageAgent, canManageAccount } from "@/lib/agents";
import { assignAgentColors } from "@/lib/colors";
import TeamForm from "./TeamForm";
import TeamCard from "./TeamCard";
import TeamFolderBrowser, { type GroupItem, type MemberOption, type TeamMemberCard } from "./TeamFolderBrowser";
import TeamFabButtons from "./TeamFabButtons";

// "Le menu équipe doit être organisé comme le système de dossier de
// Windows" — this page is now a folder browser, not a flat member grid:
//   - at the root (no ?folder=), you find the company's OWNER (always
//     pinned, however the groups are organized), everyone who doesn't
//     belong to any group yet, and the top-level groups (e.g.
//     "départements") shown as folders;
//   - open one of those folders (?folder=<id>) and you see that group's
//     own direct members (its chef first), plus ITS sub-groups
//     ("services"...) as further folders — the same shape, repeated at
//     any depth.
// See TeamFolderBrowser.tsx for the actual browsing/editing UI — this file
// only resolves, from one flat fetch of every agent and every group in the
// company, which slice belongs at whichever level `?folder=` points to.
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const agent = await getCurrentAgent();
  // Admins get the full page; managers get it too (to create groups) but
  // with "Ajouter un membre" and each member's "Supprimer" hidden, since
  // add/remove staff stays admin-only (see POST/DELETE /api/agents).
  // Anyone else is redirected away.
  if (!agent || (agent.role !== "ADMIN" && agent.role !== "MANAGER")) redirect("/dashboard");
  const isAdmin = agent.role === "ADMIN";
  // Whether the viewer is the company's OWNER (compared by User.id, not
  // session role — see lib/auth.ts's SessionRole comment) — the only
  // account allowed to grant/revoke another agent's right to manage the
  // subscription (see TeamCard.tsx's toggle and PATCH
  // /api/agents/[id]/subscription-manager).
  const isOwner = agent.userId === agent.ownerId;

  const { folder } = await searchParams;

  const [companyMembers, groupRows] = await Promise.all([
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
      include: {
        agents: { select: { id: true } },
        leader: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ]);

  // Whether each teammate has at least one active Web Push subscription
  // (see lib/push.ts's PushSubscription model) — surfaced as a badge on
  // TeamCard.tsx.
  const pushSubscribers = await prisma.pushSubscription.findMany({
    where: { agentId: { in: companyMembers.map((m) => m.id) } },
    select: { agentId: true },
    distinct: ["agentId"],
  });
  const pushEnabledIds = new Set(pushSubscribers.map((s) => s.agentId));

  // Over the WHOLE company at once — see assignAgentColors()'s own
  // comment in lib/colors.ts: uniqueness ("les couleurs attribuées aux
  // utilisateurs sont uniques") only means something when every agent who
  // might collide is considered together, not just whoever is visible at
  // the current folder depth.
  const colorMap = assignAgentColors(companyMembers.map((m) => ({ id: m.id, color: m.color })));

  // Flat, every group in the company regardless of depth — this is both
  // "what TeamFolderBrowser filters per level" (by parentId, below) and
  // the full picker data its create/move forms need: a group can be
  // re-parented to ANY other group in the company, not just ones visible
  // at the current level.
  const groups: GroupItem[] = groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    memberIds: g.agents.map((a) => a.id),
    creatorId: g.creatorId,
    parentId: g.parentId,
    leaderId: g.leaderId,
    leaderName: g.leader ? `${g.leader.user.firstName} ${g.leader.user.lastName}` : null,
  }));

  // Every agent with ZERO group memberships at all — what shows up loose
  // at the root ("on retrouve ceux qui n'appartiennent pas déjà à un
  // groupe"). Deliberately whole-membership, not "has no TOP-level
  // group": belonging only to a sub-group ("un service") but no
  // department still counts as grouped, it's just not reachable from the
  // root without opening that department first — same non-cascading
  // reasoning as Task.assignedGroups.
  const ungroupedIds = new Set(companyMembers.filter((m) => m.groups.length === 0).map((m) => m.id));

  const agents: TeamMemberCard[] = companyMembers.map((member) => ({
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
    color: colorMap.get(member.id)!,
    // Whether the VIEWER (admin or manager) may share this teammate's
    // login link / remove them — see canManageAgent() in lib/agents.ts: an
    // admin may act on anyone but the company's owner, a manager only on
    // accounts they themselves added.
    canManage: canManageAgent(agent, member, agent.ownerId),
    canDelete: isAdmin && canManageAgent(agent, member, agent.ownerId),
    // Only the owner ever sees this at all — TeamCard.tsx also hides it on
    // the owner's own (isMe) row, since the owner always has the right
    // regardless of this flag.
    canGrantSubscriptionManager: isOwner,
    // Whether the viewer may edit this teammate's account details or
    // reset their password — see canManageAccount() in lib/agents.ts.
    canManageAccount: canManageAccount(agent, member),
  }));

  const memberOptions: MemberOption[] = agents.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` }));

  // Current "dossier" — null at the root. A stale/invalid ?folder= (a
  // group since deleted, or from another company — groups[] is already
  // company-scoped so that's covered for free) just falls back to the
  // root view rather than erroring.
  const currentFolder = folder ? groups.find((g) => g.id === folder) ?? null : null;
  const folderId = currentFolder ? currentFolder.id : null;

  // The chain of groups ABOVE (and including) the current one, root-most
  // first — walked from the flat list already fetched rather than a
  // second DB round-trip. "Équipe" itself is the implicit first crumb,
  // rendered separately below.
  const breadcrumb: { id: string; name: string }[] = [];
  {
    let node: GroupItem | null = currentFolder;
    while (node) {
      breadcrumb.unshift({ id: node.id, name: node.name });
      node = node.parentId ? groups.find((g) => g.id === node!.parentId) ?? null : null;
    }
  }

  // The owner is always reachable from the root, however the folders are
  // organized ("on peut retrouver le propriétaire lui-même") — pulled out
  // of whichever bucket they'd otherwise land in (ungrouped, or a
  // department) so they're never shown twice. Can be null — an owner who
  // never got an Agent record in their own company (see
  // getCurrentAgent()'s own comment) has no card to pin.
  const ownerCard = folderId === null ? agents.find((a) => a.userId === agent.ownerId) ?? null : null;

  const childGroups = groups.filter((g) => (g.parentId || null) === folderId);

  let agentsHere: TeamMemberCard[];
  if (currentFolder) {
    const memberSet = new Set(currentFolder.memberIds);
    agentsHere = agents.filter((a) => memberSet.has(a.id));
    // "On voit d'abord le chef" — the group's own leader, if any, always
    // leads this level's member grid.
    if (currentFolder.leaderId) {
      const leaderId = currentFolder.leaderId;
      agentsHere = [...agentsHere.filter((a) => a.id === leaderId), ...agentsHere.filter((a) => a.id !== leaderId)];
    }
  } else {
    agentsHere = agents.filter((a) => ungroupedIds.has(a.id) && a.id !== ownerCard?.id);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Équipe</h1>
      </div>

      {breadcrumb.length > 0 && (
        <nav className="team-breadcrumb">
          <Link href="/dashboard/team">Équipe</Link>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span>/</span>
              {i === breadcrumb.length - 1 ? (
                <span className="team-breadcrumb-current">{crumb.name}</span>
              ) : (
                <Link href={`/dashboard/team?folder=${crumb.id}`}>{crumb.name}</Link>
              )}
            </span>
          ))}
        </nav>
      )}

      {ownerCard && (
        <div style={{ marginBottom: 24 }}>
          <p className="team-section-title">Propriétaire</p>
          <div className="team-grid">
            <TeamCard
              agent={ownerCard}
              isMe={ownerCard.userId === agent.userId}
              canManage={ownerCard.canManage}
              canDelete={ownerCard.canDelete}
              canGrantSubscriptionManager={ownerCard.canGrantSubscriptionManager}
              canManageAccount={ownerCard.canManageAccount}
            />
          </div>
        </div>
      )}

      <TeamFolderBrowser
        folderId={folderId}
        currentFolder={currentFolder}
        childGroups={childGroups}
        agentsHere={agentsHere}
        allGroups={groups}
        allMembers={memberOptions}
        currentAgentId={agent.id ?? ""}
        currentUserId={agent.userId}
        isAdmin={isAdmin}
        canCreateGroup={isAdmin || agent.role === "MANAGER"}
      />

      {isAdmin && folderId === null && (
        <div id="add-agent-form" className="card scroll-target" style={{ marginTop: 20 }}>
          <h3 style={{ marginTop: 0 }}>Ajouter un membre</h3>
          <TeamForm />
        </div>
      )}

      <TeamFabButtons isAdmin={isAdmin && folderId === null} />
    </div>
  );
}
