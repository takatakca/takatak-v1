-- ROLLBACK: Growth Suite (branch claude/festive-newton-5i9rv7) database changes.
--
-- Returns a database to the exact schema of `main` before the Growth Suite
-- migrations. Generated with `prisma migrate diff` (branch schema -> main
-- schema) and verified on a disposable database: after this script,
-- `prisma migrate diff --from-url <db> --to-schema-datamodel <main schema>`
-- reports no difference, and the migrations can be applied again.
--
-- WARNING: this DROPS every Growth Suite table and the data in it (reviews,
-- ratings, chat, analytics, AI credits, agent runs, Google connections, plan
-- subscriptions). Take a backup first; see docs/GROWTH_SUITE_ROLLBACK.md.
-- Nothing outside the Growth Suite is touched, except that the four Growth
-- permissions are removed from role/membership permission lists.
--
-- Runs in one transaction: it either fully applies or changes nothing.

BEGIN;

-- 1. Remove the Growth permission values wherever they are stored, so the
--    PermissionKey enum can return to its previous values.
UPDATE "client_memberships" SET "customPermissions" = ARRAY(SELECT p FROM unnest("customPermissions") AS p WHERE p::text NOT IN ('view_reputation', 'manage_reputation', 'view_conversations', 'manage_conversations'));
UPDATE "client_memberships" SET "deniedPermissions" = ARRAY(SELECT p FROM unnest("deniedPermissions") AS p WHERE p::text NOT IN ('view_reputation', 'manage_reputation', 'view_conversations', 'manage_conversations'));
UPDATE "user_invitations" SET "customPermissions" = ARRAY(SELECT p FROM unnest("customPermissions") AS p WHERE p::text NOT IN ('view_reputation', 'manage_reputation', 'view_conversations', 'manage_conversations'));
UPDATE "user_invitations" SET "deniedPermissions" = ARRAY(SELECT p FROM unnest("deniedPermissions") AS p WHERE p::text NOT IN ('view_reputation', 'manage_reputation', 'view_conversations', 'manage_conversations'));
UPDATE "workspace_custom_roles" SET "permissions" = ARRAY(SELECT p FROM unnest("permissions") AS p WHERE p::text NOT IN ('view_reputation', 'manage_reputation', 'view_conversations', 'manage_conversations'));
UPDATE "workspace_role_permission_overrides" SET "permissions" = ARRAY(SELECT p FROM unnest("permissions") AS p WHERE p::text NOT IN ('view_reputation', 'manage_reputation', 'view_conversations', 'manage_conversations'));

