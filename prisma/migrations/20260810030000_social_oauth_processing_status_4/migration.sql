-- AlterEnum SocialOAuthStateStatus: atomic callback claim
ALTER TYPE "SocialOAuthStateStatus" ADD VALUE IF NOT EXISTS 'processing';
