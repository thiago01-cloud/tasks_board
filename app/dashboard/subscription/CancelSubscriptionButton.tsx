"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "../ConfirmProvider";

// "Résilier / revenir à aucune offre" — the one way back to Company.plan
// === "free" once a tier has been chosen (see PATCH /api/companies/plan's
// own comment: sending plan: "free" is the cancel sentinel, and it always
// clears addOns server-side too). Shown from page.tsx only when a real
// tier is currently active — see "Mon abonnement" there.
export default function CancelSubscriptionButton({ tierName }: { tierName: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    const ok = await confirm({
      title: "Résilier votre abonnement ?",
      message: `Vous reviendrez à "aucune offre choisie" — l'offre ${tierName} et toutes les options additionnelles actives seront retirées.`,
      confirmLabel: "Résilier",
      danger: true,
    });
    if (!ok) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/companies/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "free" }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur. Réessayez.");
    }
    setLoading(false);
  }

  return (
    <div style={{ marginTop: 10 }}>
      {error && <p className="error-message">{error}</p>}
      <button
        type="button"
        className="button-secondary button"
        style={{ color: "var(--color-danger)", borderColor: "var(--color-danger-tint)" }}
        onClick={handleCancel}
        disabled={loading}
      >
        {loading ? "Résiliation..." : "Résilier mon abonnement"}
      </button>
    </div>
  );
}
