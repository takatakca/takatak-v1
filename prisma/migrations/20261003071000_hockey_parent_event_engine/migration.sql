-- Normalized AHMV team-event projection and delivery queue.
-- No roster/player data belongs in these tables.

CREATE TABLE "hockey_team_events" (
  "id" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL DEFAULT 'ahmverdun',
  "sourceEventId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
  "arenaName" TEXT,
  "arenaAddress" TEXT,
  "arenaLatitude" DOUBLE PRECISION,
  "arenaLongitude" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'confirmed',
  "sourceUrl" TEXT,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hockey_team_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_team_events_status_check"
    CHECK ("status" IN ('confirmed', 'modified', 'cancelled')),
  CONSTRAINT "hockey_team_events_type_check"
    CHECK ("eventType" IN ('game', 'practice', 'tournament', 'tryout', 'event', 'other')),
  CONSTRAINT "hockey_team_events_lat_check"
    CHECK ("arenaLatitude" IS NULL OR ("arenaLatitude" >= -90 AND "arenaLatitude" <= 90)),
  CONSTRAINT "hockey_team_events_lng_check"
    CHECK ("arenaLongitude" IS NULL OR ("arenaLongitude" >= -180 AND "arenaLongitude" <= 180))
);

CREATE TABLE "hockey_delivery_jobs" (
  "id" UUID NOT NULL,
  "identityId" UUID NOT NULL,
  "teamEventId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "eventRevision" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lockedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hockey_delivery_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_delivery_jobs_kind_check"
    CHECK ("kind" IN ('calendar_sync', 'sms_reminder', 'sms_event_change', 'departure_alert')),
  CONSTRAINT "hockey_delivery_jobs_status_check"
    CHECK ("status" IN ('queued', 'processing', 'completed', 'failed', 'skipped')),
  CONSTRAINT "hockey_delivery_jobs_attempt_check"
    CHECK ("attemptCount" >= 0 AND "attemptCount" <= 50)
);

CREATE UNIQUE INDEX "hockey_team_events_source_event_key"
  ON "hockey_team_events"("sourceApplication", "sourceEventId");
CREATE INDEX "hockey_team_events_source_team_starts_idx"
  ON "hockey_team_events"("sourceApplication", "teamId", "startsAt");
CREATE INDEX "hockey_team_events_starts_status_idx"
  ON "hockey_team_events"("startsAt", "status");

CREATE UNIQUE INDEX "hockey_delivery_jobs_dedupe_key"
  ON "hockey_delivery_jobs"("dedupeKey");
CREATE INDEX "hockey_delivery_jobs_status_scheduled_idx"
  ON "hockey_delivery_jobs"("status", "scheduledAt");
CREATE INDEX "hockey_delivery_jobs_identity_status_idx"
  ON "hockey_delivery_jobs"("identityId", "status");
CREATE INDEX "hockey_delivery_jobs_event_kind_idx"
  ON "hockey_delivery_jobs"("teamEventId", "kind");

ALTER TABLE "hockey_delivery_jobs"
  ADD CONSTRAINT "hockey_delivery_jobs_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hockey_delivery_jobs"
  ADD CONSTRAINT "hockey_delivery_jobs_teamEventId_fkey"
  FOREIGN KEY ("teamEventId") REFERENCES "hockey_team_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.hockey_team_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hockey_delivery_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hockey_team_events FROM PUBLIC;
REVOKE ALL ON TABLE public.hockey_delivery_jobs FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.hockey_team_events FROM anon;
    REVOKE ALL ON TABLE public.hockey_delivery_jobs FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.hockey_team_events FROM authenticated;
    REVOKE ALL ON TABLE public.hockey_delivery_jobs FROM authenticated;
  END IF;
END $$;
