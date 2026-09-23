"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhoneField from "../../components/PhoneField";

export default function TeamForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!country) {
      setError("Le pays est requis.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, country, phone, password, role }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || "Une erreur est survenue.");
      setLoading(false);
      return;
    }

    setFirstName("");
    setLastName("");
    setEmail("");
    setCountry("");
    setPhone("");
    setPassword("");
    setRole("MEMBER");
    setLoading(false);
    router.refresh();
    // Scroll back up so the newly added member shows up in the table
    // right away instead of leaving the admin stuck down by the form.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <form onSubmit={handleSubmit}>
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
      />
      <div className="field">
        <label htmlFor="email">Email (optionnel)</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="password">Mot de passe provisoire</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="role">Rôle</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="MEMBER">Membre</option>
          <option value="MANAGER">Manager</option>
          <option value="ADMIN">Administrateur</option>
        </select>
      </div>

      {error && <p className="error-message">{error}</p>}

      <button type="submit" className="button" disabled={loading}>
        {loading ? "Création..." : "Créer le compte"}
      </button>
    </form>
  );
}
