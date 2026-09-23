import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPreSessionPayload, getAccessibleCompanies, createSession } from "@/lib/auth";

// Second login step, when an account can access several companies:
// confirms the choice and turns the pre-session into a full session for
// the chosen company.
export async function POST(request: Request) {
  const prePayload = await getPreSessionPayload();
  if (!prePayload?.userId) {
    return NextResponse.json(
      { error: "Session expirée, merci de te reconnecter." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise invalide." }, { status: 400 });
  }

  const companies = await getAccessibleCompanies(prePayload.userId);
  const choice = companies.find((item) => item.company.id === companyId);
  if (!choice) {
    return NextResponse.json({ error: "Tu n'as pas accès à cette entreprise." }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: prePayload.userId } });
  if (!user) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  await createSession(user, { companyId: choice.company.id, role: choice.role, agentId: choice.agentId });
  return NextResponse.json({ ok: true });
}
