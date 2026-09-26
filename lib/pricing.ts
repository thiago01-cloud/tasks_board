// Reads the subscription pricing catalog (tiers + add-ons) from the
// database — see the PricingTier/PricingAddOn models in
// prisma/schema.prisma — instead of a hardcoded list. That's specifically
// so prices, taglines, brackets, and support levels can be tweaked
// straight from Prisma Studio (`npm run db:studio`) whenever needed,
// without a code change or a redeploy. See prisma/seed.js for the initial
// rows this table starts with.
//
// Everything here is still vitrine only (see app/dashboard/subscription
// and AddOnsPanel.tsx's own comments): choosing a tier/add-on just
// records its id on Company.plan/Company.addOns, nothing is actually
// billed.
import { prisma } from "./prisma";
import type { PricingTier, PricingAddOn } from "@prisma/client";

export type { PricingTier, PricingAddOn };

// Active tiers/add-ons, in display order — "active: false" lets one be
// retired from the page without deleting the row (which would orphan any
// Company.plan/addOns still pointing at its id).
export async function getPricingTiers(): Promise<PricingTier[]> {
  return prisma.pricingTier.findMany({ where: { active: true }, orderBy: { order: "asc" } });
}

export async function getAddOns(): Promise<PricingAddOn[]> {
  return prisma.pricingAddOn.findMany({ where: { active: true }, orderBy: { order: "asc" } });
}

// The tier that matches a given member count, out of an already-fetched
// list — used to pre-select/highlight a recommendation on the
// subscription page. Falls back to the last (usually uncapped) tier if
// none of the bounded ones match, or null if the catalog is empty.
export function tierForMemberCount(tiers: PricingTier[], count: number): PricingTier | null {
  return (
    tiers.find((t) => count >= t.minMembers && (t.maxMembers === null || count <= t.maxMembers)) ||
    tiers[tiers.length - 1] ||
    null
  );
}

export function tierById(tiers: PricingTier[], id: string): PricingTier | null {
  return tiers.find((t) => t.id === id) || null;
}

export function addOnById(addOns: PricingAddOn[], id: string): PricingAddOn | null {
  return addOns.find((a) => a.id === id) || null;
}

// Total monthly cost of a set of add-ons for a company of `memberCount`
// members — each add-on's per-unit price × the headcount ("membre" and
// "agent" are the same headcount here, see the PricingAddOn model's own
// comment).
export function addOnsMonthlyTotal(addOns: PricingAddOn[], addOnIds: string[], memberCount: number): number {
  return addOns.filter((a) => addOnIds.includes(a.id)).reduce((sum, a) => sum + a.pricePerUnitFcfa * memberCount, 0);
}
