ALTER TABLE "brand_voices"
  ADD COLUMN IF NOT EXISTS "instructions" JSONB;
