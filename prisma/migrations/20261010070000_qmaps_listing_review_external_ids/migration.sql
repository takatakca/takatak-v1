-- QMAPS -> TAKATAK local listings and reviews synchronization.
-- Additive only: nullable provider-side identifiers so QMAPS businesses and
-- reviews map to exactly one TAKATAK row per provider (idempotent upserts).
-- Existing rows keep NULL; PostgreSQL unique indexes allow many NULLs.

ALTER TABLE "local_listings" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "listing_reviews" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "local_listings_provider_externalId_key"
  ON "local_listings"("provider", "externalId");

CREATE UNIQUE INDEX IF NOT EXISTS "listing_reviews_provider_externalId_key"
  ON "listing_reviews"("provider", "externalId");
