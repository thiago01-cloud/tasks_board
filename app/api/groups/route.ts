import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent, requireAgentEnsured } from "@/lib/auth";
import { validMemberIds, promoteLeaderIfNeeded } from "@/lib/groups";

// Lists the company's groups, each with its member ids — any connected
// member can read this (used both by the team page, open to admins and
// managers, and by the dashboard's "avancement par groupe" section for
// every role).
export async function GET() {
  const { agent, error } = await requireAgent();
  if (error) return error;

  try {
    const groups = await prisma.group.findMany({
      where: { companyId: agent!.companyId },
      orderBy: { createdAt: "asc" },
      include: {
        agents: { select: { id: true } },
        leader: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });

    return NextResponse.json({
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        memberIds: g.agents.map((a) => a.id),
        creatorId: g.creatorId,
        parentId: g.parentId,
        leaderId: g.leaderId,
        leaderName: g.leader ? `${g.leader.user.firstName} ${g.leader.user.lastName}` : null,
      })),
    });
  } catch (err) {
    console.error("GET /api/groups failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}

// Creates a group with its initial members in one go. Open to admins and
// managers alike — a manager can later only edit/delete the groups they
// created themselves, same rule as tasks (see PATCH/DELETE
// /api/groups/[id]). Can optionally be created directly under a parent
// group (`parentId`) and/or with a "chef" (`leaderId`) — see
// lib/groups.ts's promoteLeaderIfNeeded() for what appointing one does to
// that agent's role.
export async function POST(request: Request) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  if (agent!.role !== "ADMIN" && agent!.role !== "MANAGER") {
    return NextResponse.json(
      { error: "Seuls les administrateurs et les managers peuvent créer un groupe." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom du groupe est requis." }, { status: 400 });
    }

    const memberIds = await validMemberIds(agent!.companyId, body.memberIds);

    let parentId: string | null = null;
    if (body.parentId) {
      const parent = await prisma.group.findUnique({ where: { id: body.parentId } });
      if (!parent || parent.companyId !== agent!.companyId) {
        return NextResponse.json({ error: "Groupe parent introuvable." }, { status: 400 });
      }
      parentId = parent.id;
    }

    let leaderId: string | null = null;
    if (body.leaderId) {
      const [leader] = await validMemberIds(agent!.companyId, [body.leaderId]);
      if (!leader) {
        return NextResponse.json({ error: "Chef de groupe introuvable." }, { status: 400 });
      }
      leaderId = leader;
    }

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          companyId: agent!.companyId,
          name,
          creatorId: agent!.id,
          parentId,
          leaderId,
          agents: { connect: memberIds.map((id) => ({ id })) },
        },
      });
      await promoteLeaderIfNeeded(tx, leaderId);
      return created;
    });

    return NextResponse.json(
      {
        group: {
          id: group.id,
          name: group.name,
          memberIds,
          creatorId: group.creatorId,
          parentId: group.parentId,
          leaderId: group.leaderId,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/groups failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}
