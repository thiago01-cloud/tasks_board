import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSubscriptionManager } from "@/lib/auth";

// Records the current company's chosen pricing tier (Company.plan) and/or
// its active add-ons (Company.addOns) — see app/dashboard/subscription.
// Vitrine only for now: no payment is actually collected, this just
// persists what was clicked so the page can show it back as "Offre
// actuelle" / "Ajoutée" on a later visit. Both fields are optional in the
// body — SubscriptionPlans.tsx sends only `plan`, AddOnsPanel.tsx sends
// only `addOns` — but at least one must be present.
//
// `plan: "free"` is the one special case: it's not a real tier (see
// tierById()'s own comment in lib/pricing.ts) but the sentinel meaning
// "no offer chosen" — SubscriptionPlans.tsx's "Résilier mon abonnement"
// action sends exactly this to cancel. It always also clears addOns
// (an add-on billed per member doesn't make sense with no base plan to
// attach it to), regardless of what the body sent for `addOns`.
//
// Validated against the PricingTier/PricingAddOn tables (see
// prisma/schema.prisma and lib/pricing.ts) rather than a hardcoded list —
// so an id retired from there (active: false) is rejected here too,
// without needing a matching code change.
//
// Restricted to the company's owner, or an agent the owner has delegated
// this to (see requireSubscriptionManager() in lib/auth.ts) — not just
// any admin, per that permission's own design.
export async function PATCH(request: Request) {
  const { agent, error } = await requireSubscriptionManager();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  if (body.plan !== undefined) {
    const plan = String(body.plan || "");
    if (plan === "free") {
      // Cancelling — see the function comment above.
      data.plan = "free";
      data.addOns = [];
    } else {
      const tier = await prisma.pricingTier.findFirst({ where: { id: plan, active: true }, select: { id: true } });
      if (!tier) {
        return NextResponse.json({ error: "Offre invalide." }, { status: 400 });
      }
      data.plan = plan;
    }
  }

  // Only processed when the cancellation branch above hasn't already
  // decided addOns (it always wins: no add-ons without a base plan).
  if (body.addOns !== undefined && data.addOns === undefined) {
    const addOnIds: string[] = Array.isArray(body.addOns)
      ? body.addOns.filter((v: unknown) => typeof v === "string")
      : [];
    const unique = [...new Set(addOnIds)];
    if (unique.length > 0) {
      const validCount = await prisma.pricingAddOn.count({ where: { id: { in: unique }, active: true } });
      if (validCount !== unique.length) {
        return NextResponse.json({ error: "Option invalide." }, { status: 400 });
      }
    }
    data.addOns = unique;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour." }, { status: 400 });
  }

  const updated = await prisma.company.update({ where: { id: agent!.companyId }, data });
  return NextResponse.json({ ok: true, plan: updated.plan, addOns: updated.addOns });
}
