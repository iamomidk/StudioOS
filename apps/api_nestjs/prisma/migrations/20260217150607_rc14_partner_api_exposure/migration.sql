-- CreateEnum
CREATE TYPE "PartnerCredentialStatus" AS ENUM ('active', 'suspended', 'revoked');

-- CreateTable
CREATE TABLE "PartnerApiCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" "PartnerCredentialStatus" NOT NULL DEFAULT 'active',
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 120,
    "dailyQuota" INTEGER NOT NULL DEFAULT 10000,
    "requestSigningRequired" BOOLEAN NOT NULL DEFAULT false,
    "signingSecret" TEXT,
    "rotatedFromId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerApiRequestLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerApiIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerApiIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerApiCredential_keyId_key" ON "PartnerApiCredential"("keyId");

-- CreateIndex
CREATE INDEX "PartnerApiCredential_organizationId_status_idx" ON "PartnerApiCredential"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PartnerApiRequestLog_credentialId_createdAt_idx" ON "PartnerApiRequestLog"("credentialId", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerApiRequestLog_organizationId_createdAt_idx" ON "PartnerApiRequestLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerApiIdempotencyRecord_organizationId_createdAt_idx" ON "PartnerApiIdempotencyRecord"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerApiIdempotencyRecord_credentialId_method_path_idempo_key" ON "PartnerApiIdempotencyRecord"("credentialId", "method", "path", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "PartnerApiCredential" ADD CONSTRAINT "PartnerApiCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerApiRequestLog" ADD CONSTRAINT "PartnerApiRequestLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerApiRequestLog" ADD CONSTRAINT "PartnerApiRequestLog_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "PartnerApiCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerApiIdempotencyRecord" ADD CONSTRAINT "PartnerApiIdempotencyRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerApiIdempotencyRecord" ADD CONSTRAINT "PartnerApiIdempotencyRecord_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "PartnerApiCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
