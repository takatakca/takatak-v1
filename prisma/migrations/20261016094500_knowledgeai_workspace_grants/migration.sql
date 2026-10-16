-- TAKATAK is the sole product/workspace authority. No grants are seeded.
CREATE TABLE IF NOT EXISTS "knowledgeai_workspace_grants" (
  "client_id" UUID NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "profile_id" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "allow_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "allow_write" BOOLEAN NOT NULL DEFAULT FALSE,
  "allow_delete" BOOLEAN NOT NULL DEFAULT FALSE,
  "allow_export" BOOLEAN NOT NULL DEFAULT FALSE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "approved_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("client_id", "profile_id")
);
CREATE INDEX IF NOT EXISTS "knowledgeai_workspace_grants_expires_at_idx"
  ON "knowledgeai_workspace_grants"("expires_at");
-- Never expose these grants through the browser-facing PostgREST roles.
ALTER TABLE "knowledgeai_workspace_grants" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "knowledgeai_workspace_grants" FROM PUBLIC;
DO $permissions$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON TABLE "knowledgeai_workspace_grants" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON TABLE "knowledgeai_workspace_grants" FROM authenticated;
  END IF;
END;
$permissions$;
