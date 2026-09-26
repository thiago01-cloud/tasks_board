import { redirect } from "next/navigation";
import { getCurrentAgent, canManageSubscription } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageTitle } from "@/lib/constants";
import { getPricingTiers, getAddOns, tierForMemberCount, tierById, addOnsMonthlyTotal } from "@/lib/pricing";
import SubscriptionPlans from "./SubscriptionPlans";
import AddOnsPanel from "./AddOnsPanel";
import CancelSubscriptionButton from "./CancelSubscriptionButton";

export const metadata = {
  title: pageTitle("Abonnement"),
};

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

// Restricted to the company's owner, or an agent the owner has delegated
// this to (see canManageSubscription() in lib/auth.ts and TeamCard.tsx's
// toggle) — narrower than the "Équipe" page (admins and managers), since
// this is billing-adjacent and, unlike every other admin-only page here,
// deliberately not open to every admin by default.
export default async function SubscriptionPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");
  if (!(await canManageSubscription(agent))) redirect("/dashboard");

  const [memberCount, company, tiers, addOns] = await Promise.all([
    prisma.agent.count({ where: { companyId: agent.companyId } }),
    prisma.company.findUnique({ where: { id: agent.companyId }, select: { plan: true, addOns: true } }),
    getPricingTiers(),
    getAddOns(),
  ]);

  const recommended = tierForMemberCount(tiers, memberCount);
  // Company.plan defaults to "free", which isn't one of the seeded
  // tiers — that's the "no offer chosen yet" state, distinct from having
  // genuinely picked a tier (see SubscriptionPlans.tsx's own isCurrent
  // check, which compares against tier ids the same way).
  const currentTier = tierById(tiers, company?.plan || "");
  const activeAddOnIds = company?.addOns || [];
  const addOnsTotal = addOnsMonthlyTotal(addOns, activeAddOnIds, memberCount);
  const totalMonthly = currentTier && currentTier.priceFcfa !== null ? currentTier.priceFcfa + addOnsTotal : null;

  return (
    <div>
      <div className="page-header">
        <h1>Abonnement</h1>
      </div>
      <p style={{ color: "var(--color-text-muted)", marginTop: -8, marginBottom: 24, fontSize: 14 }}>
        Votre organisation compte actuellement {memberCount} membre{memberCount > 1 ? "s" : ""}.
        {recommended && (
          <>
            {" "}Offre recommandée : <strong>{recommended.name}</strong>.
          </>
        )}
      </p>

      <div className="card" style={{ marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Mon abonnement</h2>

        {!currentTier && (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-muted)" }}>
            Aucune offre choisie pour l&apos;instant — choisissez-en une ci-dessous pour activer votre abonnement et
            débloquer les options additionnelles.
          </p>
        )}

        {currentTier && (
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 14 }}>
              Offre actuelle : <strong>{currentTier.name}</strong>
              {currentTier.priceFcfa !== null && <> — {formatFcfa(currentTier.priceFcfa)} / mois</>}
            </p>

            <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none" }}>
              {addOns.map((addOn) => {
                const isActive = activeAddOnIds.includes(addOn.id);
                return (
                  <li
                    key={addOn.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderTop: "1px solid var(--color-border)",
                      fontSize: 13.5,
                    }}
                  >
                    <span>
                      <span
                        className="badge"
                        style={{
                          marginRight: 8,
                          color: isActive ? "var(--color-success)" : "var(--color-text-muted)",
                          borderColor: isActive ? "var(--color-success)" : "var(--color-border)",
                        }}
                      >
                        {isActive ? "Ajoutée" : "Non ajoutée"}
                      </span>
                      {addOn.name}
                    </span>
                    {isActive && (
                      <span style={{ color: "var(--color-text-muted)" }}>
                        +{formatFcfa(addOn.pricePerUnitFcfa * memberCount)} / mois
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {totalMonthly !== null && (
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
                Total mensuel estimé : {formatFcfa(totalMonthly)}
              </p>
            )}

            <CancelSubscriptionButton tierName={currentTier.name} />
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 17, margin: "0 0 14px" }}>Offres</h2>
      {tiers.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-muted)" }}>
          Aucune offre configurée pour l&apos;instant.
        </p>
      ) : (
        <SubscriptionPlans
          tiers={tiers}
          currentPlan={company?.plan || "free"}
          recommendedTierId={recommended?.id || ""}
          memberCount={memberCount}
        />
      )}

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Options additionnelles</h2>
        {currentTier ? (
          <>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--color-text-muted)" }}>
              À ajouter à l&apos;offre {currentTier.name} — chaque option modifie votre facturation mensuelle
              ci-dessus dès qu&apos;elle est activée.
            </p>
            <AddOnsPanel addOns={addOns} activeAddOnIds={activeAddOnIds} memberCount={memberCount} />
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-muted)" }}>
            Choisissez d&apos;abord une offre ci-dessus pour pouvoir ajouter des options.
          </p>
        )}
      </div>
    </div>
  );
}
