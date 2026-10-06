-- GROUPE TAKATAK Billing — ecosystem invoice request queue.
-- Every TAKATAK app feeds invoice requests here. A platform OWNER submits a
-- request to the independent Facturations service, which creates a DRAFT
-- only (no issuance, Wave write, email, publication or payment).
-- Server-side Prisma access only; the Supabase Data API gets no grants.

-- CreateEnum
CREATE TYPE "BillingInvoiceRequestStatus" AS ENUM ('pending', 'submitting', 'submitted', 'failed', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "billing_invoice_requests" (
    "id" UUID NOT NULL,
    "sourceApp" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "clientId" UUID,
    "masterIdentityId" UUID,
    "idempotencyKey" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "draftHash" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "estimatedTotalCents" BIGINT NOT NULL,
    "status" "BillingInvoiceRequestStatus" NOT NULL DEFAULT 'pending',
    "facturationsDraftId" UUID,
    "facturationsTotalCents" BIGINT,
    "submitAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByProfileId" UUID,
    "submittedByProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_invoice_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoice_requests_idempotencyKey_key" ON "billing_invoice_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX "billing_invoice_requests_status_createdAt_idx" ON "billing_invoice_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "billing_invoice_requests_clientId_idx" ON "billing_invoice_requests"("clientId");

-- CreateIndex
CREATE INDEX "billing_invoice_requests_masterIdentityId_idx" ON "billing_invoice_requests"("masterIdentityId");

-- CreateIndex
CREATE INDEX "billing_invoice_requests_createdByProfileId_idx" ON "billing_invoice_requests"("createdByProfileId");

-- CreateIndex
CREATE INDEX "billing_invoice_requests_submittedByProfileId_idx" ON "billing_invoice_requests"("submittedByProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoice_requests_sourceApp_sourceReference_key" ON "billing_invoice_requests"("sourceApp", "sourceReference");

-- AddForeignKey
ALTER TABLE "billing_invoice_requests" ADD CONSTRAINT "billing_invoice_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_requests" ADD CONSTRAINT "billing_invoice_requests_masterIdentityId_fkey" FOREIGN KEY ("masterIdentityId") REFERENCES "master_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_requests" ADD CONSTRAINT "billing_invoice_requests_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_requests" ADD CONSTRAINT "billing_invoice_requests_submittedByProfileId_fkey" FOREIGN KEY ("submittedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Integrity constraints (mirrors src/lib/billing/invoices/*).
ALTER TABLE "billing_invoice_requests"
  ADD CONSTRAINT "billing_invoice_requests_source_app_format"
    CHECK ("sourceApp" ~ '^[a-z][a-z0-9_]{1,39}$'),
  ADD CONSTRAINT "billing_invoice_requests_source_reference_format"
    CHECK ("sourceReference" ~ '^[A-Za-z0-9._:/-]{1,200}$'),
  ADD CONSTRAINT "billing_invoice_requests_idempotency_key_format"
    CHECK ("idempotencyKey" ~ '^[A-Za-z0-9_-]{16,80}$'),
  ADD CONSTRAINT "billing_invoice_requests_draft_hash_format"
    CHECK ("draftHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "billing_invoice_requests_draft_object"
    CHECK (jsonb_typeof("draft") = 'object'),
  ADD CONSTRAINT "billing_invoice_requests_currency_cad"
    CHECK ("currency" = 'CAD'),
  ADD CONSTRAINT "billing_invoice_requests_estimated_total_range"
    CHECK ("estimatedTotalCents" BETWEEN 0 AND 1000000000000),
  ADD CONSTRAINT "billing_invoice_requests_facturations_total_range"
    CHECK ("facturationsTotalCents" IS NULL OR "facturationsTotalCents" BETWEEN 0 AND 1000000000000),
  ADD CONSTRAINT "billing_invoice_requests_submit_attempts_non_negative"
    CHECK ("submitAttempts" >= 0),
  ADD CONSTRAINT "billing_invoice_requests_last_error_code_format"
    CHECK ("lastErrorCode" IS NULL OR "lastErrorCode" ~ '^[A-Za-z0-9_]{1,64}$'),
  ADD CONSTRAINT "billing_invoice_requests_submitted_has_draft"
    CHECK (
      ("status" = 'submitted') = ("facturationsDraftId" IS NOT NULL)
      AND ("status" <> 'submitted' OR "submittedAt" IS NOT NULL)
    ),
  ADD CONSTRAINT "billing_invoice_requests_cancelled_has_timestamp"
    CHECK (("status" = 'cancelled') = ("cancelledAt" IS NOT NULL));

-- The fed draft is immutable: a correction is a new request with a new
-- sourceReference, never an in-place rewrite. A submitted request is final.
CREATE OR REPLACE FUNCTION public.billing_invoice_requests_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'billing_invoice_requests rows cannot be deleted'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."sourceApp" IS DISTINCT FROM OLD."sourceApp"
     OR NEW."sourceReference" IS DISTINCT FROM OLD."sourceReference"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."draft" IS DISTINCT FROM OLD."draft"
     OR NEW."draftHash" IS DISTINCT FROM OLD."draftHash"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."estimatedTotalCents" IS DISTINCT FROM OLD."estimatedTotalCents"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR (NEW."clientId" IS DISTINCT FROM OLD."clientId" AND NEW."clientId" IS NOT NULL)
     OR (NEW."masterIdentityId" IS DISTINCT FROM OLD."masterIdentityId" AND NEW."masterIdentityId" IS NOT NULL)
     OR (NEW."createdByProfileId" IS DISTINCT FROM OLD."createdByProfileId" AND NEW."createdByProfileId" IS NOT NULL)
  THEN
    RAISE EXCEPTION 'billing_invoice_requests fed draft fields are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD."status" IN ('submitted', 'cancelled')
     AND (
       NEW."status" IS DISTINCT FROM OLD."status"
       OR NEW."facturationsDraftId" IS DISTINCT FROM OLD."facturationsDraftId"
       OR NEW."facturationsTotalCents" IS DISTINCT FROM OLD."facturationsTotalCents"
       OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
       OR NEW."cancelledAt" IS DISTINCT FROM OLD."cancelledAt"
     )
  THEN
    RAISE EXCEPTION 'billing_invoice_requests final state cannot change'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "billing_invoice_requests_guard_update"
  BEFORE UPDATE ON "billing_invoice_requests"
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_requests_guard();

CREATE TRIGGER "billing_invoice_requests_guard_delete"
  BEFORE DELETE ON "billing_invoice_requests"
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_requests_guard();

-- Lockdown: Prisma uses the owner/BYPASSRLS path. No Data API grants/policies.
ALTER TABLE public.billing_invoice_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_invoice_requests FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_invoice_requests_guard() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.billing_invoice_requests FROM anon;
    REVOKE ALL ON FUNCTION public.billing_invoice_requests_guard() FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.billing_invoice_requests FROM authenticated;
    REVOKE ALL ON FUNCTION public.billing_invoice_requests_guard() FROM authenticated;
  END IF;
END $$;
