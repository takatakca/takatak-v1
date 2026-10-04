-- TAKATAK Community Content / Contributor Moderation.
-- Generic tenant-scoped engine. AHMV is the first publisher.
-- Human moderation remains authoritative. No browser role gets direct table access.

CREATE TABLE "managed_content_items" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID,
  "publisherCode" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceKey" TEXT NOT NULL,
  "title" TEXT,
  "canonicalUrl" TEXT,
  "sourceKind" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "snapshot" JSONB NOT NULL,
  "editableFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "version" INTEGER NOT NULL DEFAULT 1,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "managed_content_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "managed_content_items_resource_type_check"
    CHECK ("resourceType" IN ('news','post','photo','image','gallery','schedule','arena','team','page','faq','sponsor','other')),
  CONSTRAINT "managed_content_items_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "content_contributions" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID,
  "managedContentItemId" UUID,
  "publisherCode" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetUrl" TEXT,
  "originalVersion" INTEGER,
  "originalSnapshot" JSONB,
  "proposedPatch" JSONB NOT NULL,
  "reason" TEXT,
  "evidenceUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "attachmentUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "contributorProfileId" UUID,
  "contributorAuthUserId" UUID,
  "contributorTier" TEXT NOT NULL DEFAULT 'guest',
  "priority" TEXT NOT NULL DEFAULT 'standard',
  "reviewDueAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_review',
  "aiReviewStatus" TEXT NOT NULL DEFAULT 'pending',
  "aiReview" JSONB,
  "moderatorProfileId" UUID,
  "moderatorComment" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "content_contributions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "content_contributions_resource_type_check"
    CHECK ("resourceType" IN ('news','post','photo','image','gallery','schedule','arena','team','page','faq','sponsor','other')),
  CONSTRAINT "content_contributions_action_check"
    CHECK ("action" IN ('create','update','replace_media','correct_fact','remove')),
  CONSTRAINT "content_contributions_tier_check"
    CHECK ("contributorTier" IN ('guest','registered','member')),
  CONSTRAINT "content_contributions_priority_check"
    CHECK ("priority" IN ('standard','member_priority')),
  CONSTRAINT "content_contributions_status_check"
    CHECK ("status" IN ('pending_review','changes_requested','approved','rejected','published','withdrawn')),
  CONSTRAINT "content_contributions_ai_status_check"
    CHECK ("aiReviewStatus" IN ('pending','passed','flagged','unavailable'))
);

CREATE TABLE "content_contribution_events" (
  "id" UUID NOT NULL,
  "contributionId" UUID NOT NULL,
  "actorProfileId" UUID,
  "eventType" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "content_contribution_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_publications" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID,
  "contributionId" UUID NOT NULL,
  "managedContentItemId" UUID,
  "publisherCode" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceKey" TEXT NOT NULL,
  "patch" JSONB NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "acknowledgedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "content_publications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "content_publications_status_check"
    CHECK ("status" IN ('ready','applied','failed','revoked')),
  CONSTRAINT "content_publications_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "contributor_reputations" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "publisherCode" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "submittedCount" INTEGER NOT NULL DEFAULT 0,
  "approvedCount" INTEGER NOT NULL DEFAULT 0,
  "publishedCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "currentBadge" TEXT NOT NULL DEFAULT 'new_contributor',
  "lastContributionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contributor_reputations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contributor_reputations_non_negative_check"
    CHECK ("points" >= 0 AND "submittedCount" >= 0 AND "approvedCount" >= 0 AND "publishedCount" >= 0 AND "rejectedCount" >= 0)
);

