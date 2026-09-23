import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createPreSession,
  createSession,
  getAccessibleCompanies,
} from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export async function POST(request: Request) {
  let body: { phone?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const phone = normalizePhone(body.phone || "");
  const password = body.password || "";

  if (!phone || !password) {
    return NextResponse.json(
      { error: "Numéro de téléphone et mot de passe requis." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { phone } });

  // Deliberately identical message in both cases (unknown number or wrong
  // password), so an attacker can't tell whether the number exists.
  const invalidCredentials = () =>
    NextResponse.json({ error: "Numéro de téléphone ou mot de passe incorrect." }, { status: 401 });

  if (!user) return invalidCredentials();

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) return invalidCredentials();

  const companies = await getAccessibleCompanies(user.id);

  // No accessible company: the account is authenticated, but must create
  // its company before reaching the dashboard.
  if (companies.length === 0) {
    await createPreSession(user);
    return NextResponse.json({ step: "create_company" });
  }

  // A single accessible company: connect directly to it.
  if (companies.length === 1) {
    const { company, role, agentId } = companies[0];
    await createSession(user, { companyId: company.id, role, agentId });
    return NextResponse.json({ step: "connected", company: { id: company.id, name: company.name } });
  }

  // Several accessible companies: the account is authenticated, but still
  // has to choose which one to visit.
  await createPreSession(user);
  return NextResponse.json({
    step: "choose_company",
    companies: companies.map(({ company, role }) => ({ id: company.id, name: company.name, role })),
  });
}
