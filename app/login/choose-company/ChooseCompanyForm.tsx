"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MANAGER: "Manager",
  MEMBER: "Membre",
};

type CompanyOption = { id: string; name: string; role: string };

export default function ChooseCompanyForm({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function choose(companyId: string) {
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/choose-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || "Une erreur est survenue.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
      {companies.map((company) => (
        <button
          key={company.id}
          type="button"
          className="button-secondary button"
          style={{ width: "100%", justifyContent: "space-between" }}
          onClick={() => choose(company.id)}
          disabled={loading}
        >
          <span>{company.name}</span>
          <span className="badge">{ROLE_LABELS[company.role] || company.role}</span>
        </button>
      ))}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}
