-- CreateTable
CREATE TABLE "RentalEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rentalOrderId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "photoUrl" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalEvidence_organizationId_rentalOrderId_occurredAt_idx" ON "RentalEvidence"("organizationId", "rentalOrderId", "occurredAt");

-- AddForeignKey
ALTER TABLE "RentalEvidence" ADD CONSTRAINT "RentalEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalEvidence" ADD CONSTRAINT "RentalEvidence_rentalOrderId_fkey" FOREIGN KEY ("rentalOrderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalEvidence" ADD CONSTRAINT "RentalEvidence_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

