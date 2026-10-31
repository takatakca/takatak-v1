// REVEW: product capabilities are separate from account/API connection status.
// Documentation links identify primary references; a URL is not live API proof.
export type ReviewSourceKind =
  "stars" | "recommendations" | "social" | "partner";
export type ReviewSource = {
  id: string;
  name: string;
  kind: ReviewSourceKind;
  delivery:
    "native_v1" | "counterpart_api" | "provider_approval" | "social_module";
  read: string;
  reply: string;
  publication: string;
  docs: string;
  route: string;
};

export const REVIEW_SOURCES: readonly ReviewSource[] = [
  {
    id: "takatak",
    name: "TAKATAK feedback",
    kind: "stars",
    delivery: "native_v1",
    read: "Consented first-party feedback in the active workspace.",
    reply: "Existing feedback follow-up and AI draft workflow.",
    publication: "Public showcase requires publication consent.",
    docs: "https://github.com/takatakca/takatak-v1/blob/main/docs/TAKATAK_GROWTH_SUITE.md",
    route: "/dashboard/growth/reviews",
  },
  {
    id: "google",
    name: "Google Business Profile",
    kind: "stars",
    delivery: "native_v1",
    read: "Existing per-workspace OAuth, verified locations and imported reviews.",
    reply: "Existing Google reply action; provider acceptance is required.",
    publication:
      "Imported data is private to the workspace; public redistribution requires provider terms.",
    docs: "https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews",
    route: "/dashboard/growth/reviews",
  },
  {
    id: "qmaps",
    name: "QMAPS",
    kind: "stars",
    delivery: "native_v1",
    read: "Existing signed QMAPS events and linked business reviews.",
    reply:
      "Existing signed QMAPS reply adapter; a saved draft is not a published reply.",
    publication: "Owner/source consent and QMAPS moderation rules apply.",
    docs: "https://github.com/takatakca/qmaps/blob/main/docs/takatak-integration.md",
    route: "/dashboard/local-listings/reviews",
  },
  {
    id: "flexs",
    name: "FLEXS",
    kind: "stars",
    delivery: "counterpart_api",
    read: "Native verified customer reviews exist; scoped export/event API requested from flexsca.",
    reply:
      "Counterpart must specify supported owner-reply and moderation capabilities.",
    publication:
      "Do not expose lead contacts, documents or private matching data in review feeds.",
    docs: "https://github.com/takatakca/flexsca/blob/main/docs/FLEXS_ECOSYSTEM_INTEGRATION.md",
    route: "/dashboard/leads",
  },
  {
    id: "facebook",
    name: "Facebook Recommendations",
    kind: "recommendations",
    delivery: "provider_approval",
    read: "Page ratings/recommendations require approved Meta access and a workspace-owned Page.",
    reply:
      "Verify supported response surfaces, scopes and Page permissions before enabling.",
    publication:
      "Recommendations remain recommendations; never convert them into invented star ratings.",
    docs: "https://developers.facebook.com/docs/graph-api/reference/page/ratings/",
    route: "/dashboard/social",
  },
  {
    id: "instagram",
    name: "Instagram",
    kind: "social",
    delivery: "social_module",
    read: "Comments, mentions and conversations belong to the existing Social module.",
    reply: "Use the existing authorized Social reply/moderation workflows.",
    publication: "No native Google-style business star-review API is claimed.",
    docs: "https://developers.facebook.com/docs/instagram-platform/",
    route: "/dashboard/social",
  },
  {
    id: "yelp",
    name: "Yelp",
    kind: "stars",
    delivery: "provider_approval",
    read: "Review excerpts/content availability depend on the approved Yelp product and license.",
    reply:
      "Do not infer owner reply access from a content API key; account/photo restrictions apply.",
    publication:
      "Respect source display, storage and solicitation rules; no public widget reuse by default.",
    docs: "https://docs.developer.yelp.com/reference/v3_business_reviews",
    route: "/dashboard/growth/reviews",
  },
  {
    id: "tripadvisor",
    name: "Tripadvisor",
    kind: "stars",
    delivery: "provider_approval",
    read: "Licensed Content API/partner coverage must be verified for each location.",
    reply:
      "A content subscription does not establish management-response API access.",
    publication:
      "Attribution, caching and content rights follow the approved agreement.",
    docs: "https://tripadvisor-content-api.readme.io/reference/overview",
    route: "/dashboard/growth/reviews",
  },
  {
    id: "trustpilot",
    name: "Trustpilot",
    kind: "stars",
    delivery: "provider_approval",
    read: "Business-unit reviews through the appropriate approved API product.",
    reply:
      "Business/OAuth permission and the applicable paid product must be verified separately.",
    publication:
      "Display/invitation rights require the appropriate commercial agreement.",
    docs: "https://developers.trustpilot.com/",
    route: "/dashboard/growth/reviews",
  },
  {
    id: "google_play",
    name: "Google Play",
    kind: "stars",
    delivery: "provider_approval",
    read: "Reviews of developer-owned Android apps through Android Publisher.",
    reply:
      "Owned application and authorized developer/service-account access required.",
    publication: "App reviews remain distinct from business/location reviews.",
    docs: "https://developers.google.com/android-publisher/api-ref/rest/v3/reviews",
    route: "/dashboard/growth/reviews",
  },
  {
    id: "app_store",
    name: "Apple App Store",
    kind: "stars",
    delivery: "provider_approval",
    read: "Customer reviews of owned apps through App Store Connect.",
    reply:
      "Authorized App Store Connect roles and response endpoints required.",
    publication: "App reviews remain distinct from business/location reviews.",
    docs: "https://developer.apple.com/documentation/appstoreconnectapi/customer-reviews",
    route: "/dashboard/growth/reviews",
  },
  {
    id: "booking",
    name: "Booking.com",
    kind: "partner",
    delivery: "provider_approval",
    read: "Hospitality partner connectivity and property authorization are required.",
    reply: "Only documented partner response capabilities may be enabled.",
    publication: "No open general-purpose management API is assumed.",
    docs: "https://developers.booking.com/",
    route: "/dashboard/growth/reviews",
  },
];

export function reviewSource(id: string): ReviewSource | undefined {
  return REVIEW_SOURCES.find((source) => source.id === id);
}

export function observedSource(id: string): string {
  if (id === "google_business") return "google";
  return reviewSource(id)?.id ?? "other";
}
