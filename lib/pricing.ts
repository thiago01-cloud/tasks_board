// Pricing tiers for the "Abonnement" showcase page (app/dashboard/
// subscription) — see that page and app/api/companies/plan/route.ts.
//
// Vitrine only for now: no payment provider (Stripe or otherwise) is
// wired up yet. Choosing a tier just records its id on Company.plan (a
// plain string, already in the schema with a "free" default) so the UI
// can show what's "active" — nothing is actually charged.
//
// Brackets are by number of members (Agent rows) in the company, not by
// feature: every tier unlocks the exact same set of platform features.
// That's deliberate — the infra behind this app (Neon Postgres, Vercel
// hosting, Resend email) is largely fixed/shared cost, not a true
// per-seat cost, so gating features by tier wouldn't reflect anything
// real about our load. Prices instead scale with the size/value of the
// organization (and, a little, with the support burden a bigger team
// implies) rather than strict marginal server cost, and are kept modest
// for the Gabon/francophone-Africa small-business audience this app is
// built for.
//
// FCFA (XAF) is the reference currency; the EUR/USD figures alongside
// each tier are rounded approximations for reference only (peg used:
// 1 EUR = 655.957 FCFA, ~1 USD = 600 FCFA), not a live conversion.
export type PricingTier = {
  id: string;
  name: string;
  minMembers: number;
  maxMembers: number | null; // null = no upper bound ("51+")
  priceFcfa: number | null; // null = "sur devis" (custom quote, no self-serve price)
  priceEurApprox: number | null;
  priceUsdApprox: number | null;
  tagline: string;
  support: string;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    minMembers: 1,
    maxMembers: 5,
    priceFcfa: 15000,
    priceEurApprox: 23,
    priceUsdApprox: 25,
    tagline: "Pour une petite équipe qui démarre.",
    support: "Support par email",
  },
  {
    id: "equipe",
    name: "Équipe",
    minMembers: 6,
    maxMembers: 10,
    priceFcfa: 28000,
    priceEurApprox: 43,
    priceUsdApprox: 47,
    tagline: "Pour une équipe en pleine croissance.",
    support: "Support par email",
  },
  {
    id: "business",
    name: "Business",
    minMembers: 11,
    maxMembers: 20,
    priceFcfa: 48000,
    priceEurApprox: 73,
    priceUsdApprox: 80,
    tagline: "Pour plusieurs services ou départements.",
    support: "Support prioritaire",
  },
  {
    id: "croissance",
    name: "Croissance",
    minMembers: 21,
    maxMembers: 50,
    priceFcfa: 85000,
    priceEurApprox: 130,
    priceUsdApprox: 142,
    tagline: "Pour une organisation à grande échelle.",
    support: "Support prioritaire",
  },
  {
    id: "entreprise",
    name: "Entreprise",
    minMembers: 51,
    maxMembers: null,
    priceFcfa: null,
    priceEurApprox: null,
    priceUsdApprox: null,
    tagline: "Au-delà de 50 membres, ou des besoins spécifiques.",
    support: "Support dédié",
  },
];

// The tier that matches a given member count — used to pre-select/
// highlight a recommendation on the subscription page. Falls back to the
// last (uncapped) tier if, somehow, none of the bounded ones match.
export function tierForMemberCount(count: number): PricingTier {
  return (
    PRICING_TIERS.find((t) => count >= t.minMembers && (t.maxMembers === null || count <= t.maxMembers)) ||
    PRICING_TIERS[PRICING_TIERS.length - 1]
  );
}

export function tierById(id: string): PricingTier | null {
  return PRICING_TIERS.find((t) => t.id === id) || null;
}

// Add-on options shown once a plan is chosen (see app/dashboard/
// subscription) — vitrine only, same as the tiers above: choosing one
// just records its id on Company.addOns, nothing real is wired up behind
// either yet (no file storage service, no WhatsApp API account). Both
// bill per headcount — "membre" and "agent" both mean an Agent row here,
// the wording just matches how each option was described.
export type AddOn = {
  id: string;
  name: string;
  unit: "member" | "agent";
  pricePerUnitFcfa: number;
  priceEurApprox: number;
  priceUsdApprox: number;
  description: string;
};

export const ADD_ONS: AddOn[] = [
  {
    id: "file-storage",
    name: "Gestion de fichiers",
    unit: "member",
    pricePerUnitFcfa: 500,
    priceEurApprox: 0.8,
    priceUsdApprox: 0.85,
    description: "Ajouter de vrais fichiers (pas seulement des liens) directement sur les tâches, avec stockage dédié.",
  },
  {
    id: "whatsapp-alerts",
    name: "Alertes WhatsApp",
    unit: "agent",
    pricePerUnitFcfa: 300,
    priceEurApprox: 0.5,
    priceUsdApprox: 0.5,
    description: "Envoyer aussi les alertes de délai (et les autres notifications) par WhatsApp, sur le numéro de chaque agent.",
  },
];

export function addOnById(id: string): AddOn | null {
  return ADD_ONS.find((a) => a.id === id) || null;
}

// Total monthly cost of a set of add-ons for a company of `memberCount`
// members — each add-on's per-unit price × the headcount (see the AddOn
// type's own comment: "membre" and "agent" are the same headcount here).
export function addOnsMonthlyTotal(addOnIds: string[], memberCount: number): number {
  return ADD_ONS.filter((a) => addOnIds.includes(a.id)).reduce((sum, a) => sum + a.pricePerUnitFcfa * memberCount, 0);
}
