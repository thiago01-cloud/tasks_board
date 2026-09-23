import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin, type AgentRole } from "@/lib/auth";
import { composeInternationalPhone } from "@/lib/phone";
import { getCountry } from "@/lib/countries";

function flattenAgent(a: {
  id: string;
  role: string;
  joinedAt: Date;
  userId: string;
  user: { id: string; firstName: string; lastName: string; phone: string; email: string | null };
}) {
  return {
    id: a.id,
    role: a.role,
    joinedAt: a.joinedAt,
    userId: a.userId,
    firstName: a.user.firstName,
    lastName: a.user.lastName,
    phone: a.user.phone,
    email: a.user.email,
  };
}

export async function GET() {
  const { agent, error } = await requireAdmin();
  if (error) return error;

  const agents = await prisma.agent.findMany({
    where: { companyId: agent!.companyId },
    orderBy: { joinedAt: "asc" },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
    },
  });

  return NextResponse.json({ agents: agents.map(flattenAgent) });
}

export async function POST(request: Request) {
  const { agent, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const country = (body.country || "").trim().toUpperCase();
  const email = (body.email || "").trim().toLowerCase() || null;
  const password = body.password || "";
  const role: AgentRole = ["ADMIN", "MANAGER"].includes(body.role) ? body.role : "MEMBER";

  // `phone` is composed server-side from the country's dial code + the
  // locally-typed number, so the two can never end up out of sync — see
  // composeInternationalPhone() in lib/phone.ts.
  const countryInfo = getCountry(country);
  const phone = countryInfo ? composeInternationalPhone(countryInfo.dialCode, body.phone) : "";

  if (
    !firstName ||
    !lastName ||
    !countryInfo ||
    !phone.slice(countryInfo?.dialCode.length ?? 0) ||
    password.length < 8
  ) {
    return NextResponse.json(
      {
        error:
          "Prénom, nom, pays, numéro de téléphone et mot de passe (8 caractères minimum) sont requis.",
      },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { phone } });
  if (existingUser) {
    return NextResponse.json(
      { error: "Ce numéro de téléphone est déjà utilisé par un autre compte." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);

  // Create the login account and its "agent" record in this company in a
  // single transaction, so we never end up with one without the other.
  const newAgent = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { firstName, lastName, country, phone, email, passwordHash },
    });
    return tx.agent.create({
      data: { userId: user.id, companyId: agent!.companyId, role },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      },
    });
  });

  return NextResponse.json({ agent: flattenAgent(newAgent) }, { status: 201 });
}
