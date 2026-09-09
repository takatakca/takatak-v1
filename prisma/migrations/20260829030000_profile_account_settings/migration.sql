ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Toronto';

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "weekStartsOn" TEXT NOT NULL DEFAULT 'sunday';

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "monthlySummaryEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "monthlySummaryEmail" TEXT;
