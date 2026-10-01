import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent, type AgentRole } from "@/lib/auth";
import { canManageAccount } from "@/lib/agents";
import { composeInternationalPhone } from "@/lib/phone";
import { getCountry } from "@/lib/countries";

// Admin/owner-side "Modifier le compte" from a teammate's card (see
// TeamCard.tsx) — everything PATCH /api/account lets someone do for
// themselves, plus the role, for an account that ISN'T the signed-in
// agent's own (see canManageAccount()'s own self-exclusion in
// lib/agents.ts: editing your own account always goes through
// PATCH /api/account instead, where the role is never even offered as a
// field — nobody changes their own role here either, from either side).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent();
  if (error) return error;

  const { id } = await params;
  const target = await prisma.agent.findUnique({ where: { id } });
  if (!target || target.companyId !== agent!.companyId) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }
  if (!canManageAccount(agent!, target)) {
    return NextResponse.json({ error: "Vous ne pouvez pas gérer ce compte." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const country = (body.country || "").trim().toUpperCase();
  const email = (body.email || "").trim().toLowerCase();
  const role: AgentRole = ["ADMIN", "MANAGER", "MEMBER"].includes(body.role)
    ? body.role
    : (target.role as AgentRole);

  const countryInfo = getCountry(country);
  const phone = countryInfo ? composeInternationalPhone(countryInfo.dialCode, body.phone) : "";

  const errors: string[] = [];
  if (!firstName) errors.push("Le prénom est requis.");
  if (!lastName) errors.push("Le nom est requis.");
  if (!countryInfo) errors.push("Le pays est requis.");
  if (countryInfo && !phone.slice(countryInfo.dialCode.length)) {
    errors.push("Le numéro de téléphone est requis.");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Une adresse email valide est requise.");
  }
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const [existingPhone, existingEmail] = await Promise.all([
    prisma.user.findFirst({ where: { phone, NOT: { id: target.userId } } }),
    prisma.user.findFirst({ where: { email, NOT: { id: target.userId } } }),
  ]);
  if (existingPhone) {
    return NextResponse.json(
      { error: "Ce numéro de téléphone est déjà utilisé par un autre compte." },
      { status: 409 }
    );
  }
  if (existingEmail) {
    return NextResponse.json(
      { error: "Cette adresse email est déjà utilisée par un autre compte." },
      { status: 409 }
    );
  }

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: target.userId },
      data: { firstName, lastName, country, phone, email },
    }),
    prisma.agent.update({ where: { id: target.id }, data: { role } }),
  ]);

  return NextResponse.json({
    ok: true,
    user: {
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      email: updatedUser.email,
    },
    role,
  });
}
