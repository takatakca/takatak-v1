CREATE TYPE "InvitationStatus" AS ENUM (
  'pending',
  'accepted',
  'expired',
  'revoked'
);

CREATE TYPE "MembershipStatus" AS ENUM (
  'active',
  'suspended'
);

CREATE TYPE "PermissionKey" AS ENUM (
  'view_dashboard',
  'manage_clients',
  'manage_brands',
  'manage_services',
  'manage_integrations',
  'manage_jobs',
  'view_team',
  'invite_users',
  'manage_users',
  'suspend_users',
  'delete_users',
  'manage_roles',
  'manage_permissions',
  'view_activity_log',
  'view_admin',
  'manage_settings',
  'create_content',
  'edit_content',
  'approve_content',
  'view_reports'
);

ALTER TABLE "client_memberships"
ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "customPermissions" "PermissionKey"[] NOT NULL DEFAULT ARRAY[]::"PermissionKey"[],
ADD COLUMN "deniedPermissions" "PermissionKey"[] NOT NULL DEFAULT ARRAY[]::"PermissionKey"[],
ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "client_memberships"
SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP);

ALTER TABLE "client_memberships"
ALTER COLUMN "updatedAt" SET NOT NULL;

DROP INDEX IF EXISTS "client_memberships_clientId_idx";

CREATE INDEX "client_memberships_clientId_status_idx"
ON "client_memberships"("clientId", "status");

CREATE INDEX "client_memberships_profileId_status_idx"
ON "client_memberships"("profileId", "status");
