import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, getPreSessionPayload, getAccessibleCompanies, createSession } from "@/lib/auth";

// Lists the companies accessible to the current account (owned + agent
// memberships) — used by the "Mes entreprises" switcher in the dashboard
// sidebar.
export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const companies = await getAccessibleCompanies(session.user.id);
  return NextResponse.json({
    companies: companies.map(({ company, role }) => ({ id: company.id, name: company.name, role })),
    currentCompanyId: session.company.id,
  });
}

// Creates a company. Two possible contexts:
//  - an already fully connected account (owner of at least one company)
//    creating an additional one;
//  - an account in pre-session (authenticated, no company yet, mid
//    signup).
// Either way, the account is switched into the company it just created —
// like most apps do when you create a new workspace/organization.
export async function POST(request: Request) {
  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const name = (body.name || "").trim();

  if (!name) {
    return NextResponse.json({ error: "Le nom de l'entreprise est requis." }, { status: 400 });
  }

  const session = await getCurrentSession();
  let userId = session?.user?.id;

  if (!userId) {
    const prePayload = await getPreSessionPayload();
    userId = prePayload?.userId;
  }

  if (!userId) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  // The owner also gets an Agent record in their own company right away
  // (role ADMIN) — Task/Comment/Assignment/Notification all point at an
  // Agent, not a User directly, so without this an owner couldn't create
  // or be assigned a task until they added themselves as staff.
  const { company, ownerAgent } = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name, ownerId: userId! } });
    const ownerAgent = await tx.agent.create({
      data: { userId: userId!, companyId: company.id, role: "ADMIN" },
    });
    return { company, ownerAgent };
  });

  await createSession({ id: userId }, { companyId: company.id, role: "OWNER", agentId: ownerAgent.id });

  return NextResponse.json({ company }, { status: 201 });
}
