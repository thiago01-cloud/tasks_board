import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent, requireAgentEnsured } from "@/lib/auth";
import { validMemberIds } from "@/lib/groups";

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
      include: { agents: { select: { id: true } } },
    });

    return NextResponse.json({
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        memberIds: g.agents.map((a) => a.id),
        creatorId: g.creatorId,
      })),
    });
  } catch (err) {
    console.error("GET /api/groups failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}

// Creates a group with its initial members in one go. Open to admins and
// managers alike — a manager can later only edit/delete the groups they
// created themselves, same rule as tasks (see PATCH/DELETE
// /api/groups/[id]).
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

    const group = await prisma.group.create({
      data: {
        companyId: agent!.companyId,
        name,
        creatorId: agent!.id,
        agents: { connect: memberIds.map((id) => ({ id })) },
      },
    });

    return NextResponse.json(
      { group: { id: group.id, name: group.name, memberIds, creatorId: group.creatorId } },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/groups failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}
