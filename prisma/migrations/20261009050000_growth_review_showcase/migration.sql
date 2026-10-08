-- Growth Suite: review showcase consent. A customer's comment and first name
-- are shown publicly only when they explicitly opt in; owners can hide any entry.

-- AlterTable
ALTER TABLE "review_responses" ADD COLUMN     "hiddenFromShowcase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishConsent" BOOLEAN NOT NULL DEFAULT false;


CREATE INDEX "review_responses_profileId_publishConsent_idx" ON "review_responses"("profileId", "publishConsent");
