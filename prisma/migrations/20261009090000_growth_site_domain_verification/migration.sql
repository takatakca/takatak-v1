-- Growth Suite: website ownership verification before Google data links.
-- Every workspace shares one Google service account, so a GA4 / Search Console
-- identifier alone does not prove ownership. A site gets its own random token
-- (published as a DNS TXT record or a <head> meta tag); Google sources can only
-- be linked once the domain is verified.

-- AlterTable
ALTER TABLE "analytics_sites" ADD COLUMN     "domainVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "verificationToken" TEXT NOT NULL DEFAULT replace((gen_random_uuid())::text, '-'::text, ''::text);

-- Links made before verification existed are dropped; owners re-link after verifying.
UPDATE "analytics_sites" SET "ga4PropertyId" = NULL, "searchConsoleProperty" = NULL
  WHERE "ga4PropertyId" IS NOT NULL OR "searchConsoleProperty" IS NOT NULL;

ALTER TABLE "analytics_sites"
  ADD CONSTRAINT "analytics_sites_verification_token_format" CHECK ("verificationToken" ~ '^[0-9a-f]{32}$');
ALTER TABLE "analytics_sites"
  ADD CONSTRAINT "analytics_sites_google_links_need_verification"
  CHECK (("ga4PropertyId" IS NULL AND "searchConsoleProperty" IS NULL) OR "domainVerifiedAt" IS NOT NULL);
