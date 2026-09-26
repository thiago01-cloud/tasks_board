import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { canManageAgent } from "@/lib/agents";

// Group membership is managed from the group's own side now (an agent can
// belong to several groups at once — see GroupEditor.tsx and
// PATCH /api/groups/[id]), so this route stays DELETE-only.
//
// Stays reserved for admins (requireAdmin, not requireAdminOrManager) —
// unlike sharing a login link again (POST /api/agents/invite/link,
// POST /api/agents/invite/email), removing an account outright wasn't
// asked to be opened up to managers. canManageAgent() still gets a say
// here though, for its owner-exclusion: an admin may remove anyone in the
// company except the company's own owner (target.userId === agent.userId
// below already covers deleting yourself; this covers an admin who isn't
// the owner trying to remove the owner's separate Agent record).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { agent, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const target = await prisma.agent.findUnique({ where: { id } });
  if (!target || target.companyId !== agent!.companyId) {
    return NextResponse.json({ error: "Agent introuvable." }, { status: 404 });
  }

  if (target.userId === agent!.userId) {
    return NextResponse.json(
      { error: "Impossible de supprimer son propre compte." },
      { status: 400 }
    );
  }

  if (!canManageAgent(agent!, target, agent!.ownerId)) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer le compte du propriétaire." },
      { status: 403 }
    );
  }

  if (target.role === "ADMIN") {
    const adminCount = await prisma.agent.count({
      where: { companyId: agent!.companyId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Impossible de supprimer le dernier administrateur de cette entreprise." },
        { status: 400 }
      );
    }
  }

  await prisma.agent.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
