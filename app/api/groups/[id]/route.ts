import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgentEnsured } from "@/lib/auth";
import { validMemberIds, promoteLeaderIfNeeded, wouldCreateCycle, demoteGrouplessManager } from "@/lib/groups";

// Renaming/deleting a group is reserved to any admin, or to the manager
// who created it — same tier as tasks (see PATCH/DELETE
// /api/tasks/[id]'s own comment). A group created before `creatorId`
// existed, or whose creator has since left the company, falls back to
// admin-only.
function canManageGroup(agent: { role: string; id: string | null }, group: { creatorId: string | null }): boolean {
  return agent.role === "ADMIN" || (agent.role === "MANAGER" && group.creatorId === agent.id);
}

// Renames a group and/or replaces its membership entirely (checkbox list
// in GroupEditor.tsx submits the full member set each time, not a diff).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  try {
    const { id } = await params;
    const group = await prisma.group.findUnique({
      where: { id },
      include: { agents: { select: { id: true } } },
    });
    if (!group || group.companyId !== agent!.companyId) {
      return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });
    }

    if (!canManageGroup(agent!, group)) {
      return NextResponse.json(
        {
          error:
            "Seuls les administrateurs, ou le manager qui a créé ce groupe, peuvent le modifier.",
        },
        { status: 403 }
      );
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
    // Whoever was on the group's old member list but isn't on the new
    // one — see demoteGrouplessManager() in lib/groups.ts, run against
    // each of them below once the new list is actually saved: removing a
    // MANAGER's last group puts them back to MEMBER.
    let removedMemberIds: string[] = [];
    if (body.memberIds !== undefined) {
      memberIds = await validMemberIds(agent!.companyId, body.memberIds);
      const nextIds = new Set(memberIds);
      removedMemberIds = group.agents.map((a) => a.id).filter((aid) => !nextIds.has(aid));
      // `set` replaces the relation's full member list in one go — exactly
      // what a checkbox list submitting "here's who should be in it now"
      // needs, as opposed to connect/disconnect which would require a diff.
      data.agents = { set: memberIds.map((mid) => ({ id: mid })) };
    }

    // "Un groupe peut contenir des groupes" — re-parenting into another
    // group (or back to top-level with an explicit null). Rejected if it
    // would make this group its own (in)direct ancestor (e.g. moving
    // "Ventes" under "Ventes Nord", one of its own children).
    if (body.parentId !== undefined) {
      if (!body.parentId) {
        data.parentId = null;
      } else {
        if (body.parentId === id) {
          return NextResponse.json({ error: "Un groupe ne peut pas être son propre parent." }, { status: 400 });
        }
        const parent = await prisma.group.findUnique({ where: { id: body.parentId } });
        if (!parent || parent.companyId !== agent!.companyId) {
          return NextResponse.json({ error: "Groupe parent introuvable." }, { status: 400 });
        }
        if (await wouldCreateCycle(agent!.companyId, id, body.parentId)) {
          return NextResponse.json(
            { error: "Ce groupe contient déjà le groupe parent choisi — impossible de créer une boucle." },
            { status: 400 }
          );
        }
        data.parentId = parent.id;
      }
    }

    // Appointing/changing this group's "chef" — see
    // promoteLeaderIfNeeded() in lib/groups.ts for the MEMBER -> MANAGER
    // auto-promotion this triggers (never a demotion, and a no-op when
    // removing the chef entirely, i.e. body.leaderId is falsy).
    let nextLeaderId: string | null | undefined;
    if (body.leaderId !== undefined) {
      if (!body.leaderId) {
        nextLeaderId = null;
      } else {
        const [leader] = await validMemberIds(agent!.companyId, [body.leaderId]);
        if (!leader) {
          return NextResponse.json({ error: "Chef de groupe introuvable." }, { status: 400 });
        }
        nextLeaderId = leader;
      }
      data.leaderId = nextLeaderId;
    }

    await prisma.$transaction(async (tx) => {
      await tx.group.update({ where: { id }, data });
      if (nextLeaderId) {
        await promoteLeaderIfNeeded(tx, nextLeaderId);
      }
      for (const removedId of removedMemberIds) {
        await demoteGrouplessManager(tx, removedId);
      }
    });
    return NextResponse.json({ ok: true, memberIds });
  } catch (err) {
    console.error("PATCH /api/groups/[id] failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}

// Deletes a group. Members aren't deleted — the many-to-many join table
// Prisma manages for Agent<->Group is cleared automatically for this
// group's rows when the group itself is deleted, so no manual cleanup
// is needed here (unlike Task's own relations, which don't cascade on
// this SQLite setup).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  try {
    const { id } = await params;
    const group = await prisma.group.findUnique({
      where: { id },
      include: { agents: { select: { id: true } } },
    });
    if (!group || group.companyId !== agent!.companyId) {
      return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });
    }

    if (!canManageGroup(agent!, group)) {
      return NextResponse.json(
        {
          error:
            "Seuls les administrateurs, ou le manager qui a créé ce groupe, peuvent le supprimer.",
        },
        { status: 403 }
      );
    }

    // Deleting the group cascades its membership away too (see this
    // function's own leading comment, above) — so any of its members who
    // are a MANAGER could end up with zero groups left once it's gone;
    // see demoteGrouplessManager() in lib/groups.ts.
    const memberIds = group.agents.map((a) => a.id);
    await prisma.$transaction(async (tx) => {
      await tx.group.delete({ where: { id } });
      for (const memberId of memberIds) {
        await demoteGrouplessManager(tx, memberId);
      }
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/groups/[id] failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessayez." }, { status: 500 });
  }
}
