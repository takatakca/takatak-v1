import "server-only";

/**
 * Step 7 — documented Facebook Page metric mapping.
 *
 * Dashboard label → Meta source → storage/derivation notes.
 * Unavailable metrics must render as —, never fabricated zeros.
 */

export const FACEBOOK_GRAPH_API_VERSION_DOC = "v21.0";

export const FACEBOOK_PAGE_METRIC_MAPPING = [
  {
    dashboardKey: "lifetime_followers",
    dashboardLabel: "Lifetime followers",
    metaField: "followers_count|fan_count",
    period: "point_in_time",
    aggregation: "latest_confirmed_snapshot_in_range",
    status: "supported",
    notes:
      "Page identity field stamped on the latest synced insight day only. Not daily growth. Never label as generic “Followers” when Acquired/Lost/Net are also shown.",
  },
  {
    dashboardKey: "followers_acquired",
    dashboardLabel: "Acquired",
    metaField: "page_daily_follows_unique|page_daily_follows",
    period: "day",
    aggregation: "sum_over_selected_range",
    status: "probe_then_fetch",
    notes:
      "Fetched when Graph accepts the metric and credential has insights permission. Otherwise distinct unsupported/permission/empty state. Never invent from lifetime total.",
  },
  {
    dashboardKey: "followers_lost",
    dashboardLabel: "Lost",
    metaField: "page_daily_unfollows_unique|page_daily_unfollows",
    period: "day",
    aggregation: "sum_over_selected_range",
    status: "probe_then_fetch",
    notes:
      "Fetched when Graph accepts the metric and credential has insights permission. Otherwise distinct unsupported/permission/empty state. Never invent from lifetime total.",
  },
  {
    dashboardKey: "growth_net_followers",
    dashboardLabel: "Net follower change",
    metaField: null,
    period: "derived",
    aggregation: "end_lifetime_minus_start_lifetime",
    status: "derived_when_both_ends_confirmed",
    notes:
      "Only when both covered range endpoints have confirmed lifetime snapshots. Otherwise — (never 0).",
  },
  {
    dashboardKey: "impressions",
    dashboardLabel: "Views",
    metaField: "page_media_view",
    period: "day",
    aggregation: "sum_over_selected_range",
    status: "supported",
    notes:
      "Growth “Views” requires attested daily page_media_view (metadata.fields.impressions). Legacy page_engagement_day impressions without that field are NOT Views — do not sum them as a fallback. Period totals may only sum attested daily rows; never invent daily series from a period-only figure.",
  },
  {
    dashboardKey: "reach",
    dashboardLabel: "Unique media views",
    metaField: "page_total_media_view_unique",
    period: "day",
    aggregation: "sum_over_selected_range",
    status: "supported",
    notes:
      "Replaces deprecated page_impressions_unique. Not shown as Growth “Views”.",
  },
  {
    dashboardKey: "page_visits",
    dashboardLabel: "Page visits",
    metaField: "page_views_total",
    period: "day",
    aggregation: "sum_over_selected_range",
    status: "probe_then_fetch",
    notes:
      "Fetched when Graph accepts page_views_total. Distinct unsupported/permission/empty states. Never invent.",
  },
  {
    dashboardKey: "total_content",
    dashboardLabel: "Total content",
    metaField: "published_posts",
    period: "day",
    aggregation: "count_published_posts_in_range",
    status: "probe_then_fetch",
    notes:
      "Counted from Page published_posts edge for the range. Store per-day publish counts with provenance.",
  },
  {
    dashboardKey: "reactions",
    dashboardLabel: "Reactions",
    metaField: "published_posts.reactions.summary",
    period: "day",
    aggregation: "sum_post_reaction_totals_in_range",
    status: "probe_then_fetch",
    notes:
      "Sum of post reaction totals when reactions.summary is permitted. Otherwise unavailable — not zero.",
  },
  {
    dashboardKey: "engagement",
    dashboardLabel: "Engagement",
    metaField: "published_posts.reactions.summary",
    period: "day",
    aggregation: "sum_post_reaction_totals_in_range",
    status: "probe_then_fetch",
    notes:
      "page_post_engagements retired. Post reaction summaries used when permitted; otherwise unavailable.",
  },
  {
    dashboardKey: "demographics",
    dashboardLabel: "Demographics",
    metaField: null,
    period: null,
    aggregation: null,
    status: "unavailable",
    notes:
      "Requires additional insights permissions/fields and privacy thresholds.",
  },
  {
    dashboardKey: "posts",
    dashboardLabel: "Posts",
    metaField: null,
    period: null,
    aggregation: null,
    status: "unavailable",
    notes: "Post-level edges not wired in Step 7 Page media-view sync.",
  },
  {
    dashboardKey: "reels",
    dashboardLabel: "Reels",
    metaField: null,
    period: null,
    aggregation: null,
    status: "unavailable",
    notes: "Reels insights not wired in Step 7 Page media-view sync.",
  },
  {
    dashboardKey: "stories",
    dashboardLabel: "Stories",
    metaField: null,
    period: null,
    aggregation: null,
    status: "unavailable",
    notes: "Stories insights not wired in Step 7 Page media-view sync.",
  },
] as const;

export type FacebookDashboardMetricKey =
  (typeof FACEBOOK_PAGE_METRIC_MAPPING)[number]["dashboardKey"];

export function getFacebookMetricMapping(
  key: FacebookDashboardMetricKey,
) {
  return (
    FACEBOOK_PAGE_METRIC_MAPPING.find((row) => row.dashboardKey === key) ??
    null
  );
}
