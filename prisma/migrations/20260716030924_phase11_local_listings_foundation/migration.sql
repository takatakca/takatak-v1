-- CreateEnum
CREATE TYPE "ListingProvider" AS ENUM ('qmaps', 'google_business', 'manual', 'internal_demo', 'future_provider');

-- CreateEnum
CREATE TYPE "LocalListingStatus" AS ENUM ('planned', 'draft', 'pending_review', 'active_internal', 'needs_update', 'error', 'archived');

-- CreateEnum
CREATE TYPE "NapStatus" AS ENUM ('unknown', 'consistent_internal', 'needs_review', 'inconsistent', 'missing');

-- CreateEnum
CREATE TYPE "CitationStatus" AS ENUM ('planned', 'found_internal', 'missing', 'needs_update', 'error', 'archived');

-- CreateEnum
CREATE TYPE "CitationSource" AS ENUM ('internal_demo', 'manual', 'qmaps', 'provider_api', 'future_provider');

-- CreateEnum
CREATE TYPE "ListingReviewStatus" AS ENUM ('planned', 'internal_demo', 'needs_review', 'archived');

-- CreateEnum
CREATE TYPE "ReviewReplyStatus" AS ENUM ('not_replied', 'draft_reply', 'replied_internal', 'not_applicable');

-- CreateEnum
CREATE TYPE "ReviewSentiment" AS ENUM ('unknown', 'positive', 'neutral', 'negative');

-- CreateEnum
CREATE TYPE "ListingPhotoStatus" AS ENUM ('planned', 'internal_demo', 'needs_upload', 'approved_internal', 'archived');

-- CreateEnum
CREATE TYPE "ListingPhotoSource" AS ENUM ('internal_demo', 'manual', 'qmaps', 'google_business', 'future_provider');

-- CreateEnum
CREATE TYPE "VisibilitySource" AS ENUM ('internal_foundation', 'qmaps', 'google_business', 'manual', 'future_provider');

-- CreateTable
CREATE TABLE "local_listings" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "serviceInstanceId" UUID,
    "provider" "ListingProvider" NOT NULL DEFAULT 'internal_demo',
    "name" TEXT NOT NULL,
    "platformName" TEXT NOT NULL,
    "category" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Canada',
    "postalCode" TEXT,
    "status" "LocalListingStatus" NOT NULL DEFAULT 'planned',
    "napStatus" "NapStatus" NOT NULL DEFAULT 'unknown',
    "lastCheckedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_citations" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "localListingId" UUID,
    "directoryName" TEXT NOT NULL,
    "url" TEXT,
    "status" "CitationStatus" NOT NULL DEFAULT 'planned',
    "napStatus" "NapStatus" NOT NULL DEFAULT 'unknown',
    "lastCheckedAt" TIMESTAMP(3),
    "source" "CitationSource" NOT NULL DEFAULT 'internal_demo',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_reviews" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "localListingId" UUID,
    "provider" "ListingProvider" NOT NULL DEFAULT 'internal_demo',
    "reviewerName" TEXT,
    "rating" INTEGER,
    "title" TEXT,
    "body" TEXT,
    "status" "ListingReviewStatus" NOT NULL DEFAULT 'planned',
    "replyStatus" "ReviewReplyStatus" NOT NULL DEFAULT 'not_replied',
    "sentiment" "ReviewSentiment" NOT NULL DEFAULT 'unknown',
    "reviewedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_photos" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "localListingId" UUID,
    "title" TEXT,
    "imageUrl" TEXT,
    "status" "ListingPhotoStatus" NOT NULL DEFAULT 'planned',
    "source" "ListingPhotoSource" NOT NULL DEFAULT 'internal_demo',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_visibility_snapshots" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "localListingId" UUID,
    "source" "VisibilitySource" NOT NULL DEFAULT 'internal_foundation',
    "score" INTEGER,
    "listingsCount" INTEGER NOT NULL DEFAULT 0,
    "citationsCount" INTEGER NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION,
    "notes" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_visibility_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "local_listings_clientId_idx" ON "local_listings"("clientId");

-- CreateIndex
CREATE INDEX "local_listings_businessBrandId_idx" ON "local_listings"("businessBrandId");

-- CreateIndex
CREATE INDEX "local_listings_serviceInstanceId_idx" ON "local_listings"("serviceInstanceId");

-- CreateIndex
CREATE INDEX "local_listings_provider_idx" ON "local_listings"("provider");

-- CreateIndex
CREATE INDEX "local_listings_status_idx" ON "local_listings"("status");

-- CreateIndex
CREATE INDEX "local_listings_napStatus_idx" ON "local_listings"("napStatus");

-- CreateIndex
CREATE INDEX "local_listings_city_idx" ON "local_listings"("city");

-- CreateIndex
CREATE INDEX "local_listings_createdAt_idx" ON "local_listings"("createdAt");

