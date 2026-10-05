-- Parent convenience preferences for exact AHMV public team IDs.
-- No player roster data, precise location history, OAuth tokens or payment secrets
-- are stored in this table.

CREATE TABLE "hockey_parent_team_preferences" (
  "id" UUID NOT NULL,
  "identityId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL DEFAULT 'ahmverdun',
  "teamId" TEXT NOT NULL,
  "smsReminders" BOOLEAN NOT NULL DEFAULT false,
  "calendarSync" BOOLEAN NOT NULL DEFAULT false,
  "departureAlerts" BOOLEAN NOT NULL DEFAULT false,
  "arrivalBufferMinutes" INTEGER NOT NULL DEFAULT 30,
  "smsConsentAt" TIMESTAMP(3),
  "calendarConsentAt" TIMESTAMP(3),
  "departureConsentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hockey_parent_team_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_parent_team_preferences_arrival_buffer_check"
    CHECK ("arrivalBufferMinutes" >= 0 AND "arrivalBufferMinutes" <= 180)
);

CREATE UNIQUE INDEX "hockey_parent_team_preferences_identity_source_team_key"
  ON "hockey_parent_team_preferences"("identityId", "sourceApplication", "teamId");

CREATE INDEX "hockey_parent_team_preferences_identity_source_idx"
  ON "hockey_parent_team_preferences"("identityId", "sourceApplication");

CREATE INDEX "hockey_parent_team_preferences_source_team_idx"
  ON "hockey_parent_team_preferences"("sourceApplication", "teamId");

ALTER TABLE "hockey_parent_team_preferences"
  ADD CONSTRAINT "hockey_parent_team_preferences_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
