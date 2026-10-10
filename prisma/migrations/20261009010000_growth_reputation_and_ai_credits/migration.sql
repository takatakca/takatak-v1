-- Growth Suite: reputation review funnel and AI credit ledger.
-- Public review pages write through server-side Prisma only.
-- No raw IP addresses are stored; customer contact fields are optional and
-- only kept when the customer types them in. Credits are debited atomically
-- by the server with an idempotency key per debit.

-- CreateEnum
CREATE TYPE "ReviewChannel" AS ENUM ('link', 'qr', 'sms', 'whatsapp', 'email');

-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('created', 'opened', 'rated');

-- CreateEnum
CREATE TYPE "ReviewFeedbackStatus" AS ENUM ('new', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "AiCreditReason" AS ENUM ('purchase', 'grant', 'debit', 'refund', 'adjustment');

ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'view_reputation';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'manage_reputation';

-- CreateTable
CREATE TABLE "review_profiles" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "name" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "googlePlaceId" TEXT,
    "facebookReviewUrl" TEXT,
    "thankYouMessage" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_requests" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "channel" "ReviewChannel" NOT NULL DEFAULT 'link',
    "recipientName" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "ReviewRequestStatus" NOT NULL DEFAULT 'created',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "ratedAt" TIMESTAMP(3),
    "createdByProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_responses" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "requestId" UUID,
    "rating" SMALLINT NOT NULL,
    "feedback" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "followUpConsent" BOOLEAN NOT NULL DEFAULT false,
    "publicLinkClickedAt" TIMESTAMP(3),
    "status" "ReviewFeedbackStatus" NOT NULL DEFAULT 'new',
    "resolvedAt" TIMESTAMP(3),
    "resolvedByProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_credit_accounts" (
    "clientId" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_credit_accounts_pkey" PRIMARY KEY ("clientId")
);

-- CreateTable
CREATE TABLE "ai_credit_entries" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" "AiCreditReason" NOT NULL,
    "actionKey" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "actorProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_profiles_publicSlug_key" ON "review_profiles"("publicSlug");

-- CreateIndex
CREATE INDEX "review_profiles_clientId_idx" ON "review_profiles"("clientId");

-- CreateIndex
CREATE INDEX "review_profiles_businessBrandId_idx" ON "review_profiles"("businessBrandId");

-- CreateIndex
CREATE UNIQUE INDEX "review_requests_tokenHash_key" ON "review_requests"("tokenHash");

-- CreateIndex
CREATE INDEX "review_requests_clientId_createdAt_idx" ON "review_requests"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "review_requests_profileId_createdAt_idx" ON "review_requests"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_responses_requestId_key" ON "review_responses"("requestId");

-- CreateIndex
CREATE INDEX "review_responses_clientId_createdAt_idx" ON "review_responses"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "review_responses_profileId_createdAt_idx" ON "review_responses"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "review_responses_clientId_status_idx" ON "review_responses"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_credit_entries_idempotencyKey_key" ON "ai_credit_entries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ai_credit_entries_clientId_createdAt_idx" ON "ai_credit_entries"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "review_profiles" ADD CONSTRAINT "review_profiles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_profiles" ADD CONSTRAINT "review_profiles_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "review_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "review_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "review_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_credit_accounts" ADD CONSTRAINT "ai_credit_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_credit_entries" ADD CONSTRAINT "ai_credit_entries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integrity guards.
ALTER TABLE "review_responses"
  ADD CONSTRAINT "review_responses_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "ai_credit_accounts"
  ADD CONSTRAINT "ai_credit_accounts_balance_nonnegative" CHECK ("balance" >= 0);
ALTER TABLE "ai_credit_entries"
  ADD CONSTRAINT "ai_credit_entries_balance_after_nonnegative" CHECK ("balanceAfter" >= 0);
ALTER TABLE "ai_credit_entries"
  ADD CONSTRAINT "ai_credit_entries_delta_nonzero" CHECK ("delta" <> 0);

-- Prisma server access only. No PostgREST client policies are installed.
ALTER TABLE "review_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_credit_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_credit_entries" ENABLE ROW LEVEL SECURITY;

-- Defense in depth: no Data API grants for browser roles on these tables.
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "review_profiles", "review_requests", "review_responses", "ai_credit_accounts", "ai_credit_entries" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
