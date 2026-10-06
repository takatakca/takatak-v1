-- Growth Suite: first-party analytics, retargeting audiences and web chat.
-- Analytics is cookie-free: visitors are identified only by a salted hash that
-- rotates daily; raw IP addresses and user agents are never stored. Chat
-- visitors hold a random token whose SHA-256 is the only stored identifier.

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('pageview', 'event', 'conversion');

-- CreateEnum
CREATE TYPE "ChatConversationStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "ChatSender" AS ENUM ('visitor', 'staff', 'ai', 'system');

ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'view_conversations';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'manage_conversations';

-- CreateTable
CREATE TABLE "analytics_sites" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "type" "AnalyticsEventType" NOT NULL DEFAULT 'pageview',
    "name" TEXT,
    "path" TEXT NOT NULL,
    "referrerHost" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "device" TEXT,
    "browser" TEXT,
    "visitorHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_audiences" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "pathPrefixes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eventNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lookbackDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_audiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_widgets" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "name" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "greeting" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#4f46e5',
    "whatsappNumber" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "widgetId" UUID NOT NULL,
    "visitorTokenHash" TEXT NOT NULL,
    "visitorName" TEXT,
    "visitorEmail" TEXT,
    "visitorPhone" TEXT,
    "pageUrl" TEXT,
    "status" "ChatConversationStatus" NOT NULL DEFAULT 'open',
    "unreadForStaff" INTEGER NOT NULL DEFAULT 0,
    "leadId" UUID,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "sender" "ChatSender" NOT NULL,
    "body" TEXT NOT NULL,
    "staffProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_sites_publicKey_key" ON "analytics_sites"("publicKey");

-- CreateIndex
CREATE INDEX "analytics_sites_clientId_idx" ON "analytics_sites"("clientId");

-- CreateIndex
CREATE INDEX "analytics_sites_businessBrandId_idx" ON "analytics_sites"("businessBrandId");

-- CreateIndex
CREATE INDEX "analytics_events_siteId_occurredAt_idx" ON "analytics_events"("siteId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_clientId_occurredAt_idx" ON "analytics_events"("clientId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_siteId_type_occurredAt_idx" ON "analytics_events"("siteId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_audiences_clientId_idx" ON "analytics_audiences"("clientId");

-- CreateIndex
CREATE INDEX "analytics_audiences_siteId_idx" ON "analytics_audiences"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_widgets_publicKey_key" ON "chat_widgets"("publicKey");

-- CreateIndex
CREATE INDEX "chat_widgets_clientId_idx" ON "chat_widgets"("clientId");

-- CreateIndex
CREATE INDEX "chat_widgets_businessBrandId_idx" ON "chat_widgets"("businessBrandId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_conversations_visitorTokenHash_key" ON "chat_conversations"("visitorTokenHash");

-- CreateIndex
CREATE INDEX "chat_conversations_clientId_status_lastMessageAt_idx" ON "chat_conversations"("clientId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "chat_conversations_widgetId_lastMessageAt_idx" ON "chat_conversations"("widgetId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_createdAt_idx" ON "chat_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_clientId_createdAt_idx" ON "chat_messages"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "analytics_sites" ADD CONSTRAINT "analytics_sites_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_sites" ADD CONSTRAINT "analytics_sites_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "analytics_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_audiences" ADD CONSTRAINT "analytics_audiences_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_audiences" ADD CONSTRAINT "analytics_audiences_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "analytics_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_widgets" ADD CONSTRAINT "chat_widgets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_widgets" ADD CONSTRAINT "chat_widgets_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "chat_widgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integrity guards.
ALTER TABLE "analytics_audiences"
  ADD CONSTRAINT "analytics_audiences_lookback_range" CHECK ("lookbackDays" BETWEEN 1 AND 540);
ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_path_length" CHECK (char_length("path") <= 512);
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_body_length" CHECK (char_length("body") BETWEEN 1 AND 4000);
ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_unread_nonnegative" CHECK ("unreadForStaff" >= 0);
ALTER TABLE "chat_widgets"
  ADD CONSTRAINT "chat_widgets_accent_hex" CHECK ("accentColor" ~ '^#[0-9a-fA-F]{6}$');

-- Prisma server access only. No PostgREST client policies are installed.
ALTER TABLE "analytics_sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_audiences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_widgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;

-- Defense in depth: no Data API grants for browser roles on these tables.
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "analytics_sites", "analytics_events", "analytics_audiences", "chat_widgets", "chat_conversations", "chat_messages" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
