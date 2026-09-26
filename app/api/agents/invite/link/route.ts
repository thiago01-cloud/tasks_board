import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/auth";
import { toWhatsAppNumber } from "@/lib/phone";
import { buildInviteUrl, inviteMessage } from "@/lib/invite";
import { canManageAgent } from "@/lib/agents";

// Backs the "Partager le lien de connexion" button shown on every team
// card (see TeamCard.tsx) except the viewer's own — lets an admin or
// manager mint a fresh magic login link, and the wa.me link built from
// it, for ANY teammate at any time, not just right after their account was
// first created (see POST /api/agents/invite for that first-run version)
// and not just while they're still mid-onboarding: the same link works —
// and just logs the person straight in — for someone who set their
// password months ago too, as a standing "help them back in" shortcut.
// Doesn't send anything itself — same split as the creation flow: the
// WhatsApp link opens client-side with no server round-trip, and
// POST /api/agents/invite/email is the separate "send by email now" call.
//
// Restricted by canManageAgent() (lib/agents.ts): an admin may act on
// anyone but the company's owner, a manager only on accounts they
// themselves added (see Agent.createdByAgentId).
export async function POST(request: Request) {
  const { agent, error } = await requireAdminOrManager();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const userId = (body.userId || "").trim();
  if (!userId) {
    return NextResponse.json({ error: "userId requis." }, { status: 400 });
  }

  // Scoped to this admin/manager's own company, same as
  // POST /api/agents/invite/email.
  const targetAgent = await prisma.agent.findFirst({
    where: { userId, companyId: agent!.companyId },
    include: { user: { select: { firstName: true, phone: true, passwordSetAt: true } } },
  });
  if (!targetAgent) {
    return NextResponse.json({ error: "Compte introuvable dans cette entreprise." }, { status: 404 });
  }
  if (!canManageAgent(agent!, targetAgent, agent!.ownerId)) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas gérer ce compte." },
      { status: 403 }
    );
  }

  const inviteUrl = await buildInviteUrl(userId, new URL(request.url).origin);
  const whatsappUrl = `https://wa.me/${toWhatsAppNumber(targetAgent.user.phone)}?text=${encodeURIComponent(
    inviteMessage(targetAgent.user.firstName, agent!.companyName, inviteUrl, !!targetAgent.user.passwordSetAt)
  )}`;

  return NextResponse.json({ inviteUrl, whatsappUrl });
}
