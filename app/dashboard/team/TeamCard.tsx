"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AGENT_ROLE_LABELS } from "@/lib/enums";
import { useConfirm } from "../ConfirmProvider";
import Modal from "../Modal";

type TeamMember = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  role: string;
  groupNames: string[];
};

function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

export default function TeamCard({
  agent,
  isMe,
  canManage,
  canDelete,
}: {
  agent: TeamMember;
  isMe: boolean;
  // Whether the viewer may share this teammate's login link right now —
  // see canManageAgent() in lib/agents.ts, computed server-side in
  // page.tsx: an admin may act on anyone but the company's owner, a
  // manager only on accounts they themselves added. Independent of
  // whether this account has already set its own password — the button
  // is a standing "share/help them log in" shortcut either way (see
  // POST /api/agents/invite/link).
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // "Partager le lien de connexion" — lets an admin or manager (re)send
  // this teammate's magic login link at any time, not just right after
  // their account was created (see TeamForm.tsx's own postCreate panel,
  // which this mirrors) and not only while they're still mid-onboarding.
  // Fetched on demand rather than on every page load, and cached in state
  // once fetched so reopening doesn't call the server again — see
  // POST /api/agents/invite/link.
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<{ inviteUrl: string; whatsappUrl: string } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [emailSendLoading, setEmailSendLoading] = useState(false);
  const [emailSendResult, setEmailSendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [whatsappOpened, setWhatsappOpened] = useState(false);

  async function handleOpenInvite() {
    setShowInvite(true);
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

      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur. Réessayez.");
      setLoading(false);
    }
  }

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

      {!isMe && (canManage || canDelete) && (
        <div className="team-card-actions">
          {canManage && (
            <button
              className="button-secondary button"
              style={{ padding: "5px 10px", fontSize: 13 }}
              onClick={handleOpenInvite}
            >
              Partager le lien de connexion
            </button>
          )}
          {canDelete && (
            <button
              className="button-secondary button"
              style={{ padding: "5px 10px", fontSize: 13 }}
              onClick={handleDelete}
              disabled={loading}
            >
              Supprimer
            </button>
          )}
        </div>
      )}

      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title={`Lien de connexion — ${agent.firstName} ${agent.lastName}`}
      >
        {linkLoading && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>Chargement...</p>
        )}
        {linkError && <p className="error-message" style={{ margin: 0 }}>{linkError}</p>}

        {inviteLinks && !linkLoading && (
          <>
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

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
