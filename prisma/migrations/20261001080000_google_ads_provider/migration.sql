-- Google Ads uses its own provider connection. YouTube rows stay on `google`.
ALTER TYPE "SocialPlatform" ADD VALUE IF NOT EXISTS 'google_ads';
ALTER TYPE "SocialConnectionProvider" ADD VALUE IF NOT EXISTS 'google_ads';
