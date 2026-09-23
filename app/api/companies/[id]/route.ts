import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentSession,
  getAccessibleCompanies,
  createSession,
  createPreSession,
  clearSession,
} from "@/lib/auth";

// Renaming or deleting a company is reserved for its OWNER (Company.ownerId)
// — not just an ADMIN agent — and applies to whichever company `id` names,
// regardless of which company is currently active in the caller's session
// (the "Mes entreprises" management page lists every company the account
// can reach, only some of which it may own).
async function requireOwnedCompany(id: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Non connecté." }, { status: 401 }) };
  }

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) {
    return { error: NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 }) };
  }
  if (company.ownerId !== session.user.id) {
    return {
      error: NextResponse.json(
        { error: "Réservé au propriétaire de cette entreprise." },
        { status: 403 }
      ),
    };
  }

  return { session, company };
}

// Renames a company.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company, error } = await requireOwnedCompany(id);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Le nom de l'entreprise est requis." }, { status: 400 });
  }

  const updated = await prisma.company.update({ where: { id: company!.id }, data: { name } });
  return NextResponse.json({ company: updated });
}

// Deletes a company and everything scoped to it (cascades — see
// schema.prisma). If it was the caller's active company, switches them
// into another accessible company, or back to pre-session (no company
// left) so the middleware sends them through create-company again.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { session, company, error } = await requireOwnedCompany(id);
  if (error) return error;

  await prisma.company.delete({ where: { id: company!.id } });

  if (session!.company.id === company!.id) {
    const remaining = await getAccessibleCompanies(session!.user.id);
    if (remaining.length > 0) {
      const next = remaining[0];
      await createSession(session!.user, {
        companyId: next.company.id,
        role: next.role,
        agentId: next.agentId,
      });
    } else {
      await clearSession();
      await createPreSession(session!.user);
    }
  }

  return NextResponse.json({ ok: true });
}
