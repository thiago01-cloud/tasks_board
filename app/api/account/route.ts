import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { composeInternationalPhone } from "@/lib/phone";
import { getCountry } from "@/lib/countries";

// Self-service "Mon compte" edit (see app/dashboard/account) — every
// signed-in account, whatever its role, may update its OWN
// name/country/phone/email this way. Nobody edits someone ELSE's account
// through this route — that's PATCH /api/agents/[id]/account instead,
// gated by canManageAccount() in lib/agents.ts, which also covers the
// role field this route deliberately never accepts: nobody, not even the
// owner, changes their own role.
export async function PATCH(request: Request) {
  const { agent, error } = await requireAgent();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const country = (body.country || "").trim().toUpperCase();
  const email = (body.email || "").trim().toLowerCase();

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
    prisma.user.findFirst({ where: { phone, NOT: { id: agent!.userId } } }),
    prisma.user.findFirst({ where: { email, NOT: { id: agent!.userId } } }),
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

  const updated = await prisma.user.update({
    where: { id: agent!.userId },
    data: { firstName, lastName, country, phone, email },
  });

  return NextResponse.json({
    ok: true,
    user: {
      firstName: updated.firstName,
      lastName: updated.lastName,
      country: updated.country,
      phone: updated.phone,
      email: updated.email,
    },
  });
}
