-- AI File Organizer manual proposal ledger: metadata only; source bytes remain unchanged.
-- Apply only after approved backups and the workspace-policy migrations.
CREATE TABLE "organizer_filing_proposals" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "requestId" TEXT NOT NULL,
  "sourceOutputId" UUID NOT NULL,
  "destinationProjectId" UUID NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "policyRevision" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "requestedBy" UUID NOT NULL,
  "reviewedBy" UUID,
  "reviewedAt" TIMESTAMP(3),
  "undoneAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organizer_filing_proposals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organizer_filing_proposals_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organizer_filing_proposals_status_check"
    CHECK ("status" IN ('pending','approved','rejected','undone')),
  CONSTRAINT "organizer_filing_proposals_revision_check" CHECK ("revision" >= 1 AND "policyRevision" >= 1),
  CONSTRAINT "organizer_filing_proposals_requestId_check"
    CHECK ("requestId" ~ '^[A-Za-z0-9_-]{16,64}$'),
  CONSTRAINT "organizer_filing_proposals_different_ids_check"
    CHECK ("sourceOutputId" <> "destinationProjectId"),
  CONSTRAINT "organizer_filing_proposals_finalized_check"
    CHECK (("status" = 'pending' AND "reviewedBy" IS NULL AND "reviewedAt" IS NULL AND "undoneAt" IS NULL)
      OR ("status" IN ('approved', 'rejected') AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "undoneAt" IS NULL)
      OR ("status" = 'undone' AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "undoneAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "organizer_filing_proposals_clientId_requestId_key"
  ON "organizer_filing_proposals"("clientId", "requestId");
CREATE UNIQUE INDEX "organizer_filing_proposals_clientId_sourceOutputId_destinationProjectId_key"
  ON "organizer_filing_proposals"("clientId", "sourceOutputId", "destinationProjectId");
CREATE INDEX "organizer_filing_proposals_clientId_status_createdAt_idx"
  ON "organizer_filing_proposals"("clientId", "status", "createdAt");
CREATE INDEX "organizer_filing_proposals_clientId_sourceOutputId_idx"
  ON "organizer_filing_proposals"("clientId", "sourceOutputId");
-- Only one active metadata assignment for a given source output.
CREATE UNIQUE INDEX "organizer_filing_proposals_active_assignment_one_per_source"
  ON "organizer_filing_proposals"("clientId", "sourceOutputId") WHERE "status" = 'approved';

ALTER TABLE "organizer_filing_proposals" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "organizer_filing_proposals" FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "organizer_filing_proposals" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
