-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'legal_review', 'business_approval', 'sent', 'signed', 'active', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "ContractSignatureStatus" AS ENUM ('pending', 'signed', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "ContractApprovalFlowStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ContractApprovalStepStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "ContractClauseSet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clauses" JSONB NOT NULL,
    "requiredClauseKeys" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractClauseSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "contractType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "signatureStatus" "ContractSignatureStatus" NOT NULL DEFAULT 'pending',
    "contractValueCents" INTEGER NOT NULL,
    "riskTier" TEXT NOT NULL DEFAULT 'standard',
    "currentVersionId" TEXT,
    "approvalFlowId" TEXT,
    "signatureProviderRef" TEXT,
    "signatureLastEventId" TEXT,
    "signatureLastEventAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "activeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "clauseSetId" TEXT,
    "clauseKeys" TEXT[],
    "missingMandatoryClauses" TEXT[],
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAmendment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "fromVersionId" TEXT NOT NULL,
    "toVersionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractRenewalSchedule" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "renewAt" TIMESTAMP(3) NOT NULL,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 30,
    "autoDraftAmendment" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractRenewalSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractApprovalFlow" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "status" "ContractApprovalFlowStatus" NOT NULL DEFAULT 'pending',
    "policySnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractApprovalFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractApprovalStep" (
    "id" TEXT NOT NULL,
    "approvalFlowId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverRole" TEXT NOT NULL,
    "status" "ContractApprovalStepStatus" NOT NULL DEFAULT 'pending',
    "actedByUserId" TEXT,
    "actedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractClauseSet_organizationId_name_key" ON "ContractClauseSet"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ContractClauseSet_organizationId_createdAt_idx" ON "ContractClauseSet"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_approvalFlowId_key" ON "Contract"("approvalFlowId");

-- CreateIndex
CREATE INDEX "Contract_organizationId_status_createdAt_idx" ON "Contract"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Contract_organizationId_contractType_createdAt_idx" ON "Contract"("organizationId", "contractType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersion_contractId_versionNumber_key" ON "ContractVersion"("contractId", "versionNumber");

-- CreateIndex
CREATE INDEX "ContractVersion_contractId_createdAt_idx" ON "ContractVersion"("contractId", "createdAt");

-- CreateIndex
CREATE INDEX "ContractAmendment_contractId_createdAt_idx" ON "ContractAmendment"("contractId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRenewalSchedule_contractId_key" ON "ContractRenewalSchedule"("contractId");

-- CreateIndex
CREATE INDEX "ContractRenewalSchedule_renewAt_idx" ON "ContractRenewalSchedule"("renewAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractApprovalFlow_contractId_key" ON "ContractApprovalFlow"("contractId");

-- CreateIndex
CREATE INDEX "ContractApprovalFlow_status_createdAt_idx" ON "ContractApprovalFlow"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractApprovalStep_approvalFlowId_stepOrder_key" ON "ContractApprovalStep"("approvalFlowId", "stepOrder");

-- CreateIndex
CREATE INDEX "ContractApprovalStep_status_createdAt_idx" ON "ContractApprovalStep"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ContractClauseSet" ADD CONSTRAINT "ContractClauseSet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ContractVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_approvalFlowId_fkey" FOREIGN KEY ("approvalFlowId") REFERENCES "ContractApprovalFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_clauseSetId_fkey" FOREIGN KEY ("clauseSetId") REFERENCES "ContractClauseSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_fromVersionId_fkey" FOREIGN KEY ("fromVersionId") REFERENCES "ContractVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_toVersionId_fkey" FOREIGN KEY ("toVersionId") REFERENCES "ContractVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRenewalSchedule" ADD CONSTRAINT "ContractRenewalSchedule_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractApprovalFlow" ADD CONSTRAINT "ContractApprovalFlow_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractApprovalStep" ADD CONSTRAINT "ContractApprovalStep_approvalFlowId_fkey" FOREIGN KEY ("approvalFlowId") REFERENCES "ContractApprovalFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractApprovalStep" ADD CONSTRAINT "ContractApprovalStep_actedByUserId_fkey" FOREIGN KEY ("actedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
