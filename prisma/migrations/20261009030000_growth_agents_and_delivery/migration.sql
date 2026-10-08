-- Growth Suite: AI agent run queue and review-request delivery tracking.
-- Delivery stores only a masked recipient (last digits) and the provider
-- message id; full phone numbers are never persisted.

-- CreateEnum
CREATE TYPE "AiAgentRunStatus" AS ENUM ('queued', 'running', 'awaiting_approval', 'approved', 'executing', 'completed', 'rejected', 'failed', 'canceled');

-- AlterTable
ALTER TABLE "review_requests" ADD COLUMN     "deliveryStatus" TEXT,
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "recipientMasked" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ai_agent_settings" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "agentKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_agent_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent_runs" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "agentKey" TEXT NOT NULL,
    "status" "AiAgentRunStatus" NOT NULL DEFAULT 'queued',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "input" JSONB,
    "output" JSONB,
    "creditsDebited" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "requestedByProfileId" UUID,
    "decidedByProfileId" UUID,
    "claimedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_agent_settings_clientId_agentKey_key" ON "ai_agent_settings"("clientId", "agentKey");

-- CreateIndex
CREATE INDEX "ai_agent_runs_clientId_createdAt_idx" ON "ai_agent_runs"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_agent_runs_status_createdAt_idx" ON "ai_agent_runs"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_agent_settings" ADD CONSTRAINT "ai_agent_settings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent_runs" ADD CONSTRAINT "ai_agent_runs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integrity guards.
ALTER TABLE "ai_agent_runs"
  ADD CONSTRAINT "ai_agent_runs_credits_nonnegative" CHECK ("creditsDebited" >= 0);
ALTER TABLE "ai_agent_settings"
  ADD CONSTRAINT "ai_agent_settings_key_format" CHECK ("agentKey" ~ '^[a-z0-9_]{2,64}$');
ALTER TABLE "ai_agent_runs"
  ADD CONSTRAINT "ai_agent_runs_key_format" CHECK ("agentKey" ~ '^[a-z0-9_]{2,64}$');

-- Prisma server access only. No PostgREST client policies are installed.
ALTER TABLE "ai_agent_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_agent_runs" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "ai_agent_settings", "ai_agent_runs" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
