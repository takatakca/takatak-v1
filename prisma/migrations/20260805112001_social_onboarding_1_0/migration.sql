-- CreateEnum
CREATE TYPE "SocialOnboardingPersona" AS ENUM ('creator', 'company_manager', 'freelancer', 'agency');

-- CreateEnum
CREATE TYPE "SocialOnboardingTeamMode" AS ENUM ('solo', 'team');

-- CreateEnum
CREATE TYPE "SocialOnboardingGoal" AS ENUM ('planning', 'analytics', 'smartlinks', 'inbox');

-- CreateEnum
CREATE TYPE "SocialOnboardingStatus" AS ENUM ('in_progress', 'completed', 'skipped');

-- CreateTable
CREATE TABLE "social_onboarding" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "persona" "SocialOnboardingPersona",
    "teamMode" "SocialOnboardingTeamMode",
    "goals" "SocialOnboardingGoal"[] DEFAULT ARRAY[]::"SocialOnboardingGoal"[],
    "status" "SocialOnboardingStatus" NOT NULL DEFAULT 'in_progress',
    "lastStep" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_onboarding_profileId_key" ON "social_onboarding"("profileId");

-- CreateIndex
CREATE INDEX "social_onboarding_status_idx" ON "social_onboarding"("status");

-- AddForeignKey
ALTER TABLE "social_onboarding" ADD CONSTRAINT "social_onboarding_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
