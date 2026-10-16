import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageTitle } from "@/lib/constants";
import { assignAgentColors, AGENT_COLOR_PALETTE } from "@/lib/colors";
import AccountForm from "./AccountForm";
import PasswordForm from "./PasswordForm";
import PushNotificationsCard from "./PushNotificationsCard";
import ColorPickerCard from "./ColorPickerCard";

export const metadata = {
  title: pageTitle("Mon compte"),
};

// "Mon compte" — the one dashboard page open to every signed-in account
// regardless of role (owner, admin, manager, member alike): editing your
// OWN name/country/phone/email/password (see PATCH /api/account and
// PATCH /api/account/password). Managing anyone ELSE's account happens
// from their card on the Équipe page instead (see
// app/dashboard/team/TeamCard.tsx), gated by canManageAccount() in
// lib/agents.ts — including the role field, which this page never offers:
// nobody changes their own role, not even the owner.
export default async function AccountPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");

  // Color is per-Agent, not part of the session — see Agent.color in
  // prisma/schema.prisma — and getCurrentAgent() doesn't carry it, so the
  // whole company's agents are read directly here, same whole-company
  // reasoning as app/dashboard/team/page.tsx's own colorMap: uniqueness
  // ("les couleurs attribuées aux utilisateurs sont uniques") only means
  // something when every agent who might collide is considered together,
  // and the picker needs to know which palette colors are already taken
  // by someone ELSE so it can grey those out. Can be empty/missing (an
  // owner who never got an Agent record — see getCurrentAgent()'s own
  // comment on agent.id); the color card just doesn't apply to that edge
  // case.
  const companyAgentColors = agent.id
    ? await prisma.agent.findMany({ where: { companyId: agent.companyId }, select: { id: true, color: true } })
    : [];
  const colorMap = assignAgentColors(companyAgentColors);
  const takenByOthers = AGENT_COLOR_PALETTE.filter((swatch) =>
    companyAgentColors.some((a) => a.id !== agent.id && a.color === swatch)
  );

  return (
    <div>
      <div className="page-header">
        <h1>Mon compte</h1>
      </div>

      <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Informations</h3>
        <AccountForm
          initial={{
            firstName: agent.firstName,
            lastName: agent.lastName,
            country: agent.country,
            phone: agent.phone,
            email: agent.email || "",
          }}
        />
      </div>

      <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Mot de passe</h3>
        <PasswordForm />
      </div>

      {agent.id && (
        <ColorPickerCard
          effectiveColor={colorMap.get(agent.id)!}
          initialColor={companyAgentColors.find((a) => a.id === agent.id)?.color ?? null}
          takenByOthers={takenByOthers}
        />
      )}

      <PushNotificationsCard />
    </div>
  );
}
