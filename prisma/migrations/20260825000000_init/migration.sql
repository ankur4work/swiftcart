-- CreateEnum
CREATE TYPE "Entitlement" AS ENUM ('NONE', 'ACTIVE');

-- CreateEnum
CREATE TYPE "BarDesign" AS ENUM ('BAR', 'BUTTON');

-- CreateEnum
CREATE TYPE "ButtonPosition" AS ENUM ('BOTTOM_RIGHT', 'BOTTOM_LEFT', 'MIDDLE_RIGHT', 'MIDDLE_LEFT');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT NOT NULL,
    "entitlement" "Entitlement" NOT NULL DEFAULT 'NONE',
    "shopifyChargeId" TEXT,
    "subscriptionStatus" TEXT,
    "subscriptionName" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "scheduledRedactAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartBarSettings" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "design" "BarDesign" NOT NULL DEFAULT 'BAR',
    "buttonPosition" "ButtonPosition" NOT NULL DEFAULT 'BOTTOM_RIGHT',
    "showOnDesktop" BOOLEAN NOT NULL DEFAULT true,
    "showOnMobile" BOOLEAN NOT NULL DEFAULT true,
    "hideWhenEmpty" BOOLEAN NOT NULL DEFAULT true,
    "backgroundColor" TEXT NOT NULL DEFAULT '#111827',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "accentColor" TEXT NOT NULL DEFAULT '#2563EB',
    "cornerRadius" INTEGER NOT NULL DEFAULT 12,
    "showItemCount" BOOLEAN NOT NULL DEFAULT true,
    "showSubtotal" BOOLEAN NOT NULL DEFAULT true,
    "ctaLabel" TEXT NOT NULL DEFAULT 'View cart',
    "cartOpenSelector" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartBarSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT,
    "shopifyChargeId" TEXT,
    "amount" TEXT,
    "currencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_shopDomain_key" ON "Store"("shopDomain");

-- CreateIndex
CREATE INDEX "Store_uninstalledAt_idx" ON "Store"("uninstalledAt");

-- CreateIndex
CREATE INDEX "Store_scheduledRedactAt_idx" ON "Store"("scheduledRedactAt");

-- CreateIndex
CREATE UNIQUE INDEX "CartBarSettings_storeId_key" ON "CartBarSettings"("storeId");

-- CreateIndex
CREATE INDEX "BillingEvent_storeId_createdAt_idx" ON "BillingEvent"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "CartBarSettings" ADD CONSTRAINT "CartBarSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
