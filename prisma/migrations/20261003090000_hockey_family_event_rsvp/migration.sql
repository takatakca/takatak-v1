-- Private family event RSVP coordination.
-- This is not an official team attendance record and stores no medical reason.

CREATE TABLE "hockey_family_event_rsvps" (
  "id" UUID NOT NULL,
  "familyId" UUID NOT NULL,
  "teamEventId" UUID NOT NULL,
  "childMemberId" UUID NOT NULL,
  "updatedByIdentityId" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hockey_family_event_rsvps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_family_event_rsvps_status_check"
    CHECK ("status" IN ('going','not_going','unsure'))
);

CREATE UNIQUE INDEX "hockey_family_event_rsvps_family_event_child_key"
  ON "hockey_family_event_rsvps"("familyId","teamEventId","childMemberId");
CREATE INDEX "hockey_family_event_rsvps_family_status_idx"
  ON "hockey_family_event_rsvps"("familyId","status");
CREATE INDEX "hockey_family_event_rsvps_event_status_idx"
  ON "hockey_family_event_rsvps"("teamEventId","status");

ALTER TABLE "hockey_family_event_rsvps"
  ADD CONSTRAINT "hockey_family_event_rsvps_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "hockey_families"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_event_rsvps"
  ADD CONSTRAINT "hockey_family_event_rsvps_teamEventId_fkey"
  FOREIGN KEY ("teamEventId") REFERENCES "hockey_team_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_event_rsvps"
  ADD CONSTRAINT "hockey_family_event_rsvps_childMemberId_fkey"
  FOREIGN KEY ("childMemberId") REFERENCES "hockey_family_members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_event_rsvps"
  ADD CONSTRAINT "hockey_family_event_rsvps_updatedByIdentityId_fkey"
  FOREIGN KEY ("updatedByIdentityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.hockey_family_event_rsvps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hockey_family_event_rsvps FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.hockey_family_event_rsvps FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.hockey_family_event_rsvps FROM authenticated;
  END IF;
END $$;
