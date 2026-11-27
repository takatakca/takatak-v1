-- Per-brand access for team members. Owner-approved for code on 2026-11-27;
-- NOT on the production deploy list: the owner applies it later.
-- No row for a membership means every brand of the workspace (today's behavior).

CREATE TABLE "client_membership_brand_access" (
  "id" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID NOT NULL,
  "createdByProfileId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_membership_brand_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_membership_brand_access_membershipId_businessBrandId_key"
  ON "client_membership_brand_access"("membershipId", "businessBrandId");
CREATE INDEX "client_membership_brand_access_clientId_idx" ON "client_membership_brand_access"("clientId");
CREATE INDEX "client_membership_brand_access_businessBrandId_idx" ON "client_membership_brand_access"("businessBrandId");

ALTER TABLE "client_membership_brand_access"
  ADD CONSTRAINT "client_membership_brand_access_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "client_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_membership_brand_access"
  ADD CONSTRAINT "client_membership_brand_access_businessBrandId_fkey"
  FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Server-only table: no direct access from the Supabase anon/authenticated roles.
ALTER TABLE "client_membership_brand_access" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "client_membership_brand_access" FROM PUBLIC;
REVOKE ALL ON TABLE "client_membership_brand_access" FROM anon;
REVOKE ALL ON TABLE "client_membership_brand_access" FROM authenticated;
