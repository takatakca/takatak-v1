-- Website connections use homepage verification, not OAuth.
ALTER TYPE "SocialPlatform" ADD VALUE IF NOT EXISTS 'web';
ALTER TYPE "SocialConnectionProvider" ADD VALUE IF NOT EXISTS 'web';
