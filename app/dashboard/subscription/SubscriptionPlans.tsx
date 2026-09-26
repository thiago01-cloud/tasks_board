"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PricingTier } from "@/lib/pricing";
import { useConfirm } from "../ConfirmProvider";

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

// The tier cards themselves, plus the "choose this tier" action — split
// out from the (server) page component only because picking a tier needs
// client-side state (loading/error, the confirm dialog, the PATCH call).
export default function SubscriptionPlans({
  tiers,
  currentPlan,
  recommendedTierId,
  memberCount,
}: {
  tiers: PricingTier[];
  currentPlan: string;
  recommendedTierId: string;
  memberCount: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function choose(tier: PricingTier) {
    // "Entreprise" has no self-serve price — nothing to PATCH to, it's a
    // contact-us card (see the button/link split in the render below).
    if (tier.priceFcfa === null) return;

    // A real tier is already active (currentPlan isn't the "free"/
    // "nothing chosen yet" sentinel — see tierById()'s own comment in
    // lib/pricing.ts) — make the confirmation say this REPLACES it,
    // rather than reusing the "choosing for the first time" wording.
    const currentTierName = tiers.find((t) => t.id === currentPlan)?.name;
    const ok = await confirm({
      title: currentTierName
        ? `Remplacer votre offre actuelle (${currentTierName}) par « ${tier.name} » ?`
        : `Choisir l'offre « ${tier.name} » ?`,
      message:
        "Cette page est une vitrine tarifaire : aucun paiement n'est débité pour l'instant, ce choix est enregistré à titre indicatif.",
      confirmLabel: currentTierName ? "Remplacer" : "Choisir cette offre",
    });
    if (!ok) return;

    setLoadingId(tier.id);
    setError("");

    try {
      const res = await fetch("/api/companies/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: tier.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoadingId(null);
        return;
      }

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
        {tiers.map((tier) => {
          const isCurrent = tier.id === currentPlan;
          const isRecommended = tier.id === recommendedTierId;
          const isCustom = tier.priceFcfa === null;

          return (
            <div
              key={tier.id}
              className={`pricing-card${isRecommended ? " pricing-card-recommended" : ""}`}
            >
              {(isRecommended || isCurrent) && (
                <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                  {isRecommended && <span className="pricing-card-badge">Recommandée</span>}
                  {isCurrent && <span className="pricing-card-badge pricing-card-badge-current">Offre actuelle</span>}
                </div>
              )}

              <h3 style={{ margin: "4px 0 2px" }}>{tier.name}</h3>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-muted)" }}>
                {tier.maxMembers ? `${tier.minMembers}–${tier.maxMembers} membres` : `${tier.minMembers}+ membres`}
              </p>

              {!isCustom ? (
                <p style={{ margin: "0 0 2px" }}>
                  <span style={{ fontSize: 24, fontWeight: 700 }}>{formatFcfa(tier.priceFcfa!)}</span>
                  <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}> / mois</span>
                </p>
              ) : (
                <p style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 700 }}>Sur devis</p>
              )}
              {tier.priceEurApprox !== null && (
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--color-text-muted)" }}>
                  ≈ {tier.priceEurApprox} € / {tier.priceUsdApprox} $
                </p>
              )}
              {isCustom && <p style={{ margin: "0 0 14px" }} />}

              <p style={{ margin: "0 0 6px", fontSize: 13.5 }}>{tier.tagline}</p>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-text-muted)" }}>
                Accès complet à la plateforme · {tier.support}
              </p>

              {!isCustom ? (
                <button
                  type="button"
                  className={isCurrent ? "button-secondary button" : "button"}
                  style={{ width: "100%" }}
                  disabled={isCurrent || loadingId === tier.id}
                  onClick={() => choose(tier)}
                >
                  {loadingId === tier.id ? "Enregistrement..." : isCurrent ? "Offre actuelle" : "Choisir cette offre"}
                </button>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", textAlign: "center" }}>
                  Contactez-nous pour discuter de vos besoins.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 20, fontSize: 12.5, color: "var(--color-text-muted)" }}>
        Vitrine tarifaire — aucun paiement n&apos;est collecté pour l&apos;instant ({memberCount} membre
        {memberCount > 1 ? "s" : ""} actuellement).
      </p>
    </div>
  );
}
