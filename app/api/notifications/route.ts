import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";

// Lists the current agent's notifications (most recent first) plus how
// many are unread — powers the bell in the sidebar (NotificationBell.tsx).
// Every task interaction (assignment, status/progress change, edit,
// comment — see PATCH /api/tasks/[id] and POST /api/tasks/[id]/comments)
// creates one of these per person linked to that task.
export async function GET() {
  const { agent, error } = await requireAgent();
  if (error) return error;

  // An owner who's never touched a task yet may still have no Agent
  // record in this company (see requireAgentEnsured) — nothing to list.
  if (!agent!.id) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { agentId: agent!.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { task: { select: { id: true, title: true } } },
      }),
      prisma.notification.count({ where: { agentId: agent!.id, read: false } }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        task: n.task ? { id: n.task.id, title: n.task.title } : null,
      })),
      unreadCount,
    });
  } catch (err) {
    console.error("GET /api/notifications failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}

// Marks one notification ({ id }) or all of them ({ all: true }) as read.
export async function PATCH(request: Request) {
  const { agent, error } = await requireAgent();
  if (error) return error;

  if (!agent!.id) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = await request.json().catch(() => ({}));

    if (body.all) {
      await prisma.notification.updateMany({
        where: { agentId: agent!.id, read: false },
        data: { read: true },
      });
      return NextResponse.json({ ok: true });
    }

    const id = typeof body.id === "string" ? body.id : null;
    if (!id) {
      return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
    }

    // `updateMany` with agentId in the filter both scopes the write to its
    // owner and silently no-ops if the id doesn't belong to them, instead
    // of needing a separate existence/ownership check first.
    await prisma.notification.updateMany({
      where: { id, agentId: agent!.id },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/notifications failed:", err);
    return NextResponse.json({ error: "Erreur serveur. Réessaie." }, { status: 500 });
  }
}
