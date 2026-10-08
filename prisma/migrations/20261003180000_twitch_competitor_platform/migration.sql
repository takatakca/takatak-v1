ALTER TABLE "social_competitor_tracks"
ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'facebook';

CREATE INDEX "social_competitor_tracks_platform_idx"
ON "social_competitor_tracks"("platform");
