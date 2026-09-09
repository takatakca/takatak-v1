-- Brand settings: engagement display ratio + selected connected-account avatar.
ALTER TABLE "business_brands"
  ADD COLUMN IF NOT EXISTS "engagementRatio" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE "business_brands"
  ADD COLUMN IF NOT EXISTS "imageSocialAccountId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_brands_engagement_ratio_check'
  ) THEN
    ALTER TABLE "business_brands"
      ADD CONSTRAINT "business_brands_engagement_ratio_check"
      CHECK ("engagementRatio" IN (100, 1000));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "business_brands_imageSocialAccountId_idx"
  ON "business_brands"("imageSocialAccountId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_brands_imageSocialAccountId_fkey'
  ) THEN
    ALTER TABLE "business_brands"
      ADD CONSTRAINT "business_brands_imageSocialAccountId_fkey"
      FOREIGN KEY ("imageSocialAccountId")
      REFERENCES "social_accounts"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
