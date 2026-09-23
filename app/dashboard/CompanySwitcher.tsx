"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AGENT_ROLE_LABELS } from "@/lib/enums";

type CompanyOption = { id: string; name: string; role: string };

// "Mes entreprises": lets the person switch between every company they
// have access to (owned, or where they hold an Agent record), and jump
// to creating a new one — all without a logout/login round trip. The
// list is fetched lazily, the first time the menu is opened.
export default function CompanySwitcher({
  companyName,
  companyId,
}: {
  companyName: string;
  companyId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && companies === null) {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/companies");
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setCompanies(data.companies || []);
        } else {
          setError(data.error || "Impossible de charger tes entreprises.");
        }
      } catch {
        setError("Impossible de contacter le serveur.");
      }
      setLoading(false);
    }
  }

  async function switchTo(id: string) {
    if (id === companyId) {
      setOpen(false);
      return;
    }
    setSwitching(id);
    setError("");

    try {
      const res = await fetch("/api/companies/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setSwitching(null);
        return;
      }

      setOpen(false);
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
      setSwitching(null);
    }
  }

  return (
    <div className="company-switcher" ref={containerRef}>
      <button
        type="button"
        className="company-switcher-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <span className="company-switcher-label">Mes entreprises</span>
        <span className="company-switcher-name">{companyName}</span>
      </button>

      {open && (
        <div className="custom-select-panel company-switcher-panel" role="listbox">
          {loading && (
            <p style={{ margin: "6px 8px", fontSize: 13, color: "var(--color-text-muted)" }}>
              Chargement...
            </p>
          )}

          {!loading &&
            companies?.map((c) => (
              <button
                key={c.id}
                type="button"
                className="custom-select-option"
                role="option"
                aria-selected={c.id === companyId}
                onClick={() => switchTo(c.id)}
                disabled={switching !== null}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
              >
                <span>
                  {c.name}
                  {c.id === companyId ? " ✓" : ""}
                </span>
                <span className="badge">{AGENT_ROLE_LABELS[c.role] || c.role}</span>
              </button>
            ))}

          {error && (
            <p style={{ margin: "6px 8px", fontSize: 13 }} className="error-message">
              {error}
            </p>
          )}

          <Link
            href="/create-company"
            className="custom-select-option"
            style={{ display: "block", color: "var(--color-primary)", fontWeight: 600 }}
          >
            + Créer une entreprise
          </Link>
        </div>
      )}
    </div>
  );
}
