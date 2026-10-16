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
REVOKE ALL ON TABLE "knowledgeai_workspace_grants" FROM PUBLIC;
