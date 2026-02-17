CREATE TYPE "ExperimentStatus" AS ENUM ('draft', 'active', 'paused', 'stopped');
CREATE TYPE "AllocationTargetType" AS ENUM ('all', 'organization', 'cohort');

CREATE TABLE "PricingExperiment" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "ExperimentStatus" NOT NULL DEFAULT 'draft',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "killSwitchEnabled" BOOLEAN NOT NULL DEFAULT false,
  "maxExposure" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingExperiment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingVariant" (
  "id" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "pricingMultiplier" DOUBLE PRECISION,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingAllocationRule" (
  "id" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "targetType" "AllocationTargetType" NOT NULL,
  "targetValue" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PricingAllocationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingExposureLog" (
  "id" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "idempotencyKey" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PricingExposureLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingConversionEventLink" (
  "id" TEXT NOT NULL,
  "exposureLogId" TEXT NOT NULL,
  "analyticsEventId" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PricingConversionEventLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PricingExperiment_key_key" ON "PricingExperiment"("key");
CREATE INDEX "PricingExperiment_status_startsAt_endsAt_idx" ON "PricingExperiment"("status", "startsAt", "endsAt");

CREATE UNIQUE INDEX "PricingVariant_experimentId_key_key" ON "PricingVariant"("experimentId", "key");
CREATE INDEX "PricingVariant_experimentId_idx" ON "PricingVariant"("experimentId");

CREATE INDEX "PricingAllocationRule_experimentId_targetType_targetValue_idx" ON "PricingAllocationRule"("experimentId", "targetType", "targetValue");

CREATE UNIQUE INDEX "PricingExposureLog_idempotencyKey_key" ON "PricingExposureLog"("idempotencyKey");
CREATE INDEX "PricingExposureLog_experimentId_variantId_occurredAt_idx" ON "PricingExposureLog"("experimentId", "variantId", "occurredAt");
CREATE INDEX "PricingExposureLog_organizationId_occurredAt_idx" ON "PricingExposureLog"("organizationId", "occurredAt");
CREATE INDEX "PricingExposureLog_subjectType_subjectKey_occurredAt_idx" ON "PricingExposureLog"("subjectType", "subjectKey", "occurredAt");
CREATE INDEX "PricingExposureLog_entityType_entityId_occurredAt_idx" ON "PricingExposureLog"("entityType", "entityId", "occurredAt");

CREATE UNIQUE INDEX "PricingConversionEventLink_exposureLogId_analyticsEventId_key" ON "PricingConversionEventLink"("exposureLogId", "analyticsEventId");
CREATE INDEX "PricingConversionEventLink_eventName_occurredAt_idx" ON "PricingConversionEventLink"("eventName", "occurredAt");

ALTER TABLE "PricingVariant"
ADD CONSTRAINT "PricingVariant_experimentId_fkey"
FOREIGN KEY ("experimentId") REFERENCES "PricingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingAllocationRule"
ADD CONSTRAINT "PricingAllocationRule_experimentId_fkey"
FOREIGN KEY ("experimentId") REFERENCES "PricingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingExposureLog"
ADD CONSTRAINT "PricingExposureLog_experimentId_fkey"
FOREIGN KEY ("experimentId") REFERENCES "PricingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingExposureLog"
ADD CONSTRAINT "PricingExposureLog_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "PricingVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingExposureLog"
ADD CONSTRAINT "PricingExposureLog_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingConversionEventLink"
ADD CONSTRAINT "PricingConversionEventLink_exposureLogId_fkey"
FOREIGN KEY ("exposureLogId") REFERENCES "PricingExposureLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingConversionEventLink"
ADD CONSTRAINT "PricingConversionEventLink_analyticsEventId_fkey"
FOREIGN KEY ("analyticsEventId") REFERENCES "AnalyticsEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
