import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { validMemberIds } from "@/lib/groups";

// Renames a group and/or replaces its membership entirely (checkbox list
// in GroupEditor.tsx submits the full member set each time, not a diff).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const group = await prisma.group.findUnique({ where: { id } });
    if (!group || group.companyId !== agent!.companyId) {
      return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if (body.name !== undefined) {
      const name = String(body.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "Le nom du groupe est requis." }, { status: 400 });
      }
      data.name = name;
    }

    let memberIds: string[] | null = null;
    if (body.memberIds !== undefined) {
      memberIds = await validMemberIds(agent!.companyId, body.memberIds);
      // `set` replaces the relation's full member list in one go — exactly
      // what a checkbox list submitting "here's who should be in it now"
      // needs, as opposed to connect/disconnect which would require a diff.
      data.agents = { set: memberIds.map((mid) => ({ id: mid })) };
    }

    await prisma.group.update({ where: { id }, data });
    return NextResponse.json({ ok: true, memberIds });
  } catch (err) {
    console.error("PATCH /api/groups/[id] failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}

// Deletes a group. Members aren't deleted — the many-to-many join table
// Prisma manages for Agent<->Group is cleared automatically for this
// group's rows when the group itself is deleted, so no manual cleanup
// is needed here (unlike Task's own relations, which don't cascade on
// this SQLite setup).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const group = await prisma.group.findUnique({ where: { id } });
    if (!group || group.companyId !== agent!.companyId) {
      return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });
    }

    await prisma.group.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/groups/[id] failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}
