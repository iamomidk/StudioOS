-- CreateEnum
CREATE TYPE "RiskScoringMode" AS ENUM ('OFF', 'ADVISORY', 'SOFT_ENFORCE', 'HARD_ENFORCE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "RiskEvaluation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "flowType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "mode" "RiskScoringMode" NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "reasonCodes" TEXT[],
    "actionTaken" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "bypassed" BOOLEAN NOT NULL DEFAULT false,
    "pilotCohortId" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskEvaluation_organizationId_createdAt_idx" ON "RiskEvaluation"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskEvaluation_flowType_riskLevel_createdAt_idx" ON "RiskEvaluation"("flowType", "riskLevel", "createdAt");

-- CreateIndex
CREATE INDEX "RiskEvaluation_reviewStatus_createdAt_idx" ON "RiskEvaluation"("reviewStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "RiskEvaluation" ADD CONSTRAINT "RiskEvaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskEvaluation" ADD CONSTRAINT "RiskEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
