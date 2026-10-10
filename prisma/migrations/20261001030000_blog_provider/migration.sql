-- Blog connections belong to a verified website and publish a TAKATAK blog page.
ALTER TYPE "SocialPlatform" ADD VALUE IF NOT EXISTS 'blog';
ALTER TYPE "SocialConnectionProvider" ADD VALUE IF NOT EXISTS 'blog';
