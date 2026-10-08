-- Growth Suite: scheduled AI agents (autopilot) and review-feedback lead hand-off.
-- Additive only: new nullable/defaulted columns, one index, value checks.

-- AlterTable
ALTER TABLE "review_responses" ADD COLUMN     "leadId" UUID;

-- AlterTable
ALTER TABLE "ai_agent_settings" ADD COLUMN     "lastScheduledFor" TIMESTAMP(3),
ADD COLUMN     "schedule" TEXT NOT NULL DEFAULT 'off',
ADD COLUMN     "scheduleHour" SMALLINT NOT NULL DEFAULT 9,
ADD COLUMN     "scheduleWeekday" SMALLINT;

-- CreateIndex
CREATE INDEX "ai_agent_settings_enabled_schedule_idx" ON "ai_agent_settings"("enabled", "schedule");


-- Integrity guards.
ALTER TABLE "ai_agent_settings"
  ADD CONSTRAINT "ai_agent_settings_schedule_values" CHECK ("schedule" IN ('off', 'daily', 'weekly'));
ALTER TABLE "ai_agent_settings"
  ADD CONSTRAINT "ai_agent_settings_schedule_hour_range" CHECK ("scheduleHour" BETWEEN 0 AND 23);
ALTER TABLE "ai_agent_settings"
  ADD CONSTRAINT "ai_agent_settings_schedule_weekday_range" CHECK ("scheduleWeekday" IS NULL OR "scheduleWeekday" BETWEEN 0 AND 6);
