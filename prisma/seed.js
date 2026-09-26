// One-time (and re-runnable) seed for the pricing catalog — see the
// PricingTier/PricingAddOn models in schema.prisma and lib/pricing.ts.
// Run with `npx prisma db seed` (wired up via the "prisma.seed" entry in
// package.json) after the migration that creates these two tables. Uses
// upsert, so running it again later (e.g. after adding a new tier here)
// just updates/adds rows without duplicating or touching ones already
// edited by hand in Prisma Studio... except it WOULD overwrite manual
// edits to a tier whose id is listed below, since upsert's `update`
// resets every field — safe to re-run right after a migration, but don't
// re-run this file casually once prices have been hand-tuned in Studio.
//
// Plain CommonJS (not TypeScript) so it runs with a plain `node`, no
// ts-node/tsx dependency needed.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TIERS = [
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
    order: 1,
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
    order: 2,
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
    order: 3,
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
    order: 4,
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
    order: 5,
  },
];

const ADD_ONS = [
  {
    id: "file-storage",
    name: "Gestion de fichiers",
    unit: "member",
    pricePerUnitFcfa: 500,
    priceEurApprox: 0.8,
    priceUsdApprox: 0.85,
    description: "Ajouter de vrais fichiers (pas seulement des liens) directement sur les tâches, avec stockage dédié.",
    order: 1,
  },
  {
    id: "whatsapp-alerts",
    name: "Alertes WhatsApp",
    unit: "agent",
    pricePerUnitFcfa: 300,
    priceEurApprox: 0.5,
    priceUsdApprox: 0.5,
    description: "Envoyer aussi les alertes de délai (et les autres notifications) par WhatsApp, sur le numéro de chaque agent.",
    order: 2,
  },
];

async function main() {
  for (const tier of TIERS) {
    await prisma.pricingTier.upsert({ where: { id: tier.id }, create: tier, update: tier });
  }
  for (const addOn of ADD_ONS) {
    await prisma.pricingAddOn.upsert({ where: { id: addOn.id }, create: addOn, update: addOn });
  }
  console.log(`Seeded ${TIERS.length} offre(s) et ${ADD_ONS.length} option(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
