CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'triaged', 'in_progress', 'resolved', 'closed');
CREATE TYPE "SupportTicketSeverity" AS ENUM ('p0', 'p1', 'p2', 'p3');

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reporterUserId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
  "severity" "SupportTicketSeverity" NOT NULL DEFAULT 'p2',
  "routePath" TEXT,
  "screenName" TEXT,
  "appVersion" TEXT,
  "correlationId" TEXT,
  "requestId" TEXT,
  "attachments" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicketNote" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicket_organizationId_status_severity_createdAt_idx" ON "SupportTicket"("organizationId", "status", "severity", "createdAt");
CREATE INDEX "SupportTicket_reporterUserId_createdAt_idx" ON "SupportTicket"("reporterUserId", "createdAt");
CREATE INDEX "SupportTicketNote_ticketId_createdAt_idx" ON "SupportTicketNote"("ticketId", "createdAt");

ALTER TABLE "SupportTicket"
ADD CONSTRAINT "SupportTicket_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
ADD CONSTRAINT "SupportTicket_reporterUserId_fkey"
FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicketNote"
ADD CONSTRAINT "SupportTicketNote_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicketNote"
ADD CONSTRAINT "SupportTicketNote_authorUserId_fkey"
FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
