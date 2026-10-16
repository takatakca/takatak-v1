-- TAKATAK central KnowledgeAI authorization, not a second user identity store.
-- No user gets access upon migration. Product starts non-active.
INSERT INTO "product_catalog" ("id","code","name","status","createdAt","updatedAt")
VALUES (gen_random_uuid(),'knowledgeai','KnowledgeAI','planned',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE "knowledgeai_grants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "clientId" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "allowRead" BOOLEAN NOT NULL DEFAULT false,
  "allowWrite" BOOLEAN NOT NULL DEFAULT false,
  "allowDelete" BOOLEAN NOT NULL DEFAULT false,
  "allowExport" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledgeai_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledgeai_grants_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "knowledgeai_grants_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "knowledgeai_grants_clientId_profileId_key"
  ON "knowledgeai_grants" ("clientId","profileId");
CREATE INDEX "knowledgeai_grants_clientId_enabled_idx"
  ON "knowledgeai_grants" ("clientId","enabled");

-- Superuser/owner provisioning only. Public, anon and authenticated JWT
-- PostgREST roles cannot read/alter scopes even with direct database calls.
ALTER TABLE "knowledgeai_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledgeai_grants" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "knowledgeai_grants" FROM PUBLIC;
-- These roles are already part of the existing TAKATAK RLS model.
REVOKE ALL ON TABLE "knowledgeai_grants" FROM anon;
REVOKE ALL ON TABLE "knowledgeai_grants" FROM authenticated;
