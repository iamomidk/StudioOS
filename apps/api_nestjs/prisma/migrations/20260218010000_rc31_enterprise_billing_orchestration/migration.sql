-- CreateEnum
CREATE TYPE "BillingPriceComponentType" AS ENUM ('fixed', 'seat', 'usage');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'cancelled');

-- CreateEnum
CREATE TYPE "TrueUpStatus" AS ENUM ('pending', 'invoiced', 'settled');

-- CreateEnum
CREATE TYPE "BillingAdjustmentStatus" AS ENUM ('pending_approval', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "RentalSyncDiagnostic" ALTER COLUMN "conflictingFields" DROP DEFAULT;

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "billingCycle" "BillingCycle" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPlanVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "minimumCommitCents" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPriceComponent" (
    "id" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "componentType" "BillingPriceComponentType" NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "unit" TEXT,
    "unitPriceCents" INTEGER NOT NULL,
    "includedUnits" INTEGER NOT NULL DEFAULT 0,
    "minimumUnits" INTEGER NOT NULL DEFAULT 0,
    "tierJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPriceComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "planId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscriptionItem" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingMeter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingMeter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingUsageRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "usageAt" TIMESTAMP(3) NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api',
    "correctionOfId" TEXT,
    "ingestedByUserId" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingTrueUpRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "TrueUpStatus" NOT NULL DEFAULT 'pending',
    "generatedInvoiceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingTrueUpRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoiceLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "componentId" TEXT,
    "lineType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscriptionSeatChangeLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "fromQuantity" INTEGER NOT NULL,
    "toQuantity" INTEGER NOT NULL,
    "prorationDeltaCents" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" TEXT,

    CONSTRAINT "BillingSubscriptionSeatChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAdjustmentRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "invoiceId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BillingAdjustmentStatus" NOT NULL DEFAULT 'pending_approval',
    "requestedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAdjustmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingPlan_organizationId_createdAt_idx" ON "BillingPlan"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlan_organizationId_code_key" ON "BillingPlan"("organizationId", "code");

-- CreateIndex
CREATE INDEX "BillingPlanVersion_organizationId_planId_effectiveFrom_idx" ON "BillingPlanVersion"("organizationId", "planId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlanVersion_planId_versionNumber_key" ON "BillingPlanVersion"("planId", "versionNumber");

-- CreateIndex
CREATE INDEX "BillingPriceComponent_planVersionId_componentType_idx" ON "BillingPriceComponent"("planVersionId", "componentType");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPriceComponent_planVersionId_code_key" ON "BillingPriceComponent"("planVersionId", "code");

-- CreateIndex
CREATE INDEX "BillingSubscription_organizationId_status_currentPeriodEnd_idx" ON "BillingSubscription"("organizationId", "status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "BillingSubscriptionItem_subscriptionId_createdAt_idx" ON "BillingSubscriptionItem"("subscriptionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscriptionItem_subscriptionId_componentId_key" ON "BillingSubscriptionItem"("subscriptionId", "componentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingMeter_organizationId_code_key" ON "BillingMeter"("organizationId", "code");

-- CreateIndex
CREATE INDEX "BillingUsageRecord_subscriptionId_usageAt_idx" ON "BillingUsageRecord"("subscriptionId", "usageAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingUsageRecord_organizationId_dedupKey_key" ON "BillingUsageRecord"("organizationId", "dedupKey");

-- CreateIndex
CREATE INDEX "BillingTrueUpRecord_organizationId_status_createdAt_idx" ON "BillingTrueUpRecord"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BillingInvoiceLine_invoiceId_createdAt_idx" ON "BillingInvoiceLine"("invoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingInvoiceLine_organizationId_subscriptionId_idx" ON "BillingInvoiceLine"("organizationId", "subscriptionId");

-- CreateIndex
CREATE INDEX "BillingSubscriptionSeatChangeLog_subscriptionId_changedAt_idx" ON "BillingSubscriptionSeatChangeLog"("subscriptionId", "changedAt");

-- CreateIndex
CREATE INDEX "BillingAdjustmentRequest_organizationId_status_createdAt_idx" ON "BillingAdjustmentRequest"("organizationId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "BillingPlan" ADD CONSTRAINT "BillingPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPlanVersion" ADD CONSTRAINT "BillingPlanVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPlanVersion" ADD CONSTRAINT "BillingPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPriceComponent" ADD CONSTRAINT "BillingPriceComponent_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "BillingPlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "BillingPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscriptionItem" ADD CONSTRAINT "BillingSubscriptionItem_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscriptionItem" ADD CONSTRAINT "BillingSubscriptionItem_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "BillingPriceComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingMeter" ADD CONSTRAINT "BillingMeter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingUsageRecord" ADD CONSTRAINT "BillingUsageRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingUsageRecord" ADD CONSTRAINT "BillingUsageRecord_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingUsageRecord" ADD CONSTRAINT "BillingUsageRecord_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "BillingMeter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingUsageRecord" ADD CONSTRAINT "BillingUsageRecord_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "BillingUsageRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingUsageRecord" ADD CONSTRAINT "BillingUsageRecord_ingestedByUserId_fkey" FOREIGN KEY ("ingestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingTrueUpRecord" ADD CONSTRAINT "BillingTrueUpRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingTrueUpRecord" ADD CONSTRAINT "BillingTrueUpRecord_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingTrueUpRecord" ADD CONSTRAINT "BillingTrueUpRecord_generatedInvoiceId_fkey" FOREIGN KEY ("generatedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "BillingPriceComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscriptionSeatChangeLog" ADD CONSTRAINT "BillingSubscriptionSeatChangeLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscriptionSeatChangeLog" ADD CONSTRAINT "BillingSubscriptionSeatChangeLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscriptionSeatChangeLog" ADD CONSTRAINT "BillingSubscriptionSeatChangeLog_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAdjustmentRequest" ADD CONSTRAINT "BillingAdjustmentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAdjustmentRequest" ADD CONSTRAINT "BillingAdjustmentRequest_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAdjustmentRequest" ADD CONSTRAINT "BillingAdjustmentRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAdjustmentRequest" ADD CONSTRAINT "BillingAdjustmentRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAdjustmentRequest" ADD CONSTRAINT "BillingAdjustmentRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "RentalSyncDiagnostic_organizationId_deviceSessionId_updatedAt_i" RENAME TO "RentalSyncDiagnostic_organizationId_deviceSessionId_updated_idx";

-- RenameIndex
ALTER INDEX "WorkflowConditionGroup_workflowId_workflowVersionId_parentGroup" RENAME TO "WorkflowConditionGroup_workflowId_workflowVersionId_parentG_idx";

-- RenameIndex
ALTER INDEX "WorkflowExecutionLog_organizationId_workflowId_entityType_entit" RENAME TO "WorkflowExecutionLog_organizationId_workflowId_entityType_e_idx";
