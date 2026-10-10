-- Growth Suite: Google Business Profile per-client OAuth, locations and
-- imported reviews. Tokens and PKCE verifiers are stored encrypted only.

-- CreateTable
CREATE TABLE "google_business_connections" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tokenCiphertext" TEXT NOT NULL,
    "tokenIv" TEXT NOT NULL,
    "tokenAuthTag" TEXT NOT NULL,
    "tokenKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "connectedByProfileId" UUID,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_business_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_business_oauth_states" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "stateHash" TEXT NOT NULL,
    "verifierCiphertext" TEXT NOT NULL,
    "verifierIv" TEXT NOT NULL,
    "verifierAuthTag" TEXT NOT NULL,
    "verifierKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_business_oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_business_locations" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "resourceName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT,
    "reviewProfileId" UUID,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_business_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_reviews" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'google',
    "externalId" TEXT NOT NULL,
    "reviewerName" TEXT,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "externalCreateAt" TIMESTAMP(3) NOT NULL,
    "externalUpdateAt" TIMESTAMP(3) NOT NULL,
    "replyComment" TEXT,
    "replyUpdatedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_business_connections_clientId_key" ON "google_business_connections"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "google_business_oauth_states_stateHash_key" ON "google_business_oauth_states"("stateHash");

-- CreateIndex
CREATE INDEX "google_business_oauth_states_clientId_createdAt_idx" ON "google_business_oauth_states"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "google_business_locations_connectionId_idx" ON "google_business_locations"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "google_business_locations_clientId_resourceName_key" ON "google_business_locations"("clientId", "resourceName");

-- CreateIndex
CREATE INDEX "external_reviews_clientId_externalCreateAt_idx" ON "external_reviews"("clientId", "externalCreateAt");

-- CreateIndex
CREATE UNIQUE INDEX "external_reviews_locationId_externalId_key" ON "external_reviews"("locationId", "externalId");

-- AddForeignKey
ALTER TABLE "google_business_connections" ADD CONSTRAINT "google_business_connections_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_business_oauth_states" ADD CONSTRAINT "google_business_oauth_states_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_business_locations" ADD CONSTRAINT "google_business_locations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_business_locations" ADD CONSTRAINT "google_business_locations_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "google_business_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_reviews" ADD CONSTRAINT "external_reviews_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_reviews" ADD CONSTRAINT "external_reviews_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "google_business_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Integrity guards.
ALTER TABLE "google_business_connections"
  ADD CONSTRAINT "google_business_connections_status_values" CHECK ("status" IN ('active', 'error', 'revoked'));
ALTER TABLE "external_reviews"
  ADD CONSTRAINT "external_reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "external_reviews"
  ADD CONSTRAINT "external_reviews_source_values" CHECK ("source" IN ('google'));

-- Prisma server access only. No PostgREST client policies are installed.
ALTER TABLE "google_business_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "google_business_oauth_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "google_business_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_reviews" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "google_business_connections", "google_business_oauth_states", "google_business_locations", "external_reviews" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
