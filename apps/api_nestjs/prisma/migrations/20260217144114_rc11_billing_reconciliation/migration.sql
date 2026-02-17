-- CreateEnum
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('completed', 'failed');

-- CreateEnum
CREATE TYPE "ReconciliationItemStatus" AS ENUM ('matched', 'discrepant');

-- CreateEnum
CREATE TYPE "ReconciliationDiscrepancyType" AS ENUM ('MissingInternalRecord', 'MissingProviderRecord', 'AmountMismatch', 'CurrencyMismatch', 'StatusMismatch', 'DuplicateChargeSuspected');

-- CreateEnum
CREATE TYPE "ReconciliationDiscrepancyStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'completed',
    "totalInternalRecords" INTEGER NOT NULL DEFAULT 0,
    "totalProviderRecords" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "discrepancyCount" INTEGER NOT NULL DEFAULT 0,
    "mismatchAmountCents" INTEGER NOT NULL DEFAULT 0,
    "reportJson" JSONB,
    "reportMarkdown" TEXT,
    "triggeredByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "providerEventId" TEXT,
    "providerRef" TEXT,
    "internalAmountCents" INTEGER,
    "providerAmountCents" INTEGER,
    "currency" TEXT,
    "status" "ReconciliationItemStatus" NOT NULL DEFAULT 'matched',
    "discrepancyType" "ReconciliationDiscrepancyType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationDiscrepancy" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "itemId" TEXT,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "providerEventId" TEXT,
    "type" "ReconciliationDiscrepancyType" NOT NULL,
    "status" "ReconciliationDiscrepancyStatus" NOT NULL DEFAULT 'open',
    "ownerUserId" TEXT,
    "acknowledgedByUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionReason" TEXT,
    "notes" TEXT,
    "amountDeltaCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationActionLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "discrepancyId" TEXT,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationRun_organizationId_createdAt_idx" ON "ReconciliationRun"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationItem_runId_status_idx" ON "ReconciliationItem"("runId", "status");

-- CreateIndex
CREATE INDEX "ReconciliationItem_organizationId_invoiceId_idx" ON "ReconciliationItem"("organizationId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationDiscrepancy_itemId_key" ON "ReconciliationDiscrepancy"("itemId");

-- CreateIndex
CREATE INDEX "ReconciliationDiscrepancy_runId_status_type_idx" ON "ReconciliationDiscrepancy"("runId", "status", "type");

-- CreateIndex
CREATE INDEX "ReconciliationDiscrepancy_organizationId_createdAt_idx" ON "ReconciliationDiscrepancy"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationActionLog_runId_createdAt_idx" ON "ReconciliationActionLog"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationActionLog_organizationId_createdAt_idx" ON "ReconciliationActionLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_providerEventId_fkey" FOREIGN KEY ("providerEventId") REFERENCES "PaymentWebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDiscrepancy" ADD CONSTRAINT "ReconciliationDiscrepancy_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDiscrepancy" ADD CONSTRAINT "ReconciliationDiscrepancy_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ReconciliationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDiscrepancy" ADD CONSTRAINT "ReconciliationDiscrepancy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDiscrepancy" ADD CONSTRAINT "ReconciliationDiscrepancy_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDiscrepancy" ADD CONSTRAINT "ReconciliationDiscrepancy_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDiscrepancy" ADD CONSTRAINT "ReconciliationDiscrepancy_providerEventId_fkey" FOREIGN KEY ("providerEventId") REFERENCES "PaymentWebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDiscrepancy" ADD CONSTRAINT "ReconciliationDiscrepancy_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDiscrepancy" ADD CONSTRAINT "ReconciliationDiscrepancy_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDiscrepancy" ADD CONSTRAINT "ReconciliationDiscrepancy_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationActionLog" ADD CONSTRAINT "ReconciliationActionLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationActionLog" ADD CONSTRAINT "ReconciliationActionLog_discrepancyId_fkey" FOREIGN KEY ("discrepancyId") REFERENCES "ReconciliationDiscrepancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationActionLog" ADD CONSTRAINT "ReconciliationActionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationActionLog" ADD CONSTRAINT "ReconciliationActionLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