-- 2. Schema back to main (generated).
-- AlterEnum
CREATE TYPE "PermissionKey_new" AS ENUM ('view_dashboard', 'manage_clients', 'manage_brands', 'manage_services', 'manage_integrations', 'manage_jobs', 'view_team', 'invite_users', 'manage_users', 'suspend_users', 'delete_users', 'manage_roles', 'manage_permissions', 'view_activity_log', 'view_admin', 'manage_settings', 'create_content', 'edit_content', 'approve_content', 'view_reports', 'view_social', 'manage_social_accounts', 'view_ads', 'manage_ads');
ALTER TABLE "client_memberships" ALTER COLUMN "customPermissions" DROP DEFAULT;
ALTER TABLE "client_memberships" ALTER COLUMN "deniedPermissions" DROP DEFAULT;
ALTER TABLE "user_invitations" ALTER COLUMN "customPermissions" DROP DEFAULT;
ALTER TABLE "user_invitations" ALTER COLUMN "deniedPermissions" DROP DEFAULT;
ALTER TABLE "workspace_custom_roles" ALTER COLUMN "permissions" DROP DEFAULT;
ALTER TABLE "client_memberships" ALTER COLUMN "customPermissions" TYPE "PermissionKey_new"[] USING ("customPermissions"::text::"PermissionKey_new"[]);
ALTER TABLE "client_memberships" ALTER COLUMN "deniedPermissions" TYPE "PermissionKey_new"[] USING ("deniedPermissions"::text::"PermissionKey_new"[]);
ALTER TABLE "user_invitations" ALTER COLUMN "customPermissions" TYPE "PermissionKey_new"[] USING ("customPermissions"::text::"PermissionKey_new"[]);
ALTER TABLE "user_invitations" ALTER COLUMN "deniedPermissions" TYPE "PermissionKey_new"[] USING ("deniedPermissions"::text::"PermissionKey_new"[]);
ALTER TABLE "workspace_custom_roles" ALTER COLUMN "permissions" TYPE "PermissionKey_new"[] USING ("permissions"::text::"PermissionKey_new"[]);
ALTER TABLE "workspace_role_permission_overrides" ALTER COLUMN "permissions" TYPE "PermissionKey_new"[] USING ("permissions"::text::"PermissionKey_new"[]);
ALTER TYPE "PermissionKey" RENAME TO "PermissionKey_old";
ALTER TYPE "PermissionKey_new" RENAME TO "PermissionKey";
DROP TYPE "PermissionKey_old";
ALTER TABLE "client_memberships" ALTER COLUMN "customPermissions" SET DEFAULT ARRAY[]::"PermissionKey"[];
ALTER TABLE "client_memberships" ALTER COLUMN "deniedPermissions" SET DEFAULT ARRAY[]::"PermissionKey"[];
ALTER TABLE "user_invitations" ALTER COLUMN "customPermissions" SET DEFAULT ARRAY[]::"PermissionKey"[];
ALTER TABLE "user_invitations" ALTER COLUMN "deniedPermissions" SET DEFAULT ARRAY[]::"PermissionKey"[];
ALTER TABLE "workspace_custom_roles" ALTER COLUMN "permissions" SET DEFAULT ARRAY[]::"PermissionKey"[];

-- DropForeignKey
ALTER TABLE "review_profiles" DROP CONSTRAINT "review_profiles_clientId_fkey";

-- DropForeignKey
ALTER TABLE "review_profiles" DROP CONSTRAINT "review_profiles_businessBrandId_fkey";

-- DropForeignKey
ALTER TABLE "review_requests" DROP CONSTRAINT "review_requests_clientId_fkey";

-- DropForeignKey
ALTER TABLE "review_requests" DROP CONSTRAINT "review_requests_profileId_fkey";

-- DropForeignKey
ALTER TABLE "review_responses" DROP CONSTRAINT "review_responses_clientId_fkey";

-- DropForeignKey
ALTER TABLE "review_responses" DROP CONSTRAINT "review_responses_profileId_fkey";

-- DropForeignKey
ALTER TABLE "review_responses" DROP CONSTRAINT "review_responses_requestId_fkey";

-- DropForeignKey
ALTER TABLE "ai_credit_accounts" DROP CONSTRAINT "ai_credit_accounts_clientId_fkey";

-- DropForeignKey
ALTER TABLE "ai_credit_entries" DROP CONSTRAINT "ai_credit_entries_clientId_fkey";

-- DropForeignKey
ALTER TABLE "analytics_sites" DROP CONSTRAINT "analytics_sites_clientId_fkey";

-- DropForeignKey
ALTER TABLE "analytics_sites" DROP CONSTRAINT "analytics_sites_businessBrandId_fkey";

-- DropForeignKey
ALTER TABLE "analytics_events" DROP CONSTRAINT "analytics_events_siteId_fkey";

-- DropForeignKey
ALTER TABLE "analytics_events" DROP CONSTRAINT "analytics_events_clientId_fkey";

-- DropForeignKey
ALTER TABLE "analytics_audiences" DROP CONSTRAINT "analytics_audiences_clientId_fkey";

-- DropForeignKey
ALTER TABLE "analytics_audiences" DROP CONSTRAINT "analytics_audiences_siteId_fkey";

-- DropForeignKey
ALTER TABLE "chat_widgets" DROP CONSTRAINT "chat_widgets_clientId_fkey";

