import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin, type AgentRole } from "@/lib/auth";
import { composeInternationalPhone, toWhatsAppNumber } from "@/lib/phone";
import { getCountry } from "@/lib/countries";
import { buildInviteUrl, inviteMessage } from "@/lib/invite";
import { AGENT_INCLUDE, flattenAgent } from "@/lib/agents";

// Step 2 of adding a teammate, only reached once POST /api/agents (step 1)
// came back with `found: false` — nobody with that phone/email exists yet.
// Creates the login account AND the Agent record linking it to this
// company in one transaction, same as before, but with two changes from
// the old flow: no password field (an invited account can't log in with a
// password until it sets one itself — see app/set-password), and email is
// now required (it's how the account is reachable at all, even if this
// particular invite gets sent over WhatsApp instead).
//
// Doesn't send anything itself — TeamForm.tsx shows two buttons after
// creation ("Envoyer par email" / "Envoyer par WhatsApp") and the admin
// picks one (or both, or neither and shares the link by hand): email goes
// through POST /api/agents/invite/email (needs the Resend API key
// server-side); WhatsApp is a wa.me link, built here and opened
// client-side — no server involvement needed to "send" it, since it's the
// admin's own WhatsApp (on whichever device they're using right now) that
// actually sends the message, not the platform.
export async function POST(request: Request) {
  const { agent, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const country = (body.country || "").trim().toUpperCase();
  const email = (body.email || "").trim().toLowerCase();
  const role: AgentRole = ["ADMIN", "MANAGER"].includes(body.role) ? body.role : "MEMBER";

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
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Une adresse email valide est requise.");
  }
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const [existingPhone, existingEmail] = await Promise.all([
    prisma.user.findUnique({ where: { phone } }),
    prisma.user.findUnique({ where: { email } }),
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

  // No password is set by the admin anymore — a random, never-shown,
  // never-usable placeholder takes its place until the invited account
  // sets its own via the link below (see app/api/auth/set-password).
  const placeholderHash = await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}`);

  const newAgent = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { firstName, lastName, country, phone, email, passwordHash: placeholderHash },
    });
    return tx.agent.create({
      data: { userId: user.id, companyId: agent!.companyId, role, createdByAgentId: agent!.id },
      include: AGENT_INCLUDE,
    });
  });

  const inviteUrl = await buildInviteUrl(newAgent.userId, new URL(request.url).origin);
  const whatsappUrl = `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(
    inviteMessage(firstName, agent!.companyName, inviteUrl, false)
  )}`;

  return NextResponse.json(
    {
      agent: flattenAgent(newAgent),
      userId: newAgent.userId,
      inviteUrl,
      whatsappUrl,
    },
    { status: 201 }
  );
}
