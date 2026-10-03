-- AHMV Parent Premium Google Calendar authorization and event mappings.
-- OAuth credentials are encrypted in application code before persistence.
-- Tables are Prisma-only and denied to the Supabase Data API.

CREATE TABLE "hockey_calendar_connections" (
  "id" UUID NOT NULL,
  "identityId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL DEFAULT 'ahmverdun',
  "provider" TEXT NOT NULL DEFAULT 'google',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "externalAccountId" TEXT,
  "displayName" TEXT,
  "calendarId" TEXT NOT NULL DEFAULT 'primary',
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tokenCiphertext" TEXT,
  "tokenIv" TEXT,
  "tokenAuthTag" TEXT,
  "tokenKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "connectedAt" TIMESTAMP(3),
  "lastValidatedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hockey_calendar_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_calendar_connections_provider_check"
    CHECK ("provider" IN ('google')),
  CONSTRAINT "hockey_calendar_connections_status_check"
    CHECK ("status" IN ('pending','connected','expired','revoked','error'))
);

CREATE TABLE "hockey_calendar_oauth_states" (
  "id" UUID NOT NULL,
  "identityId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL DEFAULT 'ahmverdun',
  "provider" TEXT NOT NULL DEFAULT 'google',
  "stateHash" TEXT NOT NULL,
  "verifierCiphertext" TEXT NOT NULL,
  "verifierIv" TEXT NOT NULL,
  "verifierAuthTag" TEXT NOT NULL,
  "verifierKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "returnPath" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hockey_calendar_oauth_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_calendar_oauth_provider_check"
    CHECK ("provider" IN ('google')),
  CONSTRAINT "hockey_calendar_oauth_status_check"
    CHECK ("status" IN ('pending','processing','completed','cancelled','failed','expired'))
);

CREATE TABLE "hockey_calendar_event_mappings" (
  "id" UUID NOT NULL,
  "connectionId" UUID NOT NULL,
  "teamEventId" UUID NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventRevision" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastSyncedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hockey_calendar_event_mappings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_calendar_event_mappings_status_check"
    CHECK ("status" IN ('active','deleted'))
);

CREATE UNIQUE INDEX "hockey_calendar_connections_identity_source_provider_key"
  ON "hockey_calendar_connections"("identityId","sourceApplication","provider");
CREATE INDEX "hockey_calendar_connections_status_idx"
  ON "hockey_calendar_connections"("status");
CREATE INDEX "hockey_calendar_connections_identity_status_idx"
  ON "hockey_calendar_connections"("identityId","status");

CREATE UNIQUE INDEX "hockey_calendar_oauth_states_state_hash_key"
  ON "hockey_calendar_oauth_states"("stateHash");
CREATE INDEX "hockey_calendar_oauth_states_identity_status_idx"
  ON "hockey_calendar_oauth_states"("identityId","status");
CREATE INDEX "hockey_calendar_oauth_states_expires_idx"
  ON "hockey_calendar_oauth_states"("expiresAt");

CREATE UNIQUE INDEX "hockey_calendar_event_mappings_connection_event_key"
  ON "hockey_calendar_event_mappings"("connectionId","teamEventId");
CREATE INDEX "hockey_calendar_event_mappings_provider_event_idx"
  ON "hockey_calendar_event_mappings"("providerEventId");
CREATE INDEX "hockey_calendar_event_mappings_team_event_idx"
  ON "hockey_calendar_event_mappings"("teamEventId");

ALTER TABLE "hockey_calendar_connections"
  ADD CONSTRAINT "hockey_calendar_connections_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hockey_calendar_oauth_states"
  ADD CONSTRAINT "hockey_calendar_oauth_states_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hockey_calendar_event_mappings"
  ADD CONSTRAINT "hockey_calendar_event_mappings_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "hockey_calendar_connections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hockey_calendar_event_mappings"
  ADD CONSTRAINT "hockey_calendar_event_mappings_teamEventId_fkey"
  FOREIGN KEY ("teamEventId") REFERENCES "hockey_team_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.hockey_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hockey_calendar_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hockey_calendar_event_mappings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hockey_calendar_connections FROM PUBLIC;
REVOKE ALL ON TABLE public.hockey_calendar_oauth_states FROM PUBLIC;
REVOKE ALL ON TABLE public.hockey_calendar_event_mappings FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.hockey_calendar_connections FROM anon;
    REVOKE ALL ON TABLE public.hockey_calendar_oauth_states FROM anon;
    REVOKE ALL ON TABLE public.hockey_calendar_event_mappings FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.hockey_calendar_connections FROM authenticated;
    REVOKE ALL ON TABLE public.hockey_calendar_oauth_states FROM authenticated;
    REVOKE ALL ON TABLE public.hockey_calendar_event_mappings FROM authenticated;
  END IF;
END $$;
