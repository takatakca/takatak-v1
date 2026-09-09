-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "upmindClientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "profiles_upmindClientId_key" ON "profiles"("upmindClientId");
