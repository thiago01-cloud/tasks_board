import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { buildInviteUrl } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/email";

// The "Envoyer par email" button shown after POST /api/agents/invite
// creates an account (see TeamForm.tsx) — deliberately a separate call
// rather than sending automatically at creation time, since the admin
// might prefer WhatsApp instead (the other button, a wa.me link that needs
// no server round-trip — see that route's own comment). Also doubles as a
// "resend" if the first email never arrived: nothing here assumes this is
// the first attempt, it just mints a fresh link and sends it.
export async function POST(request: Request) {
  const { agent, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const userId = body.userId || "";
  if (!userId) {
    return NextResponse.json({ error: "userId requis." }, { status: 400 });
  }

  // Scoped to this admin's own company — an agent record here, not just a
  // User lookup, so one admin can't use this to email an arbitrary account
  // elsewhere on the platform.
  const targetAgent = await prisma.agent.findFirst({
    where: { userId, companyId: agent!.companyId },
    include: { user: { select: { id: true, firstName: true, email: true, passwordSetAt: true } } },
  });
  if (!targetAgent) {
    return NextResponse.json({ error: "Compte introuvable dans cette entreprise." }, { status: 404 });
  }
  if (!targetAgent.user.email) {
    return NextResponse.json({ error: "Ce compte n'a pas d'adresse email." }, { status: 400 });
  }
  if (targetAgent.user.passwordSetAt) {
    return NextResponse.json(
      { error: "Ce compte a déjà choisi son mot de passe — l'invitation n'est plus utile." },
      { status: 400 }
    );
  }

  const inviteUrl = await buildInviteUrl(userId, new URL(request.url).origin);
  const emailSent = await sendInviteEmail({
    to: targetAgent.user.email,
    firstName: targetAgent.user.firstName,
    companyName: agent!.companyName,
    inviteUrl,
  });

  return NextResponse.json({
    emailSent,
    // Handed back on failure too (Resend not configured, or the send
    // itself failed) so the admin can still fall back to WhatsApp or a
    // manual copy-paste instead of a dead end.
    inviteUrl: emailSent ? undefined : inviteUrl,
  });
}