-- DropForeignKey
ALTER TABLE "chat_widgets" DROP CONSTRAINT "chat_widgets_businessBrandId_fkey";

-- DropForeignKey
ALTER TABLE "chat_conversations" DROP CONSTRAINT "chat_conversations_clientId_fkey";

-- DropForeignKey
ALTER TABLE "chat_conversations" DROP CONSTRAINT "chat_conversations_widgetId_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_clientId_fkey";

-- DropForeignKey
ALTER TABLE "ai_agent_settings" DROP CONSTRAINT "ai_agent_settings_clientId_fkey";

-- DropForeignKey
ALTER TABLE "ai_agent_runs" DROP CONSTRAINT "ai_agent_runs_clientId_fkey";

-- DropForeignKey
ALTER TABLE "google_business_connections" DROP CONSTRAINT "google_business_connections_clientId_fkey";

-- DropForeignKey
ALTER TABLE "google_business_oauth_states" DROP CONSTRAINT "google_business_oauth_states_clientId_fkey";

-- DropForeignKey
ALTER TABLE "google_business_locations" DROP CONSTRAINT "google_business_locations_clientId_fkey";

-- DropForeignKey
ALTER TABLE "google_business_locations" DROP CONSTRAINT "google_business_locations_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "external_reviews" DROP CONSTRAINT "external_reviews_clientId_fkey";

-- DropForeignKey
ALTER TABLE "external_reviews" DROP CONSTRAINT "external_reviews_locationId_fkey";

-- DropForeignKey
ALTER TABLE "growth_subscriptions" DROP CONSTRAINT "growth_subscriptions_clientId_fkey";

-- DropTable
DROP TABLE "review_profiles";

-- DropTable
DROP TABLE "review_requests";

-- DropTable
DROP TABLE "review_responses";

-- DropTable
DROP TABLE "ai_credit_accounts";

-- DropTable
DROP TABLE "ai_credit_entries";

-- DropTable
DROP TABLE "analytics_sites";

-- DropTable
DROP TABLE "analytics_events";

-- DropTable
DROP TABLE "analytics_audiences";

-- DropTable
DROP TABLE "chat_widgets";

-- DropTable
DROP TABLE "chat_conversations";

-- DropTable
DROP TABLE "chat_messages";

-- DropTable
DROP TABLE "ai_agent_settings";

-- DropTable
DROP TABLE "ai_agent_runs";

-- DropTable
DROP TABLE "google_business_connections";

-- DropTable
DROP TABLE "google_business_oauth_states";

-- DropTable
DROP TABLE "google_business_locations";

-- DropTable
DROP TABLE "external_reviews";

-- DropTable
DROP TABLE "growth_subscriptions";

-- DropTable
DROP TABLE "growth_billing_events";

-- DropEnum
DROP TYPE "ReviewChannel";

-- DropEnum
DROP TYPE "ReviewRequestStatus";

-- DropEnum
DROP TYPE "ReviewFeedbackStatus";

-- DropEnum
DROP TYPE "AiCreditReason";

-- DropEnum
DROP TYPE "AnalyticsEventType";

-- DropEnum
DROP TYPE "ChatConversationStatus";

-- DropEnum
DROP TYPE "ChatSender";

-- DropEnum
DROP TYPE "AiAgentRunStatus";


-- 3. Forget the rolled-back migrations so Prisma's history matches main.
DELETE FROM "_prisma_migrations" WHERE "migration_name" IN (
  '20261009010000_growth_reputation_and_ai_credits',
  '20261009020000_growth_analytics_and_conversations',
  '20261009030000_growth_agents_and_delivery',
  '20261009040000_growth_agent_schedules',
  '20261009050000_growth_review_showcase',
  '20261009060000_growth_google_data_sources',
  '20261009070000_growth_google_business_profile',
  '20261009080000_growth_plan_subscriptions',
  '20261009090000_growth_site_domain_verification'
);

COMMIT;
