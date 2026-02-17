-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "enterpriseScimEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ipAllowlist" TEXT[],
ADD COLUMN     "mfaEnforced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retentionDays" INTEGER NOT NULL DEFAULT 365,
ADD COLUMN     "sessionDurationMinutes" INTEGER NOT NULL DEFAULT 10080,
ADD COLUMN     "ssoDomains" TEXT[],
ADD COLUMN     "ssoEnforced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ssoProvider" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ComplianceExportRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "exportType" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceExportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterprisePurgeRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "approvalReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "EnterprisePurgeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceExportRecord_organizationId_exportType_createdAt_idx" ON "ComplianceExportRecord"("organizationId", "exportType", "createdAt");

-- CreateIndex
CREATE INDEX "EnterprisePurgeRequest_organizationId_status_requestedAt_idx" ON "EnterprisePurgeRequest"("organizationId", "status", "requestedAt");

-- AddForeignKey
ALTER TABLE "ComplianceExportRecord" ADD CONSTRAINT "ComplianceExportRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceExportRecord" ADD CONSTRAINT "ComplianceExportRecord_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterprisePurgeRequest" ADD CONSTRAINT "EnterprisePurgeRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterprisePurgeRequest" ADD CONSTRAINT "EnterprisePurgeRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterprisePurgeRequest" ADD CONSTRAINT "EnterprisePurgeRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterprisePurgeRequest" ADD CONSTRAINT "EnterprisePurgeRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
