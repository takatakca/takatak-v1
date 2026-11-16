/**
 * Meta's Marketing API has a different retirement schedule from Graph API.
 * Keep this separate from the Facebook Pages and Instagram Graph version.
 * As of 2026-11-15, Meta lists Marketing API v25.0 as supported.
 * Source: https://developers.facebook.com/docs/graph-api/changelog/versions/
 */
export const DEFAULT_META_MARKETING_API_VERSION = "v25.0";

/**
 * Fail closed for unknown/deprecated versions; never auto-fallback to v21.
 * Any newer version requires a tested code update before becoming selectable.
 */
export function getMetaMarketingApiVersion(): string {
  const requested = process.env.META_ADS_MARKETING_API_VERSION?.trim();
  if (!requested) return DEFAULT_META_MARKETING_API_VERSION;
  if (requested !== DEFAULT_META_MARKETING_API_VERSION) {
    throw new Error("Unsupported Meta Marketing API version. Use a verified supported version.");
  }
  return requested;
}
