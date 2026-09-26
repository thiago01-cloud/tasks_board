import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/auth";
import { buildInviteUrl } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/email";
import { canManageAgent } from "@/lib/agents";

// The "Envoyer par email" button shown right after POST /api/agents/invite
// creates an account (see TeamForm.tsx), and again on that teammate's team
// card at any time, not just while they still haven't set a password (see
// TeamCard.tsx and POST /api/agents/invite/link, its WhatsApp-only
// sibling) — deliberately a separate call rather than sending
// automatically at creation time, since the admin/manager might prefer
// WhatsApp instead. Also doubles as a "resend" if the first email never
// arrived, or a standing "help them back in" shortcut for an account that
// set its password long ago: nothing here assumes this is the first
// attempt, it just mints a fresh link and sends it.
//
// Restricted by canManageAgent() (lib/agents.ts): an admin may act on
// anyone but the company's owner, a manager only on accounts they
// themselves added (see Agent.createdByAgentId).
export async function POST(request: Request) {
  const { agent, error } = await requireAdminOrManager();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const userId = body.userId || "";
  if (!userId) {
    return NextResponse.json({ error: "userId requis." }, { status: 400 });
  }

  // Scoped to this admin/manager's own company — an agent record here,
  // not just a User lookup, so nobody can use this to email an arbitrary
  // account elsewhere on the platform.
  const targetAgent = await prisma.agent.findFirst({
    where: { userId, companyId: agent!.companyId },
    include: { user: { select: { id: true, firstName: true, email: true, passwordSetAt: true } } },
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
  if (!targetAgent.user.email) {
    return NextResponse.json({ error: "Ce compte n'a pas d'adresse email." }, { status: 400 });
  }

  const inviteUrl = await buildInviteUrl(userId, new URL(request.url).origin);
  const emailSent = await sendInviteEmail({
    to: targetAgent.user.email,
    firstName: targetAgent.user.firstName,
    companyName: agent!.companyName,
    inviteUrl,
    alreadyActive: !!targetAgent.user.passwordSetAt,
  });

  return NextResponse.json({
    emailSent,
    // Handed back on failure too (Resend not configured, or the send
    // itself failed) so the admin can still fall back to WhatsApp or a
    // manual copy-paste instead of a dead end.
    inviteUrl: emailSent ? undefined : inviteUrl,
  });
}
