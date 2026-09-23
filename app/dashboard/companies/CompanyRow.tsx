"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AGENT_ROLE_LABELS } from "@/lib/enums";
import { useConfirm } from "../ConfirmProvider";

export type CompanyItem = {
  id: string;
  name: string;
};

export default function CompanyRow({
  company,
  role,
  isActive,
}: {
  company: CompanyItem;
  role: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const isOwner = role === "OWNER";

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(company.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === company.name) {
      setEditing(false);
      setName(company.name);
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Renommage impossible.");
        setLoading(false);
        return;
      }

      setEditing(false);
      setLoading(false);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
      setLoading(false);
    }
  }

  async function handleSwitch() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/companies/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Changement impossible.");
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

  async function handleDelete() {
    const ok = await confirm({
      title: `Supprimer "${company.name}" ?`,
      message: isActive
        ? "Cette entreprise est celle sur laquelle tu es actuellement connecté. Toutes ses tâches, tous ses membres et tous ses groupes seront définitivement supprimés. Cette action est irréversible."
        : "Toutes ses tâches, tous ses membres et tous ses groupes seront définitivement supprimés. Cette action est irréversible.",
      confirmLabel: "Supprimer définitivement",
      danger: true,
    });
    if (!ok) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Suppression impossible.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
      setLoading(false);
    }
  }

  return (
    <tr>
      <td>
        {editing ? (
          <form onSubmit={handleRename} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={loading}
              style={{
                padding: "5px 8px",
                fontSize: 13.5,
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
              }}
            />
            <button type="submit" className="button" style={{ padding: "5px 10px", fontSize: 13 }} disabled={loading}>
              OK
            </button>
            <button
              type="button"
              className="button-secondary button"
              style={{ padding: "5px 10px", fontSize: 13 }}
              disabled={loading}
              onClick={() => {
                setEditing(false);
                setName(company.name);
              }}
            >
              Annuler
            </button>
          </form>
        ) : (
          <span style={{ fontWeight: 600 }}>
            {company.name}
            {isActive && (
              <span className="badge" style={{ marginLeft: 8 }}>
                Actif
              </span>
            )}
          </span>
        )}
      </td>
      <td>
        <span className="badge">{AGENT_ROLE_LABELS[role] || (role === "OWNER" ? "Propriétaire" : role)}</span>
      </td>
      <td>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {!isActive && (
            <button
              type="button"
              className="button-secondary button"
              style={{ padding: "5px 10px", fontSize: 13 }}
              onClick={handleSwitch}
              disabled={loading}
            >
              Basculer
            </button>
          )}
          {isOwner && !editing && (
            <>
              <button
                type="button"
                className="button-secondary button"
                style={{ padding: "5px 10px", fontSize: 13 }}
                onClick={() => setEditing(true)}
                disabled={loading}
              >
                Renommer
              </button>
              <button
                type="button"
                className="button-secondary button"
                style={{ padding: "5px 10px", fontSize: 13, borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
                onClick={handleDelete}
                disabled={loading}
              >
                Supprimer
              </button>
            </>
          )}
        </div>
        {error && <div className="error-message" style={{ marginTop: 6, textAlign: "right" }}>{error}</div>}
      </td>
    </tr>
  );
}
