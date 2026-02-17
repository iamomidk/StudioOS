CREATE TYPE "SlaBreachState" AS ENUM ('healthy', 'at_risk', 'breached', 'recovered');

CREATE TABLE "SupportTicketSla" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "businessHoursOnly" BOOLEAN NOT NULL DEFAULT false,
  "firstResponseTargetMinutes" INTEGER NOT NULL,
  "resolutionTargetMinutes" INTEGER NOT NULL,
  "clockStartedAt" TIMESTAMP(3) NOT NULL,
  "firstResponseDueAt" TIMESTAMP(3) NOT NULL,
  "resolutionDueAt" TIMESTAMP(3) NOT NULL,
  "firstResponseAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "firstResponseBreachedAt" TIMESTAMP(3),
  "resolutionBreachedAt" TIMESTAMP(3),
  "state" "SlaBreachState" NOT NULL DEFAULT 'healthy',
  "pausedAt" TIMESTAMP(3),
  "totalPausedSeconds" INTEGER NOT NULL DEFAULT 0,
  "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicketSla_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportTicketSla_ticketId_key" ON "SupportTicketSla"("ticketId");
CREATE INDEX "SupportTicketSla_state_lastEvaluatedAt_idx" ON "SupportTicketSla"("state", "lastEvaluatedAt");
CREATE INDEX "SupportTicketSla_clockStartedAt_resolutionDueAt_idx" ON "SupportTicketSla"("clockStartedAt", "resolutionDueAt");

ALTER TABLE "SupportTicketSla"
ADD CONSTRAINT "SupportTicketSla_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
