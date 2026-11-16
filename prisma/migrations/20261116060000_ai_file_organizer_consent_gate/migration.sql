-- Follow-up to immutable migration 20261116043000_ai_file_organizer_workspace_policy.
-- Initial migration is already merged into main; NEVER rewrite applied history.
-- Local-only suggestion mode explicitly prohibits external provider processing.
-- No file access, provider calls, billing or existing data mutation beyond this constraint.
ALTER TABLE "organizer_workspace_policies"
  DROP CONSTRAINT IF EXISTS "organizer_workspace_policies_consent_check";
ALTER TABLE "organizer_workspace_policies"
  ADD CONSTRAINT "organizer_workspace_policies_consent_check"
  CHECK (
    "mode" = 'off'
    OR ("consentGranted" AND NOT "providerProcessingConsent" AND "requireApproval")
  );
