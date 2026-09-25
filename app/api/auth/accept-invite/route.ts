import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, createPreSession, getAccessibleCompanies } from "@/lib/auth";
import { verifyToken } from "@/lib/token";

// The link an invited teammate clicks from their email (see
// POST /api/agents/invite, which generates the token, and lib/email.ts,
// which sends it). A GET, not a POST — it's meant to be opened directly by
// following the link, no form involved. Logs the account in immediately
// (same "how many companies can this account reach" branching as
// POST /api/auth/login) and sends it straight to app/set-password, which
// is the one thing standing between it and the rest of the dashboard — see
// needsPasswordSetup() in lib/auth.ts.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token") || "";

  const payload = await verifyToken<{ userId: string; purpose: string }>(
    token,
    process.env.JWT_SECRET as string
  );

  if (!payload || payload.purpose !== "invite" || !payload.userId) {
    return NextResponse.redirect(new URL("/login?error=invite_invalid", origin));
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=invite_invalid", origin));
  }

  // Already completed setup — this exact link was used before (or the
  // account since logged in and changed its password some other way).
  // Re-using a stale link to log back in without a password would defeat
  // the point of having one, so send it to the normal login form instead.
  if (user.passwordSetAt) {
    return NextResponse.redirect(new URL("/login?notice=invite_used", origin));
  }

  const companies = await getAccessibleCompanies(user.id);

  if (companies.length === 0) {
    // Shouldn't happen (this account was just given an Agent record by the
    // invite that minted this token) — defensive fallback only.
    await createPreSession(user);
    return NextResponse.redirect(new URL("/create-company", origin));
  }

  if (companies.length === 1) {
    const { company, role, agentId } = companies[0];
    await createSession(user, { companyId: company.id, role, agentId });
    return NextResponse.redirect(new URL("/set-password", origin));
  }

  // Invited to more than one company before ever setting a password
  // (independently, by two different admins): let it choose first — once
  // it does, POST /api/auth/choose-company creates the full session and
  // dashboard/layout.tsx's own needsPasswordSetup() check takes it to
  // /set-password from there.
  await createPreSession(user);
  return NextResponse.redirect(new URL("/login/choose-company", origin));
}
