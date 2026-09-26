import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";

// Lets the company's OWNER delegate (or revoke) the right to manage the
// subscription (app/dashboard/subscription — choose/change/cancel the
// plan, toggle add-ons) to another agent — see canManageSubscription()
// in lib/auth.ts, which the owner always passes regardless of this flag.
// Deliberately owner-only, not admin-or-owner like most other management
// actions here: this is the one right in the app the owner doesn't share
// with every admin by default, only by explicitly granting it per agent
// (see TeamCard.tsx's own toggle).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent();
  if (error) return error;

  if (agent!.userId !== agent!.ownerId) {
    return NextResponse.json({ error: "Réservé au propriétaire de l'entreprise." }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.agent.findUnique({ where: { id } });
  if (!target || target.companyId !== agent!.companyId) {
    return NextResponse.json({ error: "Agent introuvable." }, { status: 404 });
  }
  if (target.userId === agent!.ownerId) {
    return NextResponse.json({ error: "Le propriétaire dispose déjà de ce droit." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const canManageSubscription = !!body.canManageSubscription;

  await prisma.agent.update({ where: { id }, data: { canManageSubscription } });
  return NextResponse.json({ ok: true, canManageSubscription });
}
