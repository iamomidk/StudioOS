-- CreateEnum
CREATE TYPE "ModerationPolicyStatus" AS ENUM ('draft', 'active', 'retired');

-- CreateEnum
CREATE TYPE "ModerationCaseStatus" AS ENUM ('open', 'in_review', 'resolved', 'appealed', 'closed');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('allow', 'warn', 'throttle', 'quarantine', 'block', 'escalate');

-- CreateEnum
CREATE TYPE "ModerationSanctionStatus" AS ENUM ('active', 'expired', 'revoked');

-- CreateTable
CREATE TABLE "ModerationPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ModerationPolicyStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationPolicyVersion" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "violationTypes" TEXT[],
    "keywordRules" TEXT[],
    "classifierConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT,
    "policyVersionId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" "ModerationCaseStatus" NOT NULL DEFAULT 'open',
    "contentSnapshot" TEXT NOT NULL,
    "matchedRules" TEXT[],
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "suggestedAction" "ModerationActionType" NOT NULL DEFAULT 'allow',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationDecision" (
    "id" TEXT NOT NULL,
    "moderationCaseId" TEXT NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAppeal" (
    "id" TEXT NOT NULL,
    "moderationCaseId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ModerationCaseStatus" NOT NULL DEFAULT 'open',
    "requestedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationSanction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "moderationCaseId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "status" "ModerationSanctionStatus" NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationSanction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAbuseReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentType" TEXT,
    "attachmentUrl" TEXT,
    "quarantineStatus" TEXT NOT NULL,
    "reporterUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAbuseReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationPolicy_organizationId_status_createdAt_idx" ON "ModerationPolicy"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationPolicyVersion_policyId_versionNumber_key" ON "ModerationPolicyVersion"("policyId", "versionNumber");

-- CreateIndex
CREATE INDEX "ModerationPolicyVersion_policyId_createdAt_idx" ON "ModerationPolicyVersion"("policyId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationCase_organizationId_status_createdAt_idx" ON "ModerationCase"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationCase_organizationId_violationType_createdAt_idx" ON "ModerationCase"("organizationId", "violationType", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationDecision_moderationCaseId_createdAt_idx" ON "ModerationDecision"("moderationCaseId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAppeal_moderationCaseId_createdAt_idx" ON "ModerationAppeal"("moderationCaseId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationSanction_organizationId_status_expiresAt_idx" ON "ModerationSanction"("organizationId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "ModerationAbuseReport_organizationId_createdAt_idx" ON "ModerationAbuseReport"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAbuseReport_entityType_entityId_createdAt_idx" ON "ModerationAbuseReport"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "ModerationPolicy" ADD CONSTRAINT "ModerationPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationPolicyVersion" ADD CONSTRAINT "ModerationPolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ModerationPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ModerationPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "ModerationPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_moderationCaseId_fkey" FOREIGN KEY ("moderationCaseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_moderationCaseId_fkey" FOREIGN KEY ("moderationCaseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationSanction" ADD CONSTRAINT "ModerationSanction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationSanction" ADD CONSTRAINT "ModerationSanction_moderationCaseId_fkey" FOREIGN KEY ("moderationCaseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAbuseReport" ADD CONSTRAINT "ModerationAbuseReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAbuseReport" ADD CONSTRAINT "ModerationAbuseReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
