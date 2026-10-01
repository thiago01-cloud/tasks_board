import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent, hashPassword } from "@/lib/auth";
import { canManageAccount } from "@/lib/agents";
import { buildInviteUrl, inviteMessage } from "@/lib/invite";
import { toWhatsAppNumber } from "@/lib/phone";

// "Réinitialiser le mot de passe" from a teammate's card (see
// TeamCard.tsx) — for someone who's forgotten theirs and can't log in to
// change it themselves. Never asks for, generates, or shows an actual new
// password: instead it puts the account back into exactly the state a
// brand new invite leaves it in (see POST /api/agents/invite) — an
// unusable random placeholder hash and passwordSetAt cleared — and mints
// a fresh magic login link (lib/invite.ts) that logs them straight in and,
// because passwordSetAt is now null, sends them through app/set-password
// to choose a new one before anything else (see needsPasswordSetup() in
// lib/auth.ts). Same permission tier as PATCH /api/agents/[id]/account —
// see canManageAccount() in lib/agents.ts.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent();
  if (error) return error;

  const { id } = await params;
  const target = await prisma.agent.findUnique({
    where: { id },
    include: { user: { select: { id: true, firstName: true, phone: true } } },
  });
  if (!target || target.companyId !== agent!.companyId) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }
  if (!canManageAccount(agent!, target)) {
    return NextResponse.json({ error: "Vous ne pouvez pas gérer ce compte." }, { status: 403 });
  }

  const placeholderHash = await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}`);
  await prisma.user.update({
    where: { id: target.userId },
    data: { passwordHash: placeholderHash, passwordSetAt: null },
  });

  const inviteUrl = await buildInviteUrl(target.userId, new URL(request.url).origin);
  const whatsappUrl = `https://wa.me/${toWhatsAppNumber(target.user.phone)}?text=${encodeURIComponent(
    inviteMessage(target.user.firstName, agent!.companyName, inviteUrl, false)
  )}`;

  return NextResponse.json({ inviteUrl, whatsappUrl });
}
