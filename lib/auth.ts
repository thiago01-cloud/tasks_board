// Authentication helpers used by API routes and server pages.
//
// Multi-company architecture: a single "User" (login account, by phone)
// can own one or more Company, and/or hold an "Agent" record (staff) in a
// company. Login therefore happens in two steps:
//   1. Verify phone + password (User table).
//   2. Compute the list of companies accessible to this user. If there is
//      only one, connect directly to it. If there are several, set a
//      "pre-session" (authenticated, company not chosen yet) and ask them
//      to choose (see /login/choose-company).
// The full session (tasks_session cookie) therefore contains
// { userId, companyId, role, agentId }, where `role` is "OWNER" (user
// owns the company) or the Agent role ("ADMIN" | "MANAGER" | "MEMBER").
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken, verifyToken } from "./token";
import { prisma } from "./prisma";
import { SESSION_COOKIE_NAME, PRE_SESSION_COOKIE_NAME } from "./constants";

// Agent.role is a plain String in the database (SQLite has no native
// enum — see prisma/schema.prisma), validated in code instead.
export type AgentRole = "ADMIN" | "MANAGER" | "MEMBER";
export type SessionRole = "OWNER" | AgentRole;

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
const PRE_SESSION_DURATION_SECONDS = 60 * 10; // 10 minutes — time to choose a company

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Add it to your .env file (see .env.example)."
    );
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type AccessibleCompany = {
  company: { id: string; name: string };
  role: SessionRole;
  agentId: string | null;
};

// For a given user, returns the list of companies they can access (those
// they own, plus any where they hold an Agent record), with the role they
// hold there. A user who both owns and has an Agent record in the same
// company keeps the "OWNER" role (full access) while keeping their Agent
// record (useful to assign them tasks).
export async function getAccessibleCompanies(userId: string): Promise<AccessibleCompany[]> {
  const [ownedCompanies, agentRecords] = await Promise.all([
    prisma.company.findMany({ where: { ownerId: userId } }),
    prisma.agent.findMany({ where: { userId }, include: { company: true } }),
  ]);

  const byCompanyId = new Map<string, AccessibleCompany>();

  for (const company of ownedCompanies) {
    byCompanyId.set(company.id, {
      company: { id: company.id, name: company.name },
      role: "OWNER",
      agentId: null,
    });
  }

  for (const record of agentRecords) {
    const existing = byCompanyId.get(record.companyId);
    if (existing) {
      existing.agentId = record.id;
    } else {
      byCompanyId.set(record.companyId, {
        company: { id: record.company.id, name: record.company.name },
        role: record.role as AgentRole,
        agentId: record.id,
      });
    }
  }

  return Array.from(byCompanyId.values());
}

// Login step 1: the user is authenticated but hasn't chosen a company yet.
// Temporary cookie, holding only the user's id.
export async function createPreSession(user: { id: string }): Promise<void> {
  const token = await signToken({ userId: user.id }, getSecret(), PRE_SESSION_DURATION_SECONDS);
  (await cookies()).set(PRE_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PRE_SESSION_DURATION_SECONDS,
  });
}

