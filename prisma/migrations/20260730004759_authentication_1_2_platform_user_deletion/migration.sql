-- DropForeignKey
ALTER TABLE "user_invitations" DROP CONSTRAINT "user_invitations_invitedByProfileId_fkey";

-- AlterTable
ALTER TABLE "user_invitations" ALTER COLUMN "invitedByProfileId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invitedByProfileId_fkey" FOREIGN KEY ("invitedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
