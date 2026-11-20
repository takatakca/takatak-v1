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

-- Harden privileged caller mistakes: source and destination must both
-- exist in this client workspace, with exact Studio source kinds.
-- SECURITY INVOKER (default), never SECURITY DEFINER or client-controlled schema.
CREATE FUNCTION public.check_organizer_filing_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.saved_ai_outputs src
    WHERE src."id" = NEW."sourceOutputId"
      AND src."clientId" = NEW."clientId"
      AND src."origin" = 'ai_generated'
      AND src."status" IN ('draft','saved','sent_to_approval')
      AND src."metadata"->>'source' = 'takatakstudio_output'
      AND src."updatedAt" = NEW."sourceUpdatedAt"
  ) THEN
    RAISE EXCEPTION 'organizer_source_scope_failed' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.saved_ai_outputs dst
    WHERE dst."id" = NEW."destinationProjectId"
      AND dst."clientId" = NEW."clientId"
      AND dst."status" <> 'archived'
      AND dst."metadata"->>'source' = 'takatakstudio_project'
  ) THEN
    RAISE EXCEPTION 'organizer_destination_scope_failed' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organizer_workspace_policies pol
    WHERE pol."clientId" = NEW."clientId"
      AND pol."revision" = NEW."policyRevision"
      AND pol."mode" = 'suggest'
      AND pol."consentGranted" = TRUE
      AND pol."providerProcessingConsent" = FALSE
      AND pol."requireApproval" = TRUE
      AND pol."allowedDestinationIds" ? NEW."destinationProjectId"::text
      AND pol."allowedSourceKinds" ? 'studio'
  ) THEN
    RAISE EXCEPTION 'organizer_policy_scope_failed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.check_organizer_filing_ownership() FROM PUBLIC;
CREATE TRIGGER check_organizer_filing_ownership
BEFORE INSERT OR UPDATE OF "clientId", "sourceOutputId", "destinationProjectId",
  "sourceUpdatedAt", "policyRevision"
ON public.organizer_filing_proposals
FOR EACH ROW EXECUTE FUNCTION public.check_organizer_filing_ownership();
