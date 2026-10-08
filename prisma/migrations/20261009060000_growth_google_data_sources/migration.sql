-- Growth Suite: link a tracked website to its Google Analytics 4 property and
-- Search Console property. Identifiers only; credentials stay in server env.

-- AlterTable
ALTER TABLE "analytics_sites" ADD COLUMN     "ga4PropertyId" TEXT,
ADD COLUMN     "searchConsoleProperty" TEXT;


ALTER TABLE "analytics_sites"
  ADD CONSTRAINT "analytics_sites_ga4_property_format" CHECK ("ga4PropertyId" IS NULL OR "ga4PropertyId" ~ '^[0-9]{6,15}$');
ALTER TABLE "analytics_sites"
  ADD CONSTRAINT "analytics_sites_search_console_format" CHECK ("searchConsoleProperty" IS NULL OR "searchConsoleProperty" ~ '^(sc-domain:[a-z0-9.-]+|https://[^\s]+/)$');
