-- CreateTable
CREATE TABLE "user_invitations" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "ProfileRole" NOT NULL DEFAULT 'viewer',
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "tokenHash" TEXT NOT NULL,
    "customPermissions" "PermissionKey"[] DEFAULT ARRAY[]::"PermissionKey"[],
    "deniedPermissions" "PermissionKey"[] DEFAULT ARRAY[]::"PermissionKey"[],
    "invitedByProfileId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_tokenHash_key" ON "user_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "user_invitations_clientId_status_idx" ON "user_invitations"("clientId", "status");

-- CreateIndex
CREATE INDEX "user_invitations_email_status_idx" ON "user_invitations"("email", "status");

-- CreateIndex
CREATE INDEX "user_invitations_expiresAt_idx" ON "user_invitations"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_clientId_email_key" ON "user_invitations"("clientId", "email");

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invitedByProfileId_fkey" FOREIGN KEY ("invitedByProfileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
