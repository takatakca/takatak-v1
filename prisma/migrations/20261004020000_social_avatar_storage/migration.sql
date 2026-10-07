ALTER TABLE "social_accounts"
  ADD COLUMN "avatarStorageKey" TEXT,
  ADD COLUMN "avatarContentType" TEXT,
  ADD COLUMN "avatarByteSize" INTEGER,
  ADD COLUMN "avatarSourceUrl" TEXT,
  ADD COLUMN "avatarSyncedAt" TIMESTAMP(3),
  ADD COLUMN "avatarSyncError" TEXT;

CREATE INDEX "social_accounts_avatarStorageKey_idx"
  ON "social_accounts"("avatarStorageKey");

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'social-avatars',
  'social-avatars',
  false,
  1500000,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
