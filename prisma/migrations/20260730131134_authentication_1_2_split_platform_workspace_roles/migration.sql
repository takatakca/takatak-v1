-- Authentication 1.2
-- Separate global platform authority from workspace authority.
--
-- Existing Profile roles:
-- owner/admin remain platform roles.
-- manager/editor/staff/viewer become normal platform users.
--
-- Existing membership and invitation roles are preserved.

CREATE TYPE "PlatformRole" AS ENUM (
  'user',
  'admin',
  'owner'
);

CREATE TYPE "WorkspaceRole" AS ENUM (
  'owner',
  'admin',
  'manager',
  'editor',
  'staff',
  'viewer'
);

ALTER TABLE "profiles"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "client_memberships"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "user_invitations"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "profiles"
ALTER COLUMN "role"
TYPE "PlatformRole"
USING (
  (
    CASE
      WHEN "role"::text = 'owner'
        THEN 'owner'
      WHEN "role"::text = 'admin'
        THEN 'admin'
      ELSE 'user'
    END
  )::"PlatformRole"
);

ALTER TABLE "client_memberships"
ALTER COLUMN "role"
TYPE "WorkspaceRole"
USING (
  ("role"::text)::"WorkspaceRole"
);

ALTER TABLE "user_invitations"
ALTER COLUMN "role"
TYPE "WorkspaceRole"
USING (
  ("role"::text)::"WorkspaceRole"
);

ALTER TABLE "profiles"
ALTER COLUMN "role"
SET DEFAULT 'user'::"PlatformRole";

ALTER TABLE "client_memberships"
ALTER COLUMN "role"
SET DEFAULT 'viewer'::"WorkspaceRole";

ALTER TABLE "user_invitations"
ALTER COLUMN "role"
SET DEFAULT 'viewer'::"WorkspaceRole";

DROP TYPE "ProfileRole";
