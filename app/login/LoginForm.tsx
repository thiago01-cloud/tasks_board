"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const noticeUsed = searchParams.get("notice") === "invite_used";
  const errorExpired = searchParams.get("error") === "invite_invalid";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
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
      {noticeUsed && (
        <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", margin: "0 0 14px" }}>
          Ce lien d&apos;invitation a déjà été utilisé — connectez-vous avec votre mot de passe.
        </p>
      )}
      {errorExpired && (
        <p className="error-message" style={{ margin: "0 0 14px" }}>
          Ce lien d&apos;invitation est invalide ou a expiré.
        </p>
      )}

      <div className="field">
        <label htmlFor="identifier">Téléphone ou email</label>
        <input
          id="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="ex. 074582442 ou membre@exemple.com"
          autoComplete="username"
          required
        />
      </div>

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
