"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PhoneField from "../components/PhoneField";
import { getCountry } from "@/lib/countries";
import { composeInternationalPhone } from "@/lib/phone";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
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

    try {
      const countryInfo = getCountry(country);
      const fullPhone = countryInfo ? composeInternationalPhone(countryInfo.dialCode, phone) : "";
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      // The account has access to several companies: go to the choice
      // screen rather than the dashboard.
      if (data.step === "choose_company") {
        router.push("/login/choose-company");
        return;
      }

      // The account isn't attached to any company yet: on to creating its
      // first company.
      if (data.step === "create_company") {
        router.push("/create-company");
        return;
      }

      const next = searchParams.get("next") || "/dashboard";
      router.push(next);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 360 }}>
      <PhoneField
        country={country}
        onCountryChange={setCountry}
        phone={phone}
        onPhoneChange={setPhone}
      />

      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="error-message">{error}</p>}

      <button type="submit" className="button" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}
