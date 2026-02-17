-- CreateEnum
CREATE TYPE "ClientApprovalState" AS ENUM ('pending', 'approved', 'changes_requested');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "clientApprovalState" "ClientApprovalState" NOT NULL DEFAULT 'pending',
ADD COLUMN     "clientApprovedAt" TIMESTAMP(3),
ADD COLUMN     "lastRevisionComment" TEXT,
ADD COLUMN     "revisionCount" INTEGER NOT NULL DEFAULT 0;

