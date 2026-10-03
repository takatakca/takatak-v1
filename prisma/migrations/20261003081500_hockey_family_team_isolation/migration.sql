-- AHMV family/team isolation layer.
-- Exact public team IDs are first-class records. No roster data is imported.

CREATE TABLE "hockey_public_teams" (
  "id" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL DEFAULT 'ahmverdun',
  "teamId" TEXT NOT NULL,
  "categorySlug" TEXT,
  "level" TEXT,
  "name" TEXT NOT NULL,
  "seasonCode" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sourceUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hockey_public_teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hockey_families" (
  "id" UUID NOT NULL,
  "ownerIdentityId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL DEFAULT 'ahmverdun',
  "displayName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hockey_families_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_families_status_check"
    CHECK ("status" IN ('active','archived'))
);

CREATE TABLE "hockey_family_members" (
  "id" UUID NOT NULL,
  "familyId" UUID NOT NULL,
  "linkedIdentityId" UUID,
  "memberCode" TEXT NOT NULL,
  "memberType" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hockey_family_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_family_members_type_check"
    CHECK ("memberType" IN ('guardian','child')),
  CONSTRAINT "hockey_family_members_status_check"
    CHECK ("status" IN ('active','inactive'))
);

CREATE TABLE "hockey_family_team_selections" (
  "id" UUID NOT NULL,
  "familyId" UUID NOT NULL,
  "memberId" UUID NOT NULL,
  "publicTeamId" UUID NOT NULL,
  "selectionType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hockey_family_team_selections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_family_team_selections_type_check"
    CHECK ("selectionType" IN ('assigned','favorite'))
);

CREATE UNIQUE INDEX "hockey_public_teams_source_team_key"
  ON "hockey_public_teams"("sourceApplication","teamId");
CREATE INDEX "hockey_public_teams_source_active_idx"
  ON "hockey_public_teams"("sourceApplication","active");
CREATE INDEX "hockey_public_teams_category_level_idx"
  ON "hockey_public_teams"("categorySlug","level");

CREATE UNIQUE INDEX "hockey_families_owner_source_key"
  ON "hockey_families"("ownerIdentityId","sourceApplication");
CREATE INDEX "hockey_families_status_idx"
  ON "hockey_families"("status");

CREATE UNIQUE INDEX "hockey_family_members_member_code_key"
  ON "hockey_family_members"("memberCode");
CREATE UNIQUE INDEX "hockey_family_members_family_identity_key"
  ON "hockey_family_members"("familyId","linkedIdentityId");
CREATE INDEX "hockey_family_members_family_type_status_idx"
  ON "hockey_family_members"("familyId","memberType","status");
CREATE INDEX "hockey_family_members_identity_status_idx"
  ON "hockey_family_members"("linkedIdentityId","status");

CREATE UNIQUE INDEX "hockey_family_team_member_team_type_key"
  ON "hockey_family_team_selections"("memberId","publicTeamId","selectionType");
CREATE INDEX "hockey_family_team_family_type_idx"
  ON "hockey_family_team_selections"("familyId","selectionType");
CREATE INDEX "hockey_family_team_public_team_idx"
  ON "hockey_family_team_selections"("publicTeamId");

ALTER TABLE "hockey_families"
  ADD CONSTRAINT "hockey_families_ownerIdentityId_fkey"
  FOREIGN KEY ("ownerIdentityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hockey_family_members"
  ADD CONSTRAINT "hockey_family_members_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "hockey_families"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_members"
  ADD CONSTRAINT "hockey_family_members_linkedIdentityId_fkey"
  FOREIGN KEY ("linkedIdentityId") REFERENCES "master_identities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hockey_family_team_selections"
  ADD CONSTRAINT "hockey_family_team_selections_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "hockey_families"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_team_selections"
  ADD CONSTRAINT "hockey_family_team_selections_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "hockey_family_members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hockey_family_team_selections"
  ADD CONSTRAINT "hockey_family_team_selections_publicTeamId_fkey"
  FOREIGN KEY ("publicTeamId") REFERENCES "hockey_public_teams"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.hockey_public_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hockey_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hockey_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hockey_family_team_selections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hockey_public_teams FROM PUBLIC;
REVOKE ALL ON TABLE public.hockey_families FROM PUBLIC;
REVOKE ALL ON TABLE public.hockey_family_members FROM PUBLIC;
REVOKE ALL ON TABLE public.hockey_family_team_selections FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.hockey_public_teams FROM anon;
    REVOKE ALL ON TABLE public.hockey_families FROM anon;
    REVOKE ALL ON TABLE public.hockey_family_members FROM anon;
    REVOKE ALL ON TABLE public.hockey_family_team_selections FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.hockey_public_teams FROM authenticated;
    REVOKE ALL ON TABLE public.hockey_families FROM authenticated;
    REVOKE ALL ON TABLE public.hockey_family_members FROM authenticated;
    REVOKE ALL ON TABLE public.hockey_family_team_selections FROM authenticated;
  END IF;
END $$;
