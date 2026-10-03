-- Parent Premium saved departure origin.
-- Stores one explicitly consented address only; no location history.

CREATE TABLE "hockey_travel_profiles" (
  "id" UUID NOT NULL,
  "identityId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL DEFAULT 'ahmverdun',
  "provider" TEXT NOT NULL DEFAULT 'google_routes',
  "originLabel" TEXT,
  "originAddress" TEXT NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hockey_travel_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_travel_profiles_provider_check"
    CHECK ("provider" IN ('google_routes')),
  CONSTRAINT "hockey_travel_profiles_origin_length_check"
    CHECK (char_length("originAddress") BETWEEN 5 AND 320)
);

CREATE UNIQUE INDEX "hockey_travel_profiles_identity_source_key"
  ON "hockey_travel_profiles"("identityId","sourceApplication");
CREATE INDEX "hockey_travel_profiles_identity_idx"
  ON "hockey_travel_profiles"("identityId");

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
