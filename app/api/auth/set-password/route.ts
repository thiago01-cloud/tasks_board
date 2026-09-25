import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, hashPassword } from "@/lib/auth";

// The one thing an invited account (see POST /api/agents/invite) has to do
// before it can use the rest of the dashboard — see needsPasswordSetup()
// in lib/auth.ts and the redirect in app/dashboard/layout.tsx. Uses the
// SESSION (already created by GET /api/auth/accept-invite when the invite
// link was clicked), not a token — by this point the account is already
// logged in, this is just "choose your password", not "prove who you are".
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not connected." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const password = body.password || "";
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit contenir au moins 8 caractères." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash, passwordSetAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
