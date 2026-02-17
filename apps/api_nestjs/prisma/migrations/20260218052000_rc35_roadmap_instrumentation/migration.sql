-- CreateEnum
CREATE TYPE "StrategicMetricKind" AS ENUM ('north_star', 'leading_indicator');

-- CreateEnum
CREATE TYPE "StrategicDefinitionStatus" AS ENUM ('active', 'archived');

-- CreateTable
CREATE TABLE "StrategicMetricDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "StrategicMetricKind" NOT NULL,
    "owner" TEXT NOT NULL,
    "guardrail" TEXT,
    "status" "StrategicDefinitionStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategicMetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicMetricDefinitionVersion" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "formula" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "changeReason" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategicMetricDefinitionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicScorecard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "northStarMetricKey" TEXT NOT NULL,
    "onTrack" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "summary" JSONB,

    CONSTRAINT "StrategicScorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicScorecardMetric" (
    "id" TEXT NOT NULL,
    "scorecardId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "definitionVersionId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "variance" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "anomaly" BOOLEAN NOT NULL DEFAULT false,
    "commentary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategicScorecardMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicExperimentImpact" (
    "id" TEXT NOT NULL,
    "scorecardMetricId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "preWindowValue" DOUBLE PRECISION NOT NULL,
    "postWindowValue" DOUBLE PRECISION NOT NULL,
    "deltaValue" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategicExperimentImpact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StrategicMetricDefinition_organizationId_metricKey_key" ON "StrategicMetricDefinition"("organizationId", "metricKey");

-- CreateIndex
CREATE INDEX "StrategicMetricDefinition_organizationId_kind_status_createdAt_idx" ON "StrategicMetricDefinition"("organizationId", "kind", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StrategicMetricDefinitionVersion_definitionId_versionNumber_key" ON "StrategicMetricDefinitionVersion"("definitionId", "versionNumber");

-- CreateIndex
CREATE INDEX "StrategicMetricDefinitionVersion_definitionId_createdAt_idx" ON "StrategicMetricDefinitionVersion"("definitionId", "createdAt");

-- CreateIndex
CREATE INDEX "StrategicScorecard_organizationId_frequency_generatedAt_idx" ON "StrategicScorecard"("organizationId", "frequency", "generatedAt");

-- CreateIndex
CREATE INDEX "StrategicScorecardMetric_scorecardId_metricKey_idx" ON "StrategicScorecardMetric"("scorecardId", "metricKey");

-- CreateIndex
CREATE INDEX "StrategicScorecardMetric_definitionId_createdAt_idx" ON "StrategicScorecardMetric"("definitionId", "createdAt");

-- CreateIndex
CREATE INDEX "StrategicExperimentImpact_scorecardMetricId_experimentId_idx" ON "StrategicExperimentImpact"("scorecardMetricId", "experimentId");

-- AddForeignKey
ALTER TABLE "StrategicMetricDefinition" ADD CONSTRAINT "StrategicMetricDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicMetricDefinitionVersion" ADD CONSTRAINT "StrategicMetricDefinitionVersion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "StrategicMetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicMetricDefinitionVersion" ADD CONSTRAINT "StrategicMetricDefinitionVersion_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicScorecard" ADD CONSTRAINT "StrategicScorecard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicScorecardMetric" ADD CONSTRAINT "StrategicScorecardMetric_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "StrategicScorecard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicScorecardMetric" ADD CONSTRAINT "StrategicScorecardMetric_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "StrategicMetricDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicScorecardMetric" ADD CONSTRAINT "StrategicScorecardMetric_definitionVersionId_fkey" FOREIGN KEY ("definitionVersionId") REFERENCES "StrategicMetricDefinitionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicExperimentImpact" ADD CONSTRAINT "StrategicExperimentImpact_scorecardMetricId_fkey" FOREIGN KEY ("scorecardMetricId") REFERENCES "StrategicScorecardMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
