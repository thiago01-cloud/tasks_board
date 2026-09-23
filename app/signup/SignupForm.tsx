"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhoneField from "../components/PhoneField";
import { getCountry } from "@/lib/countries";
import { composeInternationalPhone } from "@/lib/phone";

export default function SignupForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If the entered number already matches an account, switch to a mini
  // login form (same number, just the password) instead of blocking on a
  // plain error message.
  const [accountExists, setAccountExists] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!country) {
      setError("Le pays est requis.");
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, country, phone, email, password }),
      });

      if (res.status === 409) {
        // An account already exists with this number: offer to log in
        // with it directly, rather than blocking on an error.
        setAccountExists(true);
        setLoading(false);
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      // The account was just created, with no company yet: on to creating
      // its first company.
      router.push("/create-company");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const countryInfo = getCountry(country);
      const fullPhone = countryInfo ? composeInternationalPhone(countryInfo.dialCode, phone) : "";
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, password: loginPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      if (data.step === "choose_company") {
        router.push("/login/choose-company");
        return;
      }

      if (data.step === "create_company") {
        router.push("/create-company");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
      setLoading(false);
    }
  }

  if (accountExists) {
    return (
      <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 360 }}>
        <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginTop: 0 }}>
          Un compte existe déjà avec le numéro{" "}
          <strong>
            {getCountry(country)
              ? composeInternationalPhone(getCountry(country)!.dialCode, phone)
              : phone}
          </strong>
          . Entre ton mot de passe pour te connecter.
        </p>

        <div className="field">
          <label htmlFor="loginPassword">Mot de passe</label>
          <input
            id="loginPassword"
            type="password"
            autoComplete="current-password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
            autoFocus
          />
        </div>

        {error && <p className="error-message">{error}</p>}

        <button type="submit" className="button" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>

        <button
          type="button"
          className="button-secondary button"
          style={{ width: "100%", marginTop: 10 }}
          disabled={loading}
          onClick={() => {
            setAccountExists(false);
            setLoginPassword("");
            setError("");
          }}
        >
          Utiliser un autre numéro
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 360 }}>
      <div className="field-grid field-grid-2">
        <div className="field">
          <label htmlFor="firstName">Prénom</label>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="lastName">Nom</label>
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
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
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="confirmation">Confirmer le mot de passe</label>
        <input
          id="confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          minLength={8}
          required
        />
      </div>

      {error && <p className="error-message">{error}</p>}

      <button type="submit" className="button" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Création..." : "Créer mon compte"}
      </button>
    </form>
  );
}
