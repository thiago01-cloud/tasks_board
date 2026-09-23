import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent, requireAdmin } from "@/lib/auth";
import { validMemberIds } from "@/lib/groups";

// Lists the company's groups, each with its member ids — any connected
// member can read this (used both by the admin-only team page and by the
// dashboard's "avancement par groupe" section for every role).
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
      })),
    });
  } catch (err) {
    console.error("GET /api/groups failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}

// Creates a group with its initial members in one go. Reserved to admins,
// same tier as the rest of team management.
export async function POST(request: Request) {
  const { agent, error } = await requireAdmin();
  if (error) return error;

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
        agents: { connect: memberIds.map((id) => ({ id })) },
      },
    });

    return NextResponse.json({ group: { id: group.id, name: group.name, memberIds } }, { status: 201 });
  } catch (err) {
    console.error("POST /api/groups failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}
