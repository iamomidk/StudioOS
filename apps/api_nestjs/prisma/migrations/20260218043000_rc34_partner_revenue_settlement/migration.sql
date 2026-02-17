-- CreateEnum
CREATE TYPE "SettlementPartnerStatus" AS ENUM ('active', 'paused', 'terminated');

-- CreateEnum
CREATE TYPE "SettlementPeriodStatus" AS ENUM ('draft', 'review', 'approved', 'paid', 'reconciled', 'on_hold');

-- CreateEnum
CREATE TYPE "SettlementPayoutStatus" AS ENUM ('pending', 'on_hold', 'paid', 'failed');

-- CreateTable
CREATE TABLE "SettlementPartner" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalRef" TEXT,
    "status" "SettlementPartnerStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementAgreement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" "SettlementPartnerStatus" NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "minimumGuaranteeCents" INTEGER NOT NULL DEFAULT 0,
    "clawbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementRevenueShareRule" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "shareBps" INTEGER NOT NULL,
    "tierConfig" JSONB,
    "minCents" INTEGER NOT NULL DEFAULT 0,
    "maxCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementRevenueShareRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementPeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "SettlementPeriodStatus" NOT NULL DEFAULT 'draft',
    "holdReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementAccrualEntry" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "chargebackCents" INTEGER NOT NULL DEFAULT 0,
    "partnerShareCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementAccrualEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementAdjustmentEntry" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "note" TEXT,
    "carryForward" BOOLEAN NOT NULL DEFAULT false,
    "appliedToPeriodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementAdjustmentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementStatement" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "totalAccruedCents" INTEGER NOT NULL,
    "totalAdjustmentsCents" INTEGER NOT NULL,
    "totalPayableCents" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementPayoutInstruction" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "statementId" TEXT,
    "organizationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "SettlementPayoutStatus" NOT NULL DEFAULT 'pending',
    "payoutReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementPayoutInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SettlementPartner_organizationId_name_key" ON "SettlementPartner"("organizationId", "name");

-- CreateIndex
CREATE INDEX "SettlementPartner_organizationId_status_createdAt_idx" ON "SettlementPartner"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SettlementAgreement_organizationId_status_createdAt_idx" ON "SettlementAgreement"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SettlementRevenueShareRule_agreementId_productCategory_createdAt_idx" ON "SettlementRevenueShareRule"("agreementId", "productCategory", "createdAt");

-- CreateIndex
CREATE INDEX "SettlementPeriod_organizationId_status_periodStart_periodEnd_idx" ON "SettlementPeriod"("organizationId", "status", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SettlementAccrualEntry_periodId_createdAt_idx" ON "SettlementAccrualEntry"("periodId", "createdAt");

-- CreateIndex
CREATE INDEX "SettlementAccrualEntry_organizationId_sourceEntityType_sourceEntityId_idx" ON "SettlementAccrualEntry"("organizationId", "sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "SettlementAdjustmentEntry_periodId_createdAt_idx" ON "SettlementAdjustmentEntry"("periodId", "createdAt");

-- CreateIndex
CREATE INDEX "SettlementAdjustmentEntry_organizationId_carryForward_appliedToPeriodId_idx" ON "SettlementAdjustmentEntry"("organizationId", "carryForward", "appliedToPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementStatement_periodId_key" ON "SettlementStatement"("periodId");

-- CreateIndex
CREATE INDEX "SettlementStatement_organizationId_createdAt_idx" ON "SettlementStatement"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementPayoutInstruction_periodId_key" ON "SettlementPayoutInstruction"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementPayoutInstruction_statementId_key" ON "SettlementPayoutInstruction"("statementId");

-- CreateIndex
CREATE INDEX "SettlementPayoutInstruction_organizationId_status_createdAt_idx" ON "SettlementPayoutInstruction"("organizationId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "SettlementPartner" ADD CONSTRAINT "SettlementPartner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAgreement" ADD CONSTRAINT "SettlementAgreement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAgreement" ADD CONSTRAINT "SettlementAgreement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "SettlementPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementRevenueShareRule" ADD CONSTRAINT "SettlementRevenueShareRule_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "SettlementAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPeriod" ADD CONSTRAINT "SettlementPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPeriod" ADD CONSTRAINT "SettlementPeriod_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "SettlementAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAccrualEntry" ADD CONSTRAINT "SettlementAccrualEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SettlementPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAccrualEntry" ADD CONSTRAINT "SettlementAccrualEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAdjustmentEntry" ADD CONSTRAINT "SettlementAdjustmentEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SettlementPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAdjustmentEntry" ADD CONSTRAINT "SettlementAdjustmentEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAdjustmentEntry" ADD CONSTRAINT "SettlementAdjustmentEntry_appliedToPeriodId_fkey" FOREIGN KEY ("appliedToPeriodId") REFERENCES "SettlementPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementStatement" ADD CONSTRAINT "SettlementStatement_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SettlementPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementStatement" ADD CONSTRAINT "SettlementStatement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementStatement" ADD CONSTRAINT "SettlementStatement_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPayoutInstruction" ADD CONSTRAINT "SettlementPayoutInstruction_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SettlementPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPayoutInstruction" ADD CONSTRAINT "SettlementPayoutInstruction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "SettlementStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPayoutInstruction" ADD CONSTRAINT "SettlementPayoutInstruction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
