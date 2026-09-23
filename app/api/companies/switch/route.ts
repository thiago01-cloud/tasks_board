import { NextResponse } from "next/server";
import { getCurrentSession, getAccessibleCompanies, createSession } from "@/lib/auth";

// Switches the active company for an already fully logged-in account,
// without a logout/login round trip — used by the "Mes entreprises" menu
// in the dashboard sidebar.
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise invalide." }, { status: 400 });
  }

  if (companyId === session.company.id) {
    return NextResponse.json({ ok: true });
  }

  const companies = await getAccessibleCompanies(session.user.id);
  const choice = companies.find((item) => item.company.id === companyId);
  if (!choice) {
    return NextResponse.json({ error: "Tu n'as pas accès à cette entreprise." }, { status: 403 });
  }

  await createSession(session.user, {
    companyId: choice.company.id,
    role: choice.role,
    agentId: choice.agentId,
  });

  return NextResponse.json({ ok: true });
}
