"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhoneField from "../../components/PhoneField";
import { toLocalNumberForPhoneField } from "@/lib/phone";

// Self-service profile edit on "Mon compte" (see page.tsx) — mirrors
// TeamForm.tsx's own name/country/phone/email fields, minus the role
// picker (nobody chooses their own role) and submitting to
// PATCH /api/account instead of the agent-creation routes.
export default function AccountForm({
  initial,
}: {
  initial: { firstName: string; lastName: string; country: string; phone: string; email: string };
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [country, setCountry] = useState(initial.country);
  const [phone, setPhone] = useState(toLocalNumberForPhoneField(initial.phone));
  const [email, setEmail] = useState(initial.email);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, country, phone, email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field-grid field-grid-2">
        <div className="field">
          <label htmlFor="account-firstName">Prénom</label>
          <input
            id="account-firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="account-lastName">Nom</label>
          <input
            id="account-lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>

      <PhoneField country={country} onCountryChange={setCountry} phone={phone} onPhoneChange={setPhone} />

      <div className="field">
        <label htmlFor="account-email">Email</label>
        <input
          id="account-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && (
        <p style={{ color: "var(--color-success)", fontSize: 13, margin: "0 0 10px" }}>
          Informations mises à jour.
        </p>
      )}

      <button type="submit" className="button" disabled={loading}>
        {loading ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
