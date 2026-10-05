-- AHMV family guardian invitations.
-- Bearer invitation tokens are never stored in plaintext; only SHA-256 hashes
-- live in the database. A TAKATAK authenticated identity is still required to
-- accept an invitation.

CREATE TABLE "hockey_family_invites" (
  "id" UUID NOT NULL,
  "familyId" UUID NOT NULL,
  "inviterIdentityId" UUID NOT NULL,
  "acceptedIdentityId" UUID,
  "tokenHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'guardian',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hockey_family_invites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_family_invites_role_check"
    CHECK ("role" IN ('guardian')),
  CONSTRAINT "hockey_family_invites_status_check"
    CHECK ("status" IN ('pending','accepted','revoked','expired'))
);

CREATE UNIQUE INDEX "hockey_family_invites_token_hash_key"
  ON "hockey_family_invites"("tokenHash");
CREATE INDEX "hockey_family_invites_family_status_expires_idx"
  ON "hockey_family_invites"("familyId","status","expiresAt");
CREATE INDEX "hockey_family_invites_inviter_status_idx"
  ON "hockey_family_invites"("inviterIdentityId","status");
CREATE INDEX "hockey_family_invites_accepted_identity_idx"
  ON "hockey_family_invites"("acceptedIdentityId");

ALTER TABLE "hockey_family_invites"
  ADD CONSTRAINT "hockey_family_invites_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "hockey_families"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hockey_family_invites"
  ADD CONSTRAINT "hockey_family_invites_inviterIdentityId_fkey"
  FOREIGN KEY ("inviterIdentityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hockey_family_invites"
  ADD CONSTRAINT "hockey_family_invites_acceptedIdentityId_fkey"
  FOREIGN KEY ("acceptedIdentityId") REFERENCES "master_identities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.hockey_family_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hockey_family_invites FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.hockey_family_invites FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.hockey_family_invites FROM authenticated;
  END IF;
END $$;
