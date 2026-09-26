"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PricingAddOn } from "@/lib/pricing";
import { useConfirm } from "../ConfirmProvider";

// Add-on cards shown once a plan is chosen (see page.tsx) — vitrine only,
// same reasoning as SubscriptionPlans.tsx: toggling one just PATCHes
// Company.addOns, nothing real is wired up behind either option yet (no
// file storage service, no WhatsApp API account — see lib/pricing.ts's
// own comment). Split from the "Mon abonnement" summary and the tier
// cards only because toggling needs client-side state; the actual
// numbers (which are active, the running total) are computed in page.tsx
// from the same data this component writes back to.
function formatFcfa(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default function AddOnsPanel({
  addOns,
  activeAddOnIds,
  memberCount,
}: {
  addOns: PricingAddOn[];
  activeAddOnIds: string[];
  memberCount: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [active, setActive] = useState<string[]>(activeAddOnIds);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggle(addOn: PricingAddOn) {
    const isActive = active.includes(addOn.id);
    const nextActive = isActive ? active.filter((id) => id !== addOn.id) : [...active, addOn.id];

    const ok = await confirm({
      title: isActive ? `Retirer l'option « ${addOn.name} » ?` : `Ajouter l'option « ${addOn.name} » ?`,
      message: isActive
        ? "Elle ne sera plus comptée dans votre facturation mensuelle."
        : `Ajoutée pour ${memberCount} membre${memberCount > 1 ? "s" : ""}, elle s'ajoutera à votre facturation mensuelle.`,
      confirmLabel: isActive ? "Retirer" : "Ajouter",
    });
    if (!ok) return;

    setLoadingId(addOn.id);
    setError("");

    try {
      const res = await fetch("/api/companies/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addOns: nextActive }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoadingId(null);
        return;
      }

      setActive(nextActive);
      // Re-renders page.tsx (server component) so "Mon abonnement"'s
      // running total picks up the change immediately, not just this
      // panel's own buttons.
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur. Réessayez.");
    }
    setLoadingId(null);
  }

  return (
    <div>
      {error && <p className="error-message">{error}</p>}
      <div className="pricing-grid">
        {addOns.map((addOn) => {
          const isActive = active.includes(addOn.id);
          const monthlyTotal = addOn.pricePerUnitFcfa * memberCount;
          return (
            <div key={addOn.id} className={`pricing-card${isActive ? " pricing-card-current" : ""}`}>
              <h3 style={{ margin: "4px 0 2px" }}>{addOn.name}</h3>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-muted)" }}>{addOn.description}</p>

              <p style={{ margin: "0 0 2px" }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{formatFcfa(addOn.pricePerUnitFcfa)}</span>
                <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  {" "}
                  / {addOn.unit === "member" ? "membre" : "agent"} / mois
                </span>
              </p>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--color-text-muted)" }}>
                ≈ {addOn.priceEurApprox} € / {addOn.priceUsdApprox} $ par unité — soit {formatFcfa(monthlyTotal)} au
                total pour {memberCount} membre{memberCount > 1 ? "s" : ""}.
              </p>

              <button
                type="button"
                className={isActive ? "button-secondary button" : "button"}
                style={{ width: "100%" }}
                disabled={loadingId === addOn.id}
                onClick={() => toggle(addOn)}
              >
                {loadingId === addOn.id ? "Enregistrement..." : isActive ? "Retirer cette option" : "Ajouter cette option"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
