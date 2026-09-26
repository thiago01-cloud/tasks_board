import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, type AgentRole } from "@/lib/auth";
import { AGENT_INCLUDE, flattenAgent } from "@/lib/agents";

export async function GET() {
  const { agent, error } = await requireAdmin();
  if (error) return error;

  const agents = await prisma.agent.findMany({
    where: { companyId: agent!.companyId },
    orderBy: { joinedAt: "asc" },
    include: AGENT_INCLUDE,
  });

  return NextResponse.json({ agents: agents.map(flattenAgent) });
}

// Step 2 of "add an existing account" — only reached once
// POST /api/agents/search found a matching account and the admin picked a
// role for it in the confirmation step (see TeamForm.tsx). Creates the
// Agent record linking that user to this company. (Brand new accounts go
// through POST /api/agents/invite instead, which creates the User too.)
export async function POST(request: Request) {
  const { agent, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const userId = (body.userId || "").trim();
  const role: AgentRole = ["ADMIN", "MANAGER"].includes(body.role) ? body.role : "MEMBER";

  if (!userId) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  const already = await prisma.agent.findUnique({
    where: { userId_companyId: { userId, companyId: agent!.companyId } },
  });
  if (already) {
    return NextResponse.json(
      { error: "Ce compte fait déjà partie de l'entreprise." },
      { status: 409 }
    );
  }

  const newAgent = await prisma.agent.create({
    data: { userId, companyId: agent!.companyId, role },
    include: AGENT_INCLUDE,
  });

  return NextResponse.json({ agent: flattenAgent(newAgent) }, { status: 201 });
}
