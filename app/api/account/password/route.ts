import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent, hashPassword, verifyPassword } from "@/lib/auth";

// Self-service password change from "Mon compte" — requires the CURRENT
// password (unlike POST /api/auth/set-password, reached right after an
// invite link where the fresh session itself is proof enough): this route
// is reachable at any time by someone already fully logged in, so proving
// they still know the old password is the point. Someone who's forgotten
// their password and can't log in at all needs an admin/owner to use
// POST /api/agents/[id]/reset-password on their card instead — that route
// never asks for, and nobody but the account holder ever sees, an actual
// password.
export async function PATCH(request: Request) {
  const { agent, error } = await requireAgent();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const currentPassword = body.currentPassword || "";
  const newPassword = body.newPassword || "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Mot de passe actuel et nouveau mot de passe requis." },
      { status: 400 }
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: agent!.userId } });
  if (!user) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 401 });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
