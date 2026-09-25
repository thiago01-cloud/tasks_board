import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { looksLikeEmail, resolvePhoneQuery } from "@/lib/phone";

// Step 1 of adding a teammate (see TeamForm.tsx): look up a phone number or
// email against EXISTING accounts (any company — accounts are shared login
// identities, see prisma/schema.prisma's own comment on User). Lookup only
// — no Agent record is created here, so no role is needed yet either. Two
// outcomes:
//   - found: the admin reviews who this is and picks a role in a
//     confirmation step, which then calls POST /api/agents (with the
//     userId returned here) to actually create the link.
//   - not found: nothing to create yet — the frontend switches to the
//     full "new account" form (see POST /api/agents/invite), prefilled
//     with whatever was already typed here.
export async function POST(request: Request) {
  const { agent, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const query = (body.query || "").trim();

  if (!query) {
    return NextResponse.json({ error: "Numéro de téléphone ou email requis." }, { status: 400 });
  }

  const isEmail = looksLikeEmail(query);
  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: query.toLowerCase() } })
    : await prisma.user.findUnique({ where: { phone: resolvePhoneQuery(query) } });

  if (!user) {
    return NextResponse.json({
      found: false,
      prefill: isEmail ? { email: query.toLowerCase() } : { phone: query },
    });
  }

  // Caught here rather than only at link time so the admin isn't asked to
  // pick a role for someone who's already on the team.
  const already = await prisma.agent.findUnique({
    where: { userId_companyId: { userId: user.id, companyId: agent!.companyId } },
  });
  if (already) {
    return NextResponse.json(
      { error: "Ce compte fait déjà partie de l'entreprise." },
      { status: 409 }
    );
  }

  return NextResponse.json({
    found: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      email: user.email,
    },
  });
}
