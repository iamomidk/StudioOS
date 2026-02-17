ALTER TABLE "Organization"
ADD COLUMN "pilotOrg" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pilotCohortId" TEXT;

CREATE TABLE "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "payload" JSONB,
  "idempotencyKey" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "pilotOrg" BOOLEAN NOT NULL DEFAULT false,
  "pilotCohortId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsEvent_idempotencyKey_key" ON "AnalyticsEvent"("idempotencyKey");
CREATE INDEX "AnalyticsEvent_organizationId_eventName_occurredAt_idx" ON "AnalyticsEvent"("organizationId", "eventName", "occurredAt");
CREATE INDEX "AnalyticsEvent_pilotOrg_pilotCohortId_occurredAt_idx" ON "AnalyticsEvent"("pilotOrg", "pilotCohortId", "occurredAt");

ALTER TABLE "AnalyticsEvent"
ADD CONSTRAINT "AnalyticsEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
