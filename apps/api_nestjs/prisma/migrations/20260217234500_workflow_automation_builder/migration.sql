CREATE TYPE "WorkflowStatus" AS ENUM ('draft', 'published', 'paused', 'stopped');
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "WorkflowConditionOperator" AS ENUM ('AND', 'OR');
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('success', 'skipped', 'blocked', 'failed');

CREATE TABLE "Workflow" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "WorkflowStatus" NOT NULL DEFAULT 'draft',
  "killSwitchEnabled" BOOLEAN NOT NULL DEFAULT false,
  "dryRunEnabled" BOOLEAN NOT NULL DEFAULT false,
  "maxExecutionsPerHour" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowVersion" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'draft',
  "triggerConfig" JSONB NOT NULL,
  "conditionConfig" JSONB NOT NULL,
  "actionConfig" JSONB NOT NULL,
  "activationStartsAt" TIMESTAMP(3),
  "activationEndsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowTrigger" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'api',
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowTrigger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowConditionGroup" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "workflowVersionId" TEXT NOT NULL,
  "parentGroupId" TEXT,
  "operator" "WorkflowConditionOperator" NOT NULL DEFAULT 'AND',
  "definition" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowConditionGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowAction" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "workflowVersionId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowExecutionLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "workflowVersionId" TEXT NOT NULL,
  "triggerEvent" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "status" "WorkflowExecutionStatus" NOT NULL DEFAULT 'success',
  "triggerInput" JSONB NOT NULL,
  "rulePath" JSONB NOT NULL,
  "actionResults" JSONB NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowExecutionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Workflow_organizationId_status_idx" ON "Workflow"("organizationId", "status");
CREATE UNIQUE INDEX "WorkflowVersion_workflowId_versionNumber_key" ON "WorkflowVersion"("workflowId", "versionNumber");
CREATE INDEX "WorkflowVersion_workflowId_status_createdAt_idx" ON "WorkflowVersion"("workflowId", "status", "createdAt");
CREATE INDEX "WorkflowTrigger_workflowId_eventType_isEnabled_idx" ON "WorkflowTrigger"("workflowId", "eventType", "isEnabled");
CREATE INDEX "WorkflowConditionGroup_workflowId_workflowVersionId_parentGroupId_idx" ON "WorkflowConditionGroup"("workflowId", "workflowVersionId", "parentGroupId");
CREATE INDEX "WorkflowAction_workflowId_workflowVersionId_orderIndex_idx" ON "WorkflowAction"("workflowId", "workflowVersionId", "orderIndex");
CREATE INDEX "WorkflowExecutionLog_organizationId_workflowId_entityType_entityId_createdAt_idx" ON "WorkflowExecutionLog"("organizationId", "workflowId", "entityType", "entityId", "createdAt");
CREATE INDEX "WorkflowExecutionLog_workflowId_status_createdAt_idx" ON "WorkflowExecutionLog"("workflowId", "status", "createdAt");

ALTER TABLE "Workflow"
ADD CONSTRAINT "Workflow_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowVersion"
ADD CONSTRAINT "WorkflowVersion_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowTrigger"
ADD CONSTRAINT "WorkflowTrigger_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowConditionGroup"
ADD CONSTRAINT "WorkflowConditionGroup_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowConditionGroup"
ADD CONSTRAINT "WorkflowConditionGroup_workflowVersionId_fkey"
FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowAction"
ADD CONSTRAINT "WorkflowAction_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowAction"
ADD CONSTRAINT "WorkflowAction_workflowVersionId_fkey"
FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowExecutionLog"
ADD CONSTRAINT "WorkflowExecutionLog_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowExecutionLog"
ADD CONSTRAINT "WorkflowExecutionLog_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowExecutionLog"
ADD CONSTRAINT "WorkflowExecutionLog_workflowVersionId_fkey"
FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
