-- Google Business Profile owns an independent OAuth connection.
-- Existing `google` rows remain YouTube connections.
ALTER TYPE "SocialConnectionProvider"
ADD VALUE IF NOT EXISTS 'google_business';
