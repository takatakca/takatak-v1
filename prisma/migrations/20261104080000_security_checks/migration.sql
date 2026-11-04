-- Security screens (docs/security/SECURITY_SCREENS.md): support identity checks,
-- new-device sign-in checks, and the browsers a person has signed in from.

CREATE TABLE "security_checks" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "matchNumber" INTEGER NOT NULL,
  "choices" INTEGER[],
  "requestedByProfileId" UUID,
  "deviceId" TEXT,
  "deviceLabel" TEXT,
  "ipHint" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "respondedAt" TIMESTAMP(3),
  "responseDeviceId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_checks_profileId_status_idx" ON "security_checks"("profileId", "status");
CREATE INDEX "security_checks_expiresAt_idx" ON "security_checks"("expiresAt");

ALTER TABLE "security_checks"
  ADD CONSTRAINT "security_checks_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_checks"
  ADD CONSTRAINT "security_checks_requestedByProfileId_fkey"
  FOREIGN KEY ("requestedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "security_devices" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "deviceId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "security_devices_profileId_deviceId_key" ON "security_devices"("profileId", "deviceId");

ALTER TABLE "security_devices"
  ADD CONSTRAINT "security_devices_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Server-only tables: no direct access from the Supabase anon/authenticated roles.
ALTER TABLE "security_checks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "security_checks" FROM PUBLIC;
REVOKE ALL ON TABLE "security_checks" FROM anon;
REVOKE ALL ON TABLE "security_checks" FROM authenticated;
ALTER TABLE "security_devices" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "security_devices" FROM PUBLIC;
REVOKE ALL ON TABLE "security_devices" FROM anon;
REVOKE ALL ON TABLE "security_devices" FROM authenticated;
