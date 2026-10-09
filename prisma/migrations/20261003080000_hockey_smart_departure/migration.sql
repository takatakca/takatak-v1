-- AHMV Parent Premium smart-departure origin.
-- Exact coordinates are AES-GCM encrypted by the application before storage.
-- No route/location history is kept here.

CREATE TABLE "hockey_travel_profiles" (
  "id" UUID NOT NULL,
  "identityId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL DEFAULT 'ahmverdun',
  "status" TEXT NOT NULL DEFAULT 'active',
  "originLabel" TEXT,
  "originCiphertext" TEXT NOT NULL,
  "originIv" TEXT NOT NULL,
  "originAuthTag" TEXT NOT NULL,
  "originKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "departureConsentAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hockey_travel_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_travel_profiles_status_check"
    CHECK ("status" IN ('active','disabled'))
);

CREATE UNIQUE INDEX "hockey_travel_profiles_identity_source_key"
  ON "hockey_travel_profiles"("identityId","sourceApplication");

CREATE INDEX "hockey_travel_profiles_status_idx"
  ON "hockey_travel_profiles"("status");

CREATE INDEX "hockey_travel_profiles_identity_status_idx"
  ON "hockey_travel_profiles"("identityId","status");

ALTER TABLE "hockey_travel_profiles"
  ADD CONSTRAINT "hockey_travel_profiles_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.hockey_travel_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hockey_travel_profiles FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.hockey_travel_profiles FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.hockey_travel_profiles FROM authenticated;
  END IF;
END $$;
