-- Independent Instagram Login and Threads OAuth connections.
ALTER TYPE "SocialConnectionProvider" ADD VALUE IF NOT EXISTS 'instagram';
ALTER TYPE "SocialConnectionProvider" ADD VALUE IF NOT EXISTS 'threads';
