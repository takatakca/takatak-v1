-- Meta Ads uses its own provider connection. Facebook Page rows stay on `meta`.
ALTER TYPE "SocialPlatform" ADD VALUE IF NOT EXISTS 'meta_ads';
ALTER TYPE "SocialConnectionProvider" ADD VALUE IF NOT EXISTS 'meta_ads';
