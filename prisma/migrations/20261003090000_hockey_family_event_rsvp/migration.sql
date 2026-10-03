-- Structured family RSVP for an exact public hockey event.
-- No free-form child notes, medical fields or roster data are stored.

CREATE TABLE "hockey_family_event_responses" (
  "id" UUID NOT NULL,
  "familyId" UUID NOT NULL,
  "teamEventId" UUID NOT NULL,
  "memberId" UUID NOT NULL,
  "respondedByIdentityId" UUID NOT NULL,
  "response" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hockey_family_event_responses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_family_event_responses_response_check"
    CHECK ("response" IN ('going','maybe','not_going'))
);

CREATE UNIQUE INDEX "hockey_family_event_responses_family_event_member_key"
  ON "hockey_family_event_responses"("familyId","teamEventId","memberId");
CREATE INDEX "hockey_family_event_responses_family_response_idx"
  ON "hockey_family_event_responses"("familyId","response");
CREATE INDEX "hockey_family_event_responses_event_response_idx"
  ON "hockey_family_event_responses"("teamEventId","response");
CREATE INDEX "hockey_family_event_responses_member_response_idx"
  ON "hockey_family_event_responses"("memberId","response");

ALTER TABLE "hockey_family_event_responses"
  ADD CONSTRAINT "hockey_family_event_responses_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "hockey_families"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_event_responses"
  ADD CONSTRAINT "hockey_family_event_responses_teamEventId_fkey"
  FOREIGN KEY ("teamEventId") REFERENCES "hockey_team_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_event_responses"
  ADD CONSTRAINT "hockey_family_event_responses_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "hockey_family_members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_event_responses"
  ADD CONSTRAINT "hockey_family_event_responses_respondedByIdentityId_fkey"
  FOREIGN KEY ("respondedByIdentityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.hockey_family_event_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hockey_family_event_responses FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.hockey_family_event_responses FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.hockey_family_event_responses FROM authenticated;
  END IF;
END $$;
