import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { pageTitle } from "@/lib/constants";
import AccountForm from "./AccountForm";
import PasswordForm from "./PasswordForm";

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

      <div className="card" style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Mot de passe</h3>
        <PasswordForm />
      </div>
    </div>
  );
}
