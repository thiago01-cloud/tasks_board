"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateCompanyForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      <div className="field">
        <label htmlFor="name">Nom de l&apos;entreprise</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {error && <p className="error-message">{error}</p>}

      <button type="submit" className="button" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Création..." : "Créer mon entreprise"}
      </button>
    </form>
  );
}
