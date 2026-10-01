"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AGENT_ROLE_LABELS } from "@/lib/enums";
import { useConfirm } from "../../ConfirmProvider";
import Modal from "../../Modal";
import PhoneField from "../../../components/PhoneField";
import { toLocalNumberForPhoneField } from "@/lib/phone";
import { MailIcon, PhoneIcon, initials } from "../icons";

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

// An action row on this page — a short label/description on the left, one
// button on the right, full width so nothing has to wrap or overflow the
// way five buttons crammed onto a team card used to (see TeamCard.tsx's
// own comment).
function ActionRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5 }}>{title}</p>
        {description && (
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>{description}</p>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export default function TeamMemberDetail({
  agent,
  canManage,
  canDelete,
  canGrantSubscriptionManager,
  canManageAccount,
}: {
  agent: TeamMember;
  // Whether the viewer may share this teammate's login link right now —
  // see canManageAgent() in lib/agents.ts: an admin may act on anyone but
  // the company's owner, a manager only on accounts they themselves added.
  canManage: boolean;
  canDelete: boolean;
  // Whether the VIEWER is the company's owner — the only account allowed
  // to grant/revoke this teammate's right to manage the subscription.
  canGrantSubscriptionManager: boolean;
  // Whether the viewer may edit this teammate's account details or reset
  // their password — see canManageAccount() in lib/agents.ts.
  canManageAccount: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subscriptionManager, setSubscriptionManager] = useState(agent.canManageSubscription);
  const [subscriptionManagerLoading, setSubscriptionManagerLoading] = useState(false);

  // "Modifier le compte" — edits name/country/phone/email/role for THIS
  // teammate (see PATCH /api/agents/[id]/account), distinct from the
  // self-service "Mon compte" page everyone uses on their own account.
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [editFirstName, setEditFirstName] = useState(agent.firstName);
  const [editLastName, setEditLastName] = useState(agent.lastName);
  const [editCountry, setEditCountry] = useState(agent.country);
  const [editPhone, setEditPhone] = useState(toLocalNumberForPhoneField(agent.phone));
  const [editEmail, setEditEmail] = useState(agent.email || "");
  const [editRole, setEditRole] = useState(agent.role);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // "Réinitialiser le mot de passe" — see POST
  // /api/agents/[id]/reset-password's own comment: never a raw password,
  // just the same magic-link mechanism (and the same modal/loading state)
  // as "Partager le lien de connexion" below, with `resetNotice` true so
  // the modal makes clear the old password no longer works.
  const [resetNotice, setResetNotice] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<{ inviteUrl: string; whatsappUrl: string } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [emailSendLoading, setEmailSendLoading] = useState(false);
  const [emailSendResult, setEmailSendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [whatsappOpened, setWhatsappOpened] = useState(false);

  async function handleOpenInvite() {
    setShowInvite(true);
    setResetNotice(false);
    if (inviteLinks) return; // already fetched — no need to mint another token

    setLinkLoading(true);
    setLinkError("");
    try {
      const res = await fetch("/api/agents/invite/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: agent.userId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLinkError(data.error || "Une erreur est survenue.");
      } else {
        setInviteLinks({ inviteUrl: data.inviteUrl, whatsappUrl: data.whatsappUrl });
      }
    } catch {
      setLinkError("Impossible de contacter le serveur.");
    }
    setLinkLoading(false);
  }

  async function handleSendEmail() {
    setEmailSendLoading(true);
    setEmailSendResult(null);
    try {
      const res = await fetch("/api/agents/invite/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: agent.userId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setEmailSendResult({ ok: false, message: data.error || "Une erreur est survenue." });
      } else if (data.emailSent) {
        setEmailSendResult({ ok: true, message: `Email envoyé à ${agent.firstName}.` });
      } else {
        setEmailSendResult({
          ok: false,
          message: "L'email n'a pas pu être envoyé (service email non configuré) — utilisez WhatsApp ou copiez le lien.",
        });
      }
    } catch {
      setEmailSendResult({ ok: false, message: "Impossible de contacter le serveur." });
    }
    setEmailSendLoading(false);
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Supprimer le compte de ${agent.firstName} ${agent.lastName} ?`,
      message: "Cette action est irréversible.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Suppression impossible.");
        setLoading(false);
        return;
      }

      router.push("/dashboard/team");
    } catch {
      setError("Impossible de contacter le serveur. Réessayez.");
      setLoading(false);
    }
  }

  async function handleToggleSubscriptionManager() {
    const next = !subscriptionManager;
    const ok = await confirm({
      title: next
        ? `Autoriser ${agent.firstName} ${agent.lastName} à gérer l'abonnement ?`
        : `Retirer à ${agent.firstName} ${agent.lastName} le droit de gérer l'abonnement ?`,
      message: next
        ? "Cette personne pourra choisir, changer ou résilier l'offre de l'entreprise, et gérer les options additionnelles."
        : undefined,
      confirmLabel: next ? "Autoriser" : "Retirer",
    });
    if (!ok) return;

    setSubscriptionManagerLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/subscription-manager`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canManageSubscription: next }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setSubscriptionManagerLoading(false);
        return;
      }

      setSubscriptionManager(next);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur. Réessayez.");
    }
    setSubscriptionManagerLoading(false);
  }

  function handleOpenEditAccount() {
    setEditFirstName(agent.firstName);
    setEditLastName(agent.lastName);
    setEditCountry(agent.country);
    setEditPhone(toLocalNumberForPhoneField(agent.phone));
    setEditEmail(agent.email || "");
    setEditRole(agent.role);
    setEditError("");
    setShowEditAccount(true);
  }

  async function handleSubmitEditAccount(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");

    if (editRole !== agent.role) {
      const ok = await confirm({
        title: `Changer le rôle de ${agent.firstName} ${agent.lastName} ?`,
        message: `${AGENT_ROLE_LABELS[agent.role] || agent.role} → ${AGENT_ROLE_LABELS[editRole] || editRole}.`,
        confirmLabel: "Changer le rôle",
      });
      if (!ok) return;
    }

    setEditLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editFirstName,
          lastName: editLastName,
          country: editCountry,
          phone: editPhone,
          email: editEmail,
          role: editRole,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setEditError(data.error || "Une erreur est survenue.");
        setEditLoading(false);
        return;
      }

      setShowEditAccount(false);
      router.refresh();
    } catch {
      setEditError("Impossible de contacter le serveur.");
    }
    setEditLoading(false);
  }

  async function handleResetPassword() {
    const ok = await confirm({
      title: `Réinitialiser le mot de passe de ${agent.firstName} ${agent.lastName} ?`,
      message:
        "Son mot de passe actuel cessera immédiatement de fonctionner. Un nouveau lien de connexion lui permettra d'en choisir un autre.",
      confirmLabel: "Réinitialiser",
      danger: true,
    });
    if (!ok) return;

    setShowInvite(true);
    setResetNotice(true);
    setInviteLinks(null);
    setLinkError("");
    setLinkLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/reset-password`, { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLinkError(data.error || "Une erreur est survenue.");
      } else {
        setInviteLinks({ inviteUrl: data.inviteUrl, whatsappUrl: data.whatsappUrl });
      }
    } catch {
      setLinkError("Impossible de contacter le serveur.");
    }
    setLinkLoading(false);
  }

  return (
    <div>
      <Link
        href="/dashboard/team"
        style={{ display: "inline-block", marginBottom: 16, fontSize: 13.5, color: "var(--color-text-muted)" }}
      >
        ← Retour à l&apos;équipe
      </Link>

      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="team-card-avatar" style={{ width: 54, height: 54, fontSize: 18, flexShrink: 0 }}>
            {initials(agent.firstName, agent.lastName)}
          </div>
          <div>
            <h1 style={{ margin: 0 }}>
              {agent.firstName} {agent.lastName}
            </h1>
            <span className="badge">{AGENT_ROLE_LABELS[agent.role] || "Membre"}</span>
            {subscriptionManager && (
              <span
                className="badge"
                style={{ marginLeft: 6, color: "var(--color-success)", borderColor: "var(--color-success)" }}
              >
                Gère l&apos;abonnement
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>Coordonnées</h3>
        <div className="team-card-contact" style={{ borderTop: "none", paddingTop: 0 }}>
          <span className="team-card-contact-row" style={{ whiteSpace: "normal" }}>
            <MailIcon />
            {agent.email || "—"}
          </span>
          <span className="team-card-contact-row" style={{ whiteSpace: "normal" }}>
            <PhoneIcon />
            {agent.phone}
          </span>
        </div>
        <div className="team-card-groups" style={{ marginTop: 12 }}>
          {agent.groupNames.length === 0 ? (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>Sans groupe</span>
          ) : (
            agent.groupNames.map((name) => (
              <span key={name} className="badge">
                {name}
              </span>
            ))
          )}
        </div>
      </div>

      {(canManage || canManageAccount || canGrantSubscriptionManager || canDelete) && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3 style={{ marginTop: 0 }}>Actions</h3>

          {canManage && (
            <ActionRow
              title="Lien de connexion"
              description="Envoyer ou renvoyer un lien de connexion à tout moment."
            >
              <button
                type="button"
                className="button-secondary button"
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={handleOpenInvite}
              >
                Partager
              </button>
            </ActionRow>
          )}

          {canManageAccount && (
            <ActionRow title="Informations du compte" description="Nom, pays, téléphone, email et rôle.">
              <button
                type="button"
                className="button-secondary button"
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={handleOpenEditAccount}
              >
                Modifier
              </button>
            </ActionRow>
          )}

          {canManageAccount && (
            <ActionRow
              title="Mot de passe oublié"
              description="Invalide l'ancien mot de passe et envoie un nouveau lien de connexion."
            >
              <button
                type="button"
                className="button-secondary button"
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={handleResetPassword}
              >
                Réinitialiser
              </button>
            </ActionRow>
          )}

          {canGrantSubscriptionManager && (
            <ActionRow
              title="Gestion de l'abonnement"
              description="Autoriser cette personne à choisir, changer ou résilier l'offre de l'entreprise."
            >
              <button
                type="button"
                className="button-secondary button"
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={handleToggleSubscriptionManager}
                disabled={subscriptionManagerLoading}
              >
                {subscriptionManagerLoading ? "..." : subscriptionManager ? "Retirer" : "Autoriser"}
              </button>
            </ActionRow>
          )}

          {canDelete && (
            <ActionRow title="Supprimer le compte" description="Irréversible — retire cette personne de l'entreprise.">
              <button
                type="button"
                className="button-secondary button"
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  color: "var(--color-danger)",
                  borderColor: "var(--color-danger)",
                }}
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? "..." : "Supprimer"}
              </button>
            </ActionRow>
          )}
        </div>
      )}

      {error && <p className="error-message" style={{ maxWidth: 560 }}>{error}</p>}

      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title={
          resetNotice
            ? `Mot de passe réinitialisé — ${agent.firstName} ${agent.lastName}`
            : `Lien de connexion — ${agent.firstName} ${agent.lastName}`
        }
      >
        {linkLoading && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>Chargement...</p>
        )}
        {linkError && <p className="error-message" style={{ margin: 0 }}>{linkError}</p>}

        {inviteLinks && !linkLoading && (
          <>
            {resetNotice && (
              <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--color-danger)" }}>
                Son ancien mot de passe ne fonctionne plus. Ce lien le connecte directement et lui
                demandera aussitôt d&apos;en choisir un nouveau.
              </p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="button"
                style={{ padding: "5px 10px", fontSize: 13 }}
                onClick={handleSendEmail}
                disabled={emailSendLoading || !agent.email}
              >
                {emailSendLoading ? "Envoi..." : "Envoyer par email"}
              </button>
              <a
                href={inviteLinks.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button-secondary button"
                style={{ padding: "5px 10px", fontSize: 13 }}
                onClick={() => setWhatsappOpened(true)}
              >
                Envoyer par WhatsApp
              </a>
            </div>

            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>
              Pour WhatsApp : assurez-vous d&apos;avoir un compte WhatsApp connecté sur l&apos;appareil
              que vous utilisez actuellement — le message s&apos;ouvrira depuis votre propre WhatsApp,
              prêt à être envoyé.
            </p>

            {whatsappOpened && (
              <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--color-success)" }}>
                WhatsApp ouvert dans un nouvel onglet — n&apos;oubliez pas d&apos;appuyer sur envoyer.
              </p>
            )}

            {emailSendResult && (
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 12.5,
                  color: emailSendResult.ok ? "var(--color-success)" : "var(--color-danger)",
                }}
              >
                {emailSendResult.message}
              </p>
            )}

            <p style={{ margin: "10px 0 0", fontSize: 12.5, wordBreak: "break-all" }}>
              Lien : <a href={inviteLinks.inviteUrl}>{inviteLinks.inviteUrl}</a>
            </p>
          </>
        )}
      </Modal>

      <Modal
        open={showEditAccount}
        onClose={() => setShowEditAccount(false)}
        title={`Modifier le compte — ${agent.firstName} ${agent.lastName}`}
      >
        <form onSubmit={handleSubmitEditAccount}>
          <div className="field-grid field-grid-2">
            <div className="field">
              <label htmlFor="edit-firstName">Prénom</label>
              <input
                id="edit-firstName"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit-lastName">Nom</label>
              <input
                id="edit-lastName"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <PhoneField
            country={editCountry}
            onCountryChange={setEditCountry}
            phone={editPhone}
            onPhoneChange={setEditPhone}
          />

          <div className="field">
            <label htmlFor="edit-email">Email</label>
            <input
              id="edit-email"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="edit-role">Rôle</label>
            <select id="edit-role" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
              <option value="MEMBER">Membre</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>

          {editError && <p className="error-message">{editError}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="button" disabled={editLoading}>
              {editLoading ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              type="button"
              className="button-secondary button"
              onClick={() => setShowEditAccount(false)}
              disabled={editLoading}
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
