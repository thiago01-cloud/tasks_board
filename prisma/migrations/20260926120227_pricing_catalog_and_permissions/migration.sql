-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "canManageSubscription" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "addOns" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "linkUrl" TEXT;

-- CreateTable
CREATE TABLE "pricing_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minMembers" INTEGER NOT NULL,
    "maxMembers" INTEGER,
    "priceFcfa" INTEGER,
    "priceEurApprox" DOUBLE PRECISION,
    "priceUsdApprox" DOUBLE PRECISION,
    "tagline" TEXT NOT NULL,
    "support" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_add_ons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "pricePerUnitFcfa" INTEGER NOT NULL,
    "priceEurApprox" DOUBLE PRECISION NOT NULL,
    "priceUsdApprox" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pricing_add_ons_pkey" PRIMARY KEY ("id")
);