CREATE TABLE "contribution_point_ledger" (
  "id" UUID NOT NULL,
  "reputationId" UUID NOT NULL,
  "contributionId" UUID,
  "points" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contribution_point_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "managed_content_publisher_resource_key"
  ON "managed_content_items"("publisherCode","resourceType","resourceKey");
CREATE INDEX "managed_content_items_clientId_publisherCode_idx"
  ON "managed_content_items"("clientId","publisherCode");
CREATE INDEX "managed_content_items_businessBrandId_publisherCode_idx"
  ON "managed_content_items"("businessBrandId","publisherCode");
CREATE INDEX "managed_content_items_resourceType_resourceKey_idx"
  ON "managed_content_items"("resourceType","resourceKey");
CREATE INDEX "managed_content_items_lastSyncedAt_idx"
  ON "managed_content_items"("lastSyncedAt");

CREATE UNIQUE INDEX "content_contribution_publisher_idempotency_key"
  ON "content_contributions"("publisherCode","idempotencyKey");
CREATE INDEX "content_contributions_clientId_status_priority_idx"
  ON "content_contributions"("clientId","status","priority");
CREATE INDEX "content_contributions_businessBrandId_status_idx"
  ON "content_contributions"("businessBrandId","status");
CREATE INDEX "content_contributions_publisherCode_status_reviewDueAt_idx"
  ON "content_contributions"("publisherCode","status","reviewDueAt");
CREATE INDEX "content_contributions_resourceType_resourceKey_idx"
  ON "content_contributions"("resourceType","resourceKey");
CREATE INDEX "content_contributions_contributorProfileId_createdAt_idx"
  ON "content_contributions"("contributorProfileId","createdAt");
CREATE INDEX "content_contributions_moderatorProfileId_reviewedAt_idx"
  ON "content_contributions"("moderatorProfileId","reviewedAt");

CREATE INDEX "content_contribution_events_contributionId_createdAt_idx"
  ON "content_contribution_events"("contributionId","createdAt");
CREATE INDEX "content_contribution_events_actorProfileId_createdAt_idx"
  ON "content_contribution_events"("actorProfileId","createdAt");
CREATE INDEX "content_contribution_events_eventType_createdAt_idx"
  ON "content_contribution_events"("eventType","createdAt");

CREATE UNIQUE INDEX "content_publications_contributionId_key"
  ON "content_publications"("contributionId");
CREATE INDEX "content_publications_clientId_publisherCode_active_idx"
  ON "content_publications"("clientId","publisherCode","active");
CREATE INDEX "content_publications_businessBrandId_active_idx"
  ON "content_publications"("businessBrandId","active");
CREATE INDEX "content_publications_publisherCode_resourceType_resourceKey_active_idx"
  ON "content_publications"("publisherCode","resourceType","resourceKey","active");
CREATE INDEX "content_publications_status_createdAt_idx"
  ON "content_publications"("status","createdAt");

CREATE UNIQUE INDEX "contributor_reputation_scope_key"
  ON "contributor_reputations"("clientId","profileId","publisherCode");
CREATE INDEX "contributor_reputations_clientId_publisherCode_points_idx"
  ON "contributor_reputations"("clientId","publisherCode","points");
CREATE INDEX "contributor_reputations_profileId_publisherCode_idx"
  ON "contributor_reputations"("profileId","publisherCode");
CREATE INDEX "contributor_reputations_currentBadge_idx"
  ON "contributor_reputations"("currentBadge");

CREATE UNIQUE INDEX "contribution_points_idempotency_key"
  ON "contribution_point_ledger"("reputationId","contributionId","reason");
CREATE INDEX "contribution_point_ledger_reputationId_createdAt_idx"
  ON "contribution_point_ledger"("reputationId","createdAt");
CREATE INDEX "contribution_point_ledger_contributionId_idx"
  ON "contribution_point_ledger"("contributionId");

ALTER TABLE "managed_content_items"
  ADD CONSTRAINT "managed_content_items_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "managed_content_items"
  ADD CONSTRAINT "managed_content_items_businessBrandId_fkey"
  FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_contributions"
  ADD CONSTRAINT "content_contributions_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_contributions"
  ADD CONSTRAINT "content_contributions_businessBrandId_fkey"
  FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "content_contributions"
  ADD CONSTRAINT "content_contributions_managedContentItemId_fkey"
  FOREIGN KEY ("managedContentItemId") REFERENCES "managed_content_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "content_contributions"
  ADD CONSTRAINT "content_contributions_contributorProfileId_fkey"
  FOREIGN KEY ("contributorProfileId") REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "content_contributions"
  ADD CONSTRAINT "content_contributions_moderatorProfileId_fkey"
  FOREIGN KEY ("moderatorProfileId") REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_contribution_events"
  ADD CONSTRAINT "content_contribution_events_contributionId_fkey"
  FOREIGN KEY ("contributionId") REFERENCES "content_contributions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_contribution_events"
  ADD CONSTRAINT "content_contribution_events_actorProfileId_fkey"
  FOREIGN KEY ("actorProfileId") REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_publications"
  ADD CONSTRAINT "content_publications_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_publications"
  ADD CONSTRAINT "content_publications_businessBrandId_fkey"
  FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "content_publications"
  ADD CONSTRAINT "content_publications_contributionId_fkey"
  FOREIGN KEY ("contributionId") REFERENCES "content_contributions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_publications"
  ADD CONSTRAINT "content_publications_managedContentItemId_fkey"
  FOREIGN KEY ("managedContentItemId") REFERENCES "managed_content_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contributor_reputations"
  ADD CONSTRAINT "contributor_reputations_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contributor_reputations"
  ADD CONSTRAINT "contributor_reputations_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contribution_point_ledger"
  ADD CONSTRAINT "contribution_point_ledger_reputationId_fkey"
  FOREIGN KEY ("reputationId") REFERENCES "contributor_reputations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contribution_point_ledger"
  ADD CONSTRAINT "contribution_point_ledger_contributionId_fkey"
  FOREIGN KEY ("contributionId") REFERENCES "content_contributions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backend-only tables. Browser roles get no direct Data API policies.
ALTER TABLE "managed_content_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_contributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_contribution_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_publications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contributor_reputations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contribution_point_ledger" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "managed_content_items" IS
  'Public-content registry synchronized by tenant publishers such as AHMV. Stores safe public snapshots only.';
COMMENT ON TABLE "content_contributions" IS
  'Community suggestions awaiting human moderation. Paid status affects SLA only, never automatic approval.';
COMMENT ON TABLE "content_publications" IS
  'Approved tenant overlays delivered back to the publisher; official-source data still requires explicit moderator verification.';
