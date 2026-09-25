"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhoneField from "../../components/PhoneField";
import { toLocalNumberForPhoneField } from "@/lib/phone";

// Adding a teammate is a two-or-three-step form:
//   1. Type a phone number or email — POST /api/agents/search looks it up,
//      nothing else. No role picker here: which role to give someone
//      isn't relevant until we know who they are.
//      - Found: move to step 2 ("confirm") to pick a role for that
//        existing account.
//      - Not found: nothing to create yet — move to step "create".
//   2. ("confirm", only when found) Show who was found and let the admin
//      pick a role, then POST /api/agents actually creates the Agent
//      record linking that account to this company.
//   3. ("create", only when not found) The full form (name, phone, email,
//      role) to actually create the account. No password field — see
//      POST /api/agents/invite, which returns an invite link instead
//      (app/set-password is where the invited person picks their own
//      password, the first time they open it).
export default function TeamForm() {
  const router = useRouter();

  const [step, setStep] = useState<"search" | "confirm" | "create">("search");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Populated by POST /api/agents/search when an existing account is
  // found — held here just long enough for the admin to review it and
  // pick a role in the "confirm" step below.
  const [foundUser, setFoundUser] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);
  const [country, setCountry] = useState("GA");
  const [phone, setPhone] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const [notice, setNotice] = useState<{ message: string; inviteUrl?: string } | null>(null);

  // Shown right after step 2 creates the account: two ways to actually get
  // the invite link to the new teammate. Neither is automatic — see
  // POST /api/agents/invite's own comment for why.
  const [postCreate, setPostCreate] = useState<{
    userId: string;
    firstName: string;
    inviteUrl: string;
    whatsappUrl: string;
  } | null>(null);
  const [emailSendLoading, setEmailSendLoading] = useState(false);
  const [emailSendResult, setEmailSendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [whatsappOpened, setWhatsappOpened] = useState(false);

  function resetAll() {
    setStep("search");
    setQuery("");
    setRole("MEMBER");
    setSearchError("");
    setFoundUser(null);
    setLinkError("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setEmailLocked(false);
    setCountry("GA");
    setPhone("");
    setCreateError("");
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError("");
    if (!query.trim()) return;
    setSearchLoading(true);

    try {
      const res = await fetch("/api/agents/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSearchError(data.error || "Une erreur est survenue.");
        setSearchLoading(false);
        return;
      }

      if (data.found) {
        setFoundUser(data.user);
        setRole("MEMBER");
        setLinkError("");
        setStep("confirm");
        setSearchLoading(false);
        return;
      }

      // Not found: switch to the full form, prefilled with whichever of
      // email/phone was already typed so it isn't retyped.
      if (data.prefill?.email) {
        setEmail(data.prefill.email);
        setEmailLocked(true);
      } else if (data.prefill?.phone) {
        setPhone(toLocalNumberForPhoneField(data.prefill.phone));
      }
      setStep("create");
      setSearchLoading(false);
    } catch {
      setSearchError("Impossible de contacter le serveur.");
      setSearchLoading(false);
    }
  }

  // Step 2 of "add an existing account" — POST /api/agents/search (above)
  // only looked the account up; this is what actually links it to the
  // company, once the admin has picked a role for it.
  async function handleConfirmLink(e: React.FormEvent) {
    e.preventDefault();
    if (!foundUser) return;
    setLinkError("");
    setLinkLoading(true);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: foundUser.id, role }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLinkError(data.error || "Une erreur est survenue.");
        setLinkLoading(false);
        return;
      }

      setNotice({ message: `${data.agent.firstName} ${data.agent.lastName} a été ajouté(e) à l'entreprise.` });
      resetAll();
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
      setLinkLoading(false);
    } catch {
      setLinkError("Impossible de contacter le serveur.");
      setLinkLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");

    if (!country) {
      setCreateError("Le pays est requis.");
      return;
    }

    setCreateLoading(true);

    try {
      const res = await fetch("/api/agents/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, country, phone, role }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCreateError(data.error || "Une erreur est survenue.");
        setCreateLoading(false);
        return;
      }

      setPostCreate({
        userId: data.userId,
        firstName: data.agent.firstName,
        inviteUrl: data.inviteUrl,
        whatsappUrl: data.whatsappUrl,
      });
      setEmailSendResult(null);
      setWhatsappOpened(false);
      setStep("search");
      setQuery("");
      setRole("MEMBER");
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
      setCreateLoading(false);
    } catch {
      setCreateError("Impossible de contacter le serveur.");
      setCreateLoading(false);
    }
  }

  async function handleSendEmail() {
    if (!postCreate) return;
    setEmailSendLoading(true);
    setEmailSendResult(null);
    try {
      const res = await fetch("/api/agents/invite/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: postCreate.userId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setEmailSendResult({ ok: false, message: data.error || "Une erreur est survenue." });
      } else if (data.emailSent) {
        setEmailSendResult({ ok: true, message: `Email envoyé à ${postCreate.firstName}.` });
      } else {
        setEmailSendResult({
          ok: false,
          message: "L'email n'a pas pu être envoyé (service email non configuré) — utilise WhatsApp ou copie le lien.",
        });
      }
    } catch {
      setEmailSendResult({ ok: false, message: "Impossible de contacter le serveur." });
    }
    setEmailSendLoading(false);
  }

  return (
    <div>
      {postCreate && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--color-success)" }}>
          <p style={{ margin: 0 }}>
            Compte créé pour <strong>{postCreate.firstName}</strong>. Choisissez comment lui envoyer son
            lien de connexion :
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button
              type="button"
              className="button"
              onClick={handleSendEmail}
              disabled={emailSendLoading}
            >
              {emailSendLoading ? "Envoi..." : "Envoyer par email"}
            </button>
            <a
              href={postCreate.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button-secondary button"
              onClick={() => setWhatsappOpened(true)}
            >
              Envoyer par WhatsApp
            </a>
          </div>

          <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--color-text-muted)" }}>
            Pour WhatsApp : assurez-vous d&apos;avoir un compte WhatsApp connecté sur l&apos;appareil que
            vous utilisez actuellement (téléphone, WhatsApp Web ou l&apos;application de bureau) — le
            message s&apos;ouvrira depuis votre propre WhatsApp, prêt à être envoyé.
          </p>

          {whatsappOpened && (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--color-success)" }}>
              WhatsApp ouvert dans un nouvel onglet — n&apos;oublie pas d&apos;appuyer sur envoyer.
            </p>
          )}

          {emailSendResult && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 13,
                color: emailSendResult.ok ? "var(--color-success)" : "var(--color-danger)",
              }}
            >
              {emailSendResult.message}
            </p>
          )}

          <p style={{ margin: "10px 0 0", fontSize: 13, wordBreak: "break-all" }}>
            Lien de connexion : <a href={postCreate.inviteUrl}>{postCreate.inviteUrl}</a>
          </p>

          <button
            type="button"
            className="button-secondary button"
            style={{ marginTop: 10, padding: "6px 12px", fontSize: 13 }}
            onClick={() => setPostCreate(null)}
          >
            Fermer
          </button>
        </div>
      )}

      {notice && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--color-success)" }}>
          <p style={{ margin: 0 }}>{notice.message}</p>
          {notice.inviteUrl && (
            <p style={{ margin: "8px 0 0", fontSize: 13, wordBreak: "break-all" }}>
              <a href={notice.inviteUrl}>{notice.inviteUrl}</a>
            </p>
          )}
          <button
            type="button"
            className="button-secondary button"
            style={{ marginTop: 10, padding: "6px 12px", fontSize: 13 }}
            onClick={() => setNotice(null)}
          >
            Fermer
          </button>
        </div>
      )}

      {step === "search" && (
        <form onSubmit={handleSearch}>
          <div className="field">
            <label htmlFor="query">Téléphone ou email</label>
            <input
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ex. 074582442 ou membre@exemple.com"
              required
            />
          </div>

          {searchError && <p className="error-message">{searchError}</p>}

          <button type="submit" className="button" disabled={searchLoading}>
            {searchLoading ? "Recherche..." : "Rechercher"}
          </button>
        </form>
      )}

      {step === "confirm" && foundUser && (
        <form onSubmit={handleConfirmLink}>
          <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", margin: "0 0 14px" }}>
            Compte trouvé — choisissez le rôle à lui donner dans l&apos;entreprise.
          </p>

          <div className="card" style={{ marginBottom: 14, padding: "10px 14px" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              {foundUser.firstName} {foundUser.lastName}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-muted)" }}>
              {foundUser.phone}
              {foundUser.email ? ` · ${foundUser.email}` : ""}
            </p>
          </div>

          <div className="field">
            <label htmlFor="role-confirm">Rôle</label>
            <select id="role-confirm" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="MEMBER">Membre</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>

          {linkError && <p className="error-message">{linkError}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="button" disabled={linkLoading}>
              {linkLoading ? "Ajout..." : "Ajouter à l'équipe"}
            </button>
            <button
              type="button"
              className="button-secondary button"
              onClick={resetAll}
              disabled={linkLoading}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {step === "create" && (
        <form onSubmit={handleCreate}>
          <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", margin: "0 0 14px" }}>
            Aucun compte existant avec ces informations — complétez le formulaire pour en créer un. Une
            fois le compte créé, vous pourrez choisir de lui envoyer son lien de connexion par email ou
            par WhatsApp.
          </p>

          <div className="field-grid field-grid-2">
            <div className="field">
              <label htmlFor="firstName">Prénom</label>
              <input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="lastName">Nom</label>
              <input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <PhoneField
            country={country}
            onCountryChange={setCountry}
            phone={phone}
            onPhoneChange={setPhone}
            label="Numéro WhatsApp"
          />
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={emailLocked}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="role2">Rôle</label>
            <select id="role2" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="MEMBER">Membre</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>

          {createError && <p className="error-message">{createError}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="button" disabled={createLoading}>
              {createLoading ? "Création..." : "Créer le compte et inviter"}
            </button>
            <button
              type="button"
              className="button-secondary button"
              onClick={resetAll}
              disabled={createLoading}
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
