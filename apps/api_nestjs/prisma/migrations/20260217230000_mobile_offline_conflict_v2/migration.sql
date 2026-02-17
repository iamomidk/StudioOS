CREATE TYPE "MobileSyncState" AS ENUM ('pending', 'synced', 'conflict', 'manual_review', 'failed');

CREATE TABLE "RentalSyncDiagnostic" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "rentalOrderId" TEXT NOT NULL,
  "deviceSessionId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "syncState" "MobileSyncState" NOT NULL DEFAULT 'pending',
  "payloadHash" TEXT NOT NULL,
  "baseVersion" TEXT,
  "serverVersion" TEXT,
  "conflictingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "lastActorUserId" TEXT,
  "lastUpdatedAt" TIMESTAMP(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalSyncDiagnostic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RentalSyncDiagnostic_operationId_key" ON "RentalSyncDiagnostic"("operationId");
CREATE INDEX "RentalSyncDiagnostic_organizationId_deviceSessionId_updatedAt_idx" ON "RentalSyncDiagnostic"("organizationId", "deviceSessionId", "updatedAt");
CREATE INDEX "RentalSyncDiagnostic_organizationId_syncState_updatedAt_idx" ON "RentalSyncDiagnostic"("organizationId", "syncState", "updatedAt");

ALTER TABLE "RentalSyncDiagnostic"
ADD CONSTRAINT "RentalSyncDiagnostic_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RentalSyncDiagnostic"
ADD CONSTRAINT "RentalSyncDiagnostic_rentalOrderId_fkey"
FOREIGN KEY ("rentalOrderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RentalSyncDiagnostic"
ADD CONSTRAINT "RentalSyncDiagnostic_lastActorUserId_fkey"
FOREIGN KEY ("lastActorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
