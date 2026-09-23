import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// Group membership is managed from the group's own side now (an agent can
// belong to several groups at once — see GroupEditor.tsx and
// PATCH /api/groups/[id]), so this route stays DELETE-only.
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
