import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgentEnsured } from "@/lib/auth";
import { AGENT_COLOR_PALETTE } from "@/lib/colors";

// Self-service "Ma couleur" (see app/dashboard/account/ColorPickerCard.tsx)
// — every agent picks their own avatar/initials color, same self-service
// principle as PATCH /api/account for name/phone/email. Restricted to the
// fixed palette in lib/colors.ts rather than any arbitrary hex value: a
// small, curated set that's already checked for contrast against the
// white initials text (see TeamCard.tsx and TeamMemberDetail.tsx).
//
// "Les couleurs attribuées aux utilisateurs sont uniques" — enforced
// twice: the friendly pre-check below (a clear error instead of a
// confusing round-trip), and the database's own
// `@@unique([companyId, color])` (prisma/schema.prisma) as the actual
// guarantee, caught here in case two requests race each other between
// the check and the write.
export async function PATCH(request: Request) {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const color = body.color;

  if (color !== null && !AGENT_COLOR_PALETTE.includes(color)) {
    return NextResponse.json({ error: "Couleur invalide." }, { status: 400 });
  }

  if (color) {
    const takenBySomeoneElse = await prisma.agent.findFirst({
      where: { companyId: agent!.companyId, color, NOT: { id: agent!.id } },
      select: { id: true },
    });
    if (takenBySomeoneElse) {
      return NextResponse.json(
        { error: "Cette couleur est déjà utilisée par quelqu'un d'autre de l'équipe — choisissez-en une autre." },
        { status: 409 }
      );
    }
  }

  try {
    await prisma.agent.update({ where: { id: agent!.id }, data: { color } });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { error: "Cette couleur est déjà utilisée par quelqu'un d'autre de l'équipe — choisissez-en une autre." },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, color });
}
