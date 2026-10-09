-- AHMV normalized public schedule snapshot.
-- TAKATAK stores only public schedule/arena data here. No roster or child data.

CREATE TABLE "ahmv_schedule_snapshots" (
  "id" UUID NOT NULL,
  "tenant" TEXT NOT NULL DEFAULT 'ahmverdun',
  "status" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "events" JSONB NOT NULL,
  "eventCount" INTEGER NOT NULL DEFAULT 0,
  "contentHash" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ahmv_schedule_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ahmv_schedule_snapshots_status_check"
    CHECK ("status" IN ('active','no_match')),
  CONSTRAINT "ahmv_schedule_snapshots_event_count_check"
    CHECK ("eventCount" >= 0 AND "eventCount" <= 1000),
  CONSTRAINT "ahmv_schedule_snapshots_events_array_check"
    CHECK (jsonb_typeof("events") = 'array')
);

CREATE UNIQUE INDEX "ahmv_schedule_snapshots_tenant_key"
  ON "ahmv_schedule_snapshots"("tenant");
CREATE INDEX "ahmv_schedule_snapshots_sourceUpdatedAt_idx"
  ON "ahmv_schedule_snapshots"("sourceUpdatedAt");

ALTER TABLE "ahmv_schedule_snapshots" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "ahmv_schedule_snapshots" IS
  'Latest normalized public AHMV schedule snapshot for server-to-server Phone/SMS/Voice reads. No roster or child data.';
