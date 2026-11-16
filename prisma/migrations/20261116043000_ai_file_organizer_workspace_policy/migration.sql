-- TAKATAK AI File Organizer workspace settings, default OFF.
-- No file migration, external AI dispatch, Stripe charges or user grants.
CREATE TABLE "organizer_workspace_policies" (
  "clientId" UUID NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'off',
  "consentGranted" BOOLEAN NOT NULL DEFAULT FALSE,
  "providerProcessingConsent" BOOLEAN NOT NULL DEFAULT FALSE,
  "allowedSourceKinds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "allowedDestinationIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "minimumConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
  "requireApproval" BOOLEAN NOT NULL DEFAULT TRUE,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organizer_workspace_policies_pkey" PRIMARY KEY ("clientId"),
  CONSTRAINT "organizer_workspace_policies_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organizer_workspace_policies_mode_check" CHECK ("mode" IN ('off','suggest','auto')),
  CONSTRAINT "organizer_workspace_policies_consent_check"
    CHECK ("mode" = 'off' OR ("consentGranted" AND NOT "providerProcessingConsent" AND "requireApproval")),
  CONSTRAINT "organizer_workspace_policies_confidence_check"
    CHECK ("minimumConfidence" BETWEEN 0 AND 1),
  CONSTRAINT "organizer_workspace_policies_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "organizer_workspace_policies_sources_json_check"
    CHECK (jsonb_typeof("allowedSourceKinds") = 'array'),
  CONSTRAINT "organizer_workspace_policies_destinations_json_check"
    CHECK (jsonb_typeof("allowedDestinationIds") = 'array')
);
-- All customer access is through authenticated TAKATAK server APIs.
-- Do not grant direct PostgREST access to unscoped workspace policy data.
ALTER TABLE "organizer_workspace_policies" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "organizer_workspace_policies" FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "organizer_workspace_policies" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
