-- Explicit brand/workspace image (never overwritten by social Page connect).
ALTER TABLE "business_brands"
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
