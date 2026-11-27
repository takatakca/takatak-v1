-- SmartLinks (Social): one public link page per brand, its buttons and daily
-- counters. Owner-approved for code on 2026-11-27; NOT on the production
-- deploy list: the owner applies it later.

CREATE TABLE "social_smartlinks" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "bio" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdByProfileId" UUID,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_smartlinks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "social_smartlinks_status_check" CHECK ("status" IN ('draft', 'published'))
);

CREATE UNIQUE INDEX "social_smartlinks_slug_key" ON "social_smartlinks"("slug");
CREATE INDEX "social_smartlinks_clientId_businessBrandId_status_idx" ON "social_smartlinks"("clientId", "businessBrandId", "status");
CREATE INDEX "social_smartlinks_businessBrandId_idx" ON "social_smartlinks"("businessBrandId");

ALTER TABLE "social_smartlinks"
  ADD CONSTRAINT "social_smartlinks_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_smartlinks"
  ADD CONSTRAINT "social_smartlinks_businessBrandId_fkey"
  FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "social_smartlink_buttons" (
  "id" UUID NOT NULL,
  "smartLinkId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_smartlink_buttons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "social_smartlink_buttons_smartLinkId_position_idx" ON "social_smartlink_buttons"("smartLinkId", "position");
CREATE INDEX "social_smartlink_buttons_clientId_idx" ON "social_smartlink_buttons"("clientId");

ALTER TABLE "social_smartlink_buttons"
  ADD CONSTRAINT "social_smartlink_buttons_smartLinkId_fkey"
  FOREIGN KEY ("smartLinkId") REFERENCES "social_smartlinks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "social_smartlink_daily_stats" (
  "id" UUID NOT NULL,
  "smartLinkId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "statKey" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "social_smartlink_daily_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ssl_daily_stat_key" ON "social_smartlink_daily_stats"("smartLinkId", "statKey", "day");
CREATE INDEX "social_smartlink_daily_stats_clientId_day_idx" ON "social_smartlink_daily_stats"("clientId", "day");

ALTER TABLE "social_smartlink_daily_stats"
  ADD CONSTRAINT "social_smartlink_daily_stats_smartLinkId_fkey"
  FOREIGN KEY ("smartLinkId") REFERENCES "social_smartlinks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Server-only tables: no direct access from the Supabase anon/authenticated roles.
ALTER TABLE "social_smartlinks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "social_smartlinks" FROM PUBLIC;
REVOKE ALL ON TABLE "social_smartlinks" FROM anon;
REVOKE ALL ON TABLE "social_smartlinks" FROM authenticated;
ALTER TABLE "social_smartlink_buttons" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "social_smartlink_buttons" FROM PUBLIC;
REVOKE ALL ON TABLE "social_smartlink_buttons" FROM anon;
REVOKE ALL ON TABLE "social_smartlink_buttons" FROM authenticated;
ALTER TABLE "social_smartlink_daily_stats" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "social_smartlink_daily_stats" FROM PUBLIC;
REVOKE ALL ON TABLE "social_smartlink_daily_stats" FROM anon;
REVOKE ALL ON TABLE "social_smartlink_daily_stats" FROM authenticated;
