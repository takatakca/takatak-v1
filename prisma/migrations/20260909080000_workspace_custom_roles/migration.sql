-- Custom workspace roles and per-workspace permission overrides for built-in roles.

CREATE TABLE "workspace_custom_roles" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" "PermissionKey"[] NOT NULL DEFAULT ARRAY[]::"PermissionKey"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_custom_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_custom_roles_clientId_name_key"
ON "workspace_custom_roles"("clientId", "name");

CREATE INDEX "workspace_custom_roles_clientId_idx"
ON "workspace_custom_roles"("clientId");

ALTER TABLE "workspace_custom_roles"
ADD CONSTRAINT "workspace_custom_roles_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "workspace_role_permission_overrides" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "permissions" "PermissionKey"[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_role_permission_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_role_permission_overrides_clientId_role_key"
ON "workspace_role_permission_overrides"("clientId", "role");

ALTER TABLE "workspace_role_permission_overrides"
ADD CONSTRAINT "workspace_role_permission_overrides_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_memberships"
ADD COLUMN "customRoleId" UUID;

CREATE INDEX "client_memberships_customRoleId_idx"
ON "client_memberships"("customRoleId");

ALTER TABLE "client_memberships"
ADD CONSTRAINT "client_memberships_customRoleId_fkey"
FOREIGN KEY ("customRoleId") REFERENCES "workspace_custom_roles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_invitations"
ADD COLUMN "customRoleId" UUID;

CREATE INDEX "user_invitations_customRoleId_idx"
ON "user_invitations"("customRoleId");

ALTER TABLE "user_invitations"
ADD CONSTRAINT "user_invitations_customRoleId_fkey"
FOREIGN KEY ("customRoleId") REFERENCES "workspace_custom_roles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
