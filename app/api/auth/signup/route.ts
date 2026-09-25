import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createPreSession } from "@/lib/auth";
import { composeInternationalPhone } from "@/lib/phone";
import { getCountry } from "@/lib/countries";

export async function POST(request: Request) {
  let body: {
    firstName?: string;
    lastName?: string;
    country?: string;
    phone?: string;
    password?: string;
    email?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const country = (body.country || "").trim().toUpperCase();
  const password = body.password || "";
  const email = body.email?.trim().toLowerCase() || null;

  const countryInfo = getCountry(country);
  // `phone` is composed server-side from the country's dial code + the
  // locally-typed number, so the two can never end up out of sync — see
  // composeInternationalPhone() in lib/phone.ts.
  const phone = countryInfo ? composeInternationalPhone(countryInfo.dialCode, body.phone) : "";

  const errors: string[] = [];
  if (!firstName) errors.push("Le prénom est requis.");
  if (!lastName) errors.push("Le nom est requis.");
  if (!countryInfo) errors.push("Le pays est requis.");
  if (countryInfo && !phone.slice(countryInfo.dialCode.length)) {
    errors.push("Le numéro de téléphone est requis.");
  }
  if (password.length < 8) errors.push("Le mot de passe doit contenir au moins 8 caractères.");
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec ce numéro de téléphone." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    // Self-signup chooses its own password right here, unlike an invited
    // teammate (see POST /api/agents/invite) — passwordSetAt is set
    // immediately so it's never sent to app/set-password.
    data: { firstName, lastName, country, phone, passwordHash, email, passwordSetAt: new Date() },
  });

  // A brand new account has no company yet: set a pre-session while it
  // creates its first company.
  await createPreSession(user);
  return NextResponse.json({ step: "create_company" }, { status: 201 });
}
