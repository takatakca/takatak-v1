-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('openai', 'tryholo', 'internal');

-- CreateEnum
CREATE TYPE "AiContentKind" AS ENUM ('caption', 'hashtags', 'hook', 'cta', 'post_long', 'campaign_plan', 'video_idea', 'video_script', 'creative_brief', 'report_summary');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('planned', 'queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AiOutputOrigin" AS ENUM ('foundation_template', 'ai_generated', 'manual');

-- CreateEnum
CREATE TYPE "AiOutputStatus" AS ENUM ('draft', 'saved', 'sent_to_approval', 'archived');

-- CreateTable
CREATE TABLE "brand_voices" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "name" TEXT NOT NULL,
    "tone" TEXT,
    "audience" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "keywords" JSONB,
    "bannedPhrases" JSONB,
    "sampleCaption" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_voices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_content_jobs" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "brandVoiceId" UUID,
    "provider" "AiProvider",
    "kind" "AiContentKind" NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'planned',
    "promptSummary" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_content_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_ai_outputs" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "brandVoiceId" UUID,
    "aiContentJobId" UUID,
    "kind" "AiContentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "origin" "AiOutputOrigin" NOT NULL DEFAULT 'foundation_template',
    "status" "AiOutputStatus" NOT NULL DEFAULT 'saved',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_ai_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_events" (
    "id" UUID NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_voices_clientId_idx" ON "brand_voices"("clientId");

-- CreateIndex
CREATE INDEX "brand_voices_businessBrandId_idx" ON "brand_voices"("businessBrandId");

-- CreateIndex
CREATE INDEX "ai_content_jobs_clientId_idx" ON "ai_content_jobs"("clientId");

-- CreateIndex
CREATE INDEX "ai_content_jobs_businessBrandId_idx" ON "ai_content_jobs"("businessBrandId");

-- CreateIndex
CREATE INDEX "ai_content_jobs_provider_idx" ON "ai_content_jobs"("provider");

-- CreateIndex
CREATE INDEX "ai_content_jobs_kind_idx" ON "ai_content_jobs"("kind");

-- CreateIndex
CREATE INDEX "ai_content_jobs_status_idx" ON "ai_content_jobs"("status");

-- CreateIndex
CREATE INDEX "ai_content_jobs_createdAt_idx" ON "ai_content_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "saved_ai_outputs_clientId_idx" ON "saved_ai_outputs"("clientId");

-- CreateIndex
CREATE INDEX "saved_ai_outputs_businessBrandId_idx" ON "saved_ai_outputs"("businessBrandId");

-- CreateIndex
CREATE INDEX "saved_ai_outputs_kind_idx" ON "saved_ai_outputs"("kind");

-- CreateIndex
CREATE INDEX "saved_ai_outputs_origin_idx" ON "saved_ai_outputs"("origin");

-- CreateIndex
CREATE INDEX "saved_ai_outputs_status_idx" ON "saved_ai_outputs"("status");

-- CreateIndex
CREATE INDEX "saved_ai_outputs_createdAt_idx" ON "saved_ai_outputs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_provider_events_provider_idx" ON "ai_provider_events"("provider");

-- CreateIndex
CREATE INDEX "ai_provider_events_eventType_idx" ON "ai_provider_events"("eventType");

-- CreateIndex
CREATE INDEX "ai_provider_events_createdAt_idx" ON "ai_provider_events"("createdAt");

-- AddForeignKey
ALTER TABLE "brand_voices" ADD CONSTRAINT "brand_voices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_voices" ADD CONSTRAINT "brand_voices_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_content_jobs" ADD CONSTRAINT "ai_content_jobs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_content_jobs" ADD CONSTRAINT "ai_content_jobs_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_content_jobs" ADD CONSTRAINT "ai_content_jobs_brandVoiceId_fkey" FOREIGN KEY ("brandVoiceId") REFERENCES "brand_voices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_ai_outputs" ADD CONSTRAINT "saved_ai_outputs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_ai_outputs" ADD CONSTRAINT "saved_ai_outputs_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_ai_outputs" ADD CONSTRAINT "saved_ai_outputs_brandVoiceId_fkey" FOREIGN KEY ("brandVoiceId") REFERENCES "brand_voices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_ai_outputs" ADD CONSTRAINT "saved_ai_outputs_aiContentJobId_fkey" FOREIGN KEY ("aiContentJobId") REFERENCES "ai_content_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
