-- Persistent encrypted storage required by the AT Protocol OAuth client.
-- DPoP keys, OAuth state, access tokens, and refresh tokens remain encrypted.

CREATE TABLE "bluesky_oauth_store" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "storeKey" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bluesky_oauth_store_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "bluesky_oauth_store_kind_check"
        CHECK ("kind" IN ('state', 'session'))
);

CREATE UNIQUE INDEX "bluesky_oauth_store_scope_key"
ON "bluesky_oauth_store"(
    "connectionId",
    "kind",
    "storeKey"
);

CREATE INDEX "bluesky_oauth_store_clientId_idx"
ON "bluesky_oauth_store"("clientId");

CREATE INDEX "bluesky_oauth_store_connectionId_kind_idx"
ON "bluesky_oauth_store"("connectionId", "kind");

CREATE INDEX "bluesky_oauth_store_kind_storeKey_idx"
ON "bluesky_oauth_store"("kind", "storeKey");

CREATE INDEX "bluesky_oauth_store_expiresAt_idx"
ON "bluesky_oauth_store"("expiresAt");

ALTER TABLE "bluesky_oauth_store"
ADD CONSTRAINT "bluesky_oauth_store_connection_client_fkey"
FOREIGN KEY ("connectionId", "clientId")
REFERENCES "social_provider_connections"("id", "clientId")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Defense in depth for Supabase's browser-facing API roles.
ALTER TABLE public.bluesky_oauth_store
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.bluesky_oauth_store
FROM anon;

REVOKE ALL ON TABLE public.bluesky_oauth_store
FROM authenticated;