-- CreateIndex
CREATE INDEX "listing_citations_clientId_idx" ON "listing_citations"("clientId");

-- CreateIndex
CREATE INDEX "listing_citations_businessBrandId_idx" ON "listing_citations"("businessBrandId");

-- CreateIndex
CREATE INDEX "listing_citations_localListingId_idx" ON "listing_citations"("localListingId");

-- CreateIndex
CREATE INDEX "listing_citations_directoryName_idx" ON "listing_citations"("directoryName");

-- CreateIndex
CREATE INDEX "listing_citations_status_idx" ON "listing_citations"("status");

-- CreateIndex
CREATE INDEX "listing_citations_napStatus_idx" ON "listing_citations"("napStatus");

-- CreateIndex
CREATE INDEX "listing_citations_source_idx" ON "listing_citations"("source");

-- CreateIndex
CREATE INDEX "listing_citations_createdAt_idx" ON "listing_citations"("createdAt");

-- CreateIndex
CREATE INDEX "listing_reviews_clientId_idx" ON "listing_reviews"("clientId");

-- CreateIndex
CREATE INDEX "listing_reviews_businessBrandId_idx" ON "listing_reviews"("businessBrandId");

-- CreateIndex
CREATE INDEX "listing_reviews_localListingId_idx" ON "listing_reviews"("localListingId");

-- CreateIndex
CREATE INDEX "listing_reviews_provider_idx" ON "listing_reviews"("provider");

-- CreateIndex
CREATE INDEX "listing_reviews_status_idx" ON "listing_reviews"("status");

-- CreateIndex
CREATE INDEX "listing_reviews_replyStatus_idx" ON "listing_reviews"("replyStatus");

-- CreateIndex
CREATE INDEX "listing_reviews_sentiment_idx" ON "listing_reviews"("sentiment");

-- CreateIndex
CREATE INDEX "listing_reviews_rating_idx" ON "listing_reviews"("rating");

-- CreateIndex
CREATE INDEX "listing_reviews_reviewedAt_idx" ON "listing_reviews"("reviewedAt");

-- CreateIndex
CREATE INDEX "listing_reviews_createdAt_idx" ON "listing_reviews"("createdAt");

-- CreateIndex
CREATE INDEX "listing_photos_clientId_idx" ON "listing_photos"("clientId");

-- CreateIndex
CREATE INDEX "listing_photos_businessBrandId_idx" ON "listing_photos"("businessBrandId");

-- CreateIndex
CREATE INDEX "listing_photos_localListingId_idx" ON "listing_photos"("localListingId");

-- CreateIndex
CREATE INDEX "listing_photos_status_idx" ON "listing_photos"("status");

-- CreateIndex
CREATE INDEX "listing_photos_source_idx" ON "listing_photos"("source");

-- CreateIndex
CREATE INDEX "listing_photos_createdAt_idx" ON "listing_photos"("createdAt");

-- CreateIndex
CREATE INDEX "local_visibility_snapshots_clientId_idx" ON "local_visibility_snapshots"("clientId");

-- CreateIndex
CREATE INDEX "local_visibility_snapshots_businessBrandId_idx" ON "local_visibility_snapshots"("businessBrandId");

-- CreateIndex
CREATE INDEX "local_visibility_snapshots_localListingId_idx" ON "local_visibility_snapshots"("localListingId");

-- CreateIndex
CREATE INDEX "local_visibility_snapshots_source_idx" ON "local_visibility_snapshots"("source");

-- CreateIndex
CREATE INDEX "local_visibility_snapshots_capturedAt_idx" ON "local_visibility_snapshots"("capturedAt");

-- CreateIndex
CREATE INDEX "local_visibility_snapshots_createdAt_idx" ON "local_visibility_snapshots"("createdAt");

-- AddForeignKey
ALTER TABLE "local_listings" ADD CONSTRAINT "local_listings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_listings" ADD CONSTRAINT "local_listings_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_listings" ADD CONSTRAINT "local_listings_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "service_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_citations" ADD CONSTRAINT "listing_citations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_citations" ADD CONSTRAINT "listing_citations_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_citations" ADD CONSTRAINT "listing_citations_localListingId_fkey" FOREIGN KEY ("localListingId") REFERENCES "local_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_localListingId_fkey" FOREIGN KEY ("localListingId") REFERENCES "local_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_localListingId_fkey" FOREIGN KEY ("localListingId") REFERENCES "local_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_visibility_snapshots" ADD CONSTRAINT "local_visibility_snapshots_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_visibility_snapshots" ADD CONSTRAINT "local_visibility_snapshots_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_visibility_snapshots" ADD CONSTRAINT "local_visibility_snapshots_localListingId_fkey" FOREIGN KEY ("localListingId") REFERENCES "local_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