export async function clearPreSession(): Promise<void> {
  (await cookies()).set(PRE_SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export async function getPreSessionPayload(): Promise<{ userId: string } | null> {
  const token = (await cookies()).get(PRE_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken<{ userId: string }>(token, getSecret());
}

// Step 2 (or direct login when only one company is accessible): sets the
// full session cookie for the chosen company.
export async function createSession(
  user: { id: string },
  { companyId, role, agentId }: { companyId: string; role: SessionRole; agentId: string | null }
): Promise<void> {
  const token = await signToken(
    { userId: user.id, companyId, role, agentId: agentId ?? null },
    getSecret(),
    SESSION_DURATION_SECONDS
  );

  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  await clearPreSession();
}

export async function clearSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  await clearPreSession();
}

export type SessionPayload = {
  userId: string;
  companyId: string;
  role: SessionRole;
  agentId: string | null;
};

// Reads the full session cookie and returns its contents, or null if
// absent/invalid.
export async function getSessionPayload(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken<SessionPayload>(token, getSecret());
}

// Returns the active session: the connected user (without password), plus
// the chosen company and the role held there, or null if nobody is
// connected (or if the user/company was deleted in the meantime).
export async function getCurrentSession() {
  const payload = await getSessionPayload();
  if (!payload?.userId || !payload?.companyId) return null;

  const [user, company] = await Promise.all([
    prisma.user.findUnique({ where: { id: payload.userId } }),
    prisma.company.findUnique({ where: { id: payload.companyId } }),
  ]);
  if (!user || !company) return null;

  const { passwordHash: _passwordHash, ...userWithoutPassword } = user;
  return {
    user: userWithoutPassword,
    company,
    role: payload.role,
    agentId: payload.agentId ?? null,
  };
}

// ---------------------------------------------------------------------
// Convenience wrapper used by API routes that just need "who is acting
// and in which company", without dealing with the raw session shape.
// ---------------------------------------------------------------------

export async function getCurrentAgent() {
  const session = await getCurrentSession();
  if (!session) return null;

  return {
    id: session.agentId, // Agent record in THIS company — can be null for an owner without one
    userId: session.user.id,
    companyId: session.company.id,
    companyName: session.company.name,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    fullName: `${session.user.firstName} ${session.user.lastName}`.trim(),
    country: session.user.country,
    phone: session.user.phone,
    email: session.user.email,
    role: session.role === "OWNER" ? "ADMIN" : session.role,
    displayRole: session.role, // "OWNER" | "ADMIN" | "MANAGER" | "MEMBER", for display
  };
}

// Reusable guards for API routes: return either `{ agent }` or `{ error }`
// (a JSON response ready to be returned as-is).
// Usage: const { agent, error } = await requireAgent(); if (error) return error;
export async function requireAgent() {
  const agent = await getCurrentAgent();
  if (!agent) {
    return { error: NextResponse.json({ error: "Not connected." }, { status: 401 }) };
  }
  return { agent };
}

// "Admin" in the broad sense: company owner, or agent with the ADMIN role.
export async function requireAdmin() {
  const { agent, error } = await requireAgent();
  if (error) return { error };
  if (agent!.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Reserved for administrators." }, { status: 403 }) };
  }
  return { agent };
}

// Whether `agent` may validate (mark DONE) or reject a task currently
// awaiting validation — see TASK_STATUS_LABELS.TO_VALIDATE in
// lib/enums.ts. Strictly the task's own creator; an admin only stands in
// when that creator's Agent record no longer exists in the company (e.g.
// they were removed since), so a task never gets permanently stuck with
// nobody left able to close it out. Used by both PATCH /api/tasks/[id]
// (the "Valider" transition to DONE) and POST /api/tasks/[id]/reject, plus
// app/dashboard/tasks/[id]/page.tsx to decide whether to show those
// actions at all.
export async function canValidateTask(
  agent: { id: string | null; role: string },
  task: { creatorId: string; companyId: string }
): Promise<boolean> {
  if (agent.id && agent.id === task.creatorId) return true;
  if (agent.role !== "ADMIN") return false;
  const creatorStillPresent = await prisma.agent.findFirst({
    where: { id: task.creatorId, companyId: task.companyId },
    select: { id: true },
  });
  return !creatorStillPresent;
}

// Same as requireAgent(), but guarantees agent.id is set. Task/Comment/
// Assignment/Notification all point at an Agent record (not a User), so
// an owner needs one the first time they actually touch tasks — most
// owners get one automatically now (see POST /api/companies), but an
// owner from before that fix, or any other edge case, may still show up
// here with agentId === null. Lazily creates it (ADMIN role) and
// refreshes the session cookie so the rest of the visit sees it too.
// Route Handlers only — writing the cookie needs one; never call this
// from a Server Component render.
export async function requireAgentEnsured() {
  const session = await getCurrentSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Not connected." }, { status: 401 }) };
  }

  let agentId = session.agentId;
  if (!agentId) {
    const created = await prisma.agent.upsert({
      where: { userId_companyId: { userId: session.user.id, companyId: session.company.id } },
      update: {},
      create: { userId: session.user.id, companyId: session.company.id, role: "ADMIN" },
    });
    agentId = created.id;
    await createSession(session.user, { companyId: session.company.id, role: session.role, agentId });
  }

  return {
    agent: {
      id: agentId,
      userId: session.user.id,
      companyId: session.company.id,
      companyName: session.company.name,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      fullName: `${session.user.firstName} ${session.user.lastName}`.trim(),
      country: session.user.country,
      phone: session.user.phone,
      email: session.user.email,
      role: session.role === "OWNER" ? "ADMIN" : session.role,
      displayRole: session.role,
    },
  };
}
