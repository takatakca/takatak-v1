-- AI provider keys entered in Admin › AI provider keys.
-- One row per provider. The key is stored encrypted (AES-256-GCM, versioned
-- key, provider bound as additional data); only its last four characters are
-- kept in clear. Server-side Prisma access only: RLS on, no browser grants.

-- CreateTable
CREATE TABLE "ai_provider_credentials" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "keyHint" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "lastCheckOutcome" TEXT,
    "createdByProfileId" UUID,
    "updatedByProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_credentials_provider_key" ON "ai_provider_credentials"("provider");

-- Integrity guards.
ALTER TABLE "ai_provider_credentials"
  ADD CONSTRAINT "ai_provider_credentials_provider_format" CHECK ("provider" ~ '^[a-z0-9_]{2,40}$');
ALTER TABLE "ai_provider_credentials"
  ADD CONSTRAINT "ai_provider_credentials_key_hint_length" CHECK (char_length("keyHint") <= 4);
ALTER TABLE "ai_provider_credentials"
  ADD CONSTRAINT "ai_provider_credentials_check_outcome" CHECK (
    "lastCheckOutcome" IS NULL
    OR "lastCheckOutcome" IN ('verified', 'rejected', 'rate_limited', 'provider_error', 'network_error')
  );

-- Prisma server access only. No PostgREST client policies are installed.
ALTER TABLE "ai_provider_credentials" ENABLE ROW LEVEL SECURITY;

-- Defense in depth: no Data API grants for browser roles on this table.
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "ai_provider_credentials" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
