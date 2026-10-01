import Link from "next/link";
import { AGENT_ROLE_LABELS } from "@/lib/enums";
import { MailIcon, PhoneIcon, initials } from "./icons";

type TeamMember = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  country: string;
  phone: string;
  email: string | null;
  role: string;
  groupNames: string[];
  canManageSubscription: boolean;
};

// Plain summary card — every action that used to live here directly
// (share the login link, edit the account, reset the password, grant
// subscription management, delete) now lives on its own detail page (see
// team/[id]/TeamMemberDetail.tsx), reached through "Gérer ce compte"
// below. Packing all five actions as buttons on the card itself used to
// overflow badly once account management was added on top of the
// subscription-manager toggle — a plain server component here now, no
// client state of its own.
export default function TeamCard({
  agent,
  isMe,
  canManage,
  canDelete,
  canGrantSubscriptionManager,
  canManageAccount,
}: {
  agent: TeamMember;
  isMe: boolean;
  canManage: boolean;
  canDelete: boolean;
  canGrantSubscriptionManager: boolean;
  canManageAccount: boolean;
}) {
  const canOpenDetail = !isMe && (canManage || canDelete || canGrantSubscriptionManager || canManageAccount);

  return (
    <div className="card team-card">
      <div className="team-card-top">
        <div className="team-card-avatar">{initials(agent.firstName, agent.lastName)}</div>
        <div className="team-card-identity">
          <p className="team-card-name">
            {agent.firstName} {agent.lastName}
            {isMe && " (vous)"}
          </p>
          <p className="team-card-role">{AGENT_ROLE_LABELS[agent.role] || "Membre"}</p>
        </div>
        <span className="badge">{AGENT_ROLE_LABELS[agent.role] || "Membre"}</span>
      </div>

      <div className="team-card-groups">
        {agent.groupNames.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>Sans groupe</span>
        ) : (
          agent.groupNames.map((name) => (
            <span key={name} className="badge">
              {name}
            </span>
          ))
        )}
        {agent.canManageSubscription && (
          <span className="badge" style={{ color: "var(--color-success)", borderColor: "var(--color-success)" }}>
            Gère l&apos;abonnement
          </span>
        )}
      </div>

      <div className="team-card-contact">
        <span className="team-card-contact-row" title={agent.email || undefined}>
          <MailIcon />
          {agent.email || "—"}
        </span>
        <span className="team-card-contact-row" title={agent.phone}>
          <PhoneIcon />
          {agent.phone}
        </span>
      </div>

      {canOpenDetail && (
        <div className="team-card-actions">
          <Link
            href={`/dashboard/team/${agent.id}`}
            className="button-secondary button"
            style={{ padding: "5px 10px", fontSize: 13, textDecoration: "none" }}
          >
            Gérer ce compte
          </Link>
        </div>
      )}
    </div>
  );
}
