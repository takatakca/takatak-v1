-- Family-only game responsibility coordination.
-- No route history or precise pickup/dropoff location is stored.

CREATE TABLE "hockey_family_event_plans" (
  "id" UUID NOT NULL,
  "familyId" UUID NOT NULL,
  "teamEventId" UUID NOT NULL,
  "childMemberId" UUID NOT NULL,
  "driverMemberId" UUID NOT NULL,
  "createdByIdentityId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hockey_family_event_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_family_event_plans_status_check"
    CHECK ("status" IN ('planned','confirmed','cancelled'))
);

CREATE UNIQUE INDEX "hockey_family_event_plans_family_event_child_key"
  ON "hockey_family_event_plans"("familyId","teamEventId","childMemberId");
CREATE INDEX "hockey_family_event_plans_family_status_idx"
  ON "hockey_family_event_plans"("familyId","status");
CREATE INDEX "hockey_family_event_plans_event_status_idx"
  ON "hockey_family_event_plans"("teamEventId","status");
CREATE INDEX "hockey_family_event_plans_driver_status_idx"
  ON "hockey_family_event_plans"("driverMemberId","status");

ALTER TABLE "hockey_family_event_plans"
  ADD CONSTRAINT "hockey_family_event_plans_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "hockey_families"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_event_plans"
  ADD CONSTRAINT "hockey_family_event_plans_teamEventId_fkey"
  FOREIGN KEY ("teamEventId") REFERENCES "hockey_team_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_event_plans"
  ADD CONSTRAINT "hockey_family_event_plans_childMemberId_fkey"
  FOREIGN KEY ("childMemberId") REFERENCES "hockey_family_members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_event_plans"
  ADD CONSTRAINT "hockey_family_event_plans_driverMemberId_fkey"
  FOREIGN KEY ("driverMemberId") REFERENCES "hockey_family_members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_event_plans"
  ADD CONSTRAINT "hockey_family_event_plans_createdByIdentityId_fkey"
  FOREIGN KEY ("createdByIdentityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.hockey_family_event_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hockey_family_event_plans FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.hockey_family_event_plans FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.hockey_family_event_plans FROM authenticated;
  END IF;
END $$;
