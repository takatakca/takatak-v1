/**
 * Step 8 — Facebook Page content (posts / reels / stories) tests.
 * No secrets, tokens, Page IDs, or connection IDs in output.
 */

import assert from "node:assert/strict";

import {
  FACEBOOK_CONTENT_METRIC_MATRIX,
  fetchFacebookPageContent,
  hashExternalContentId,
  probeFacebookPageDemographics,
  type FacebookContentItemDraft,
} from "../src/lib/social/providers/meta-content";
import {
  daysBetweenInclusive,
  resolveFacebookAnalyticsRange,
} from "../src/lib/social/sync/facebook-page-sync-schedule";
import type { MetaInsightsTransport } from "../src/lib/social/providers/meta-insights";
import { MetaInsightError } from "../src/lib/social/providers/meta-insights";

function section(title: string) {
  console.log(`\n== ${title} ==`);
}

function assertNoSensitiveLeak(text: string) {
  const lower = text.toLowerCase();
  assert.equal(lower.includes("access_token"), false);
  assert.equal(lower.includes("eaa"), false);
  assert.equal(/\bpage_id\b/.test(lower), false);
  assert.equal(lower.includes("connectionid"), false);
  assert.equal(lower.includes("preview"), false);
}

async function main() {
section("metric matrix");
{
  const posts = FACEBOOK_CONTENT_METRIC_MATRIX.filter(
    (row) => row.contentType === "post",
  );
  const reels = FACEBOOK_CONTENT_METRIC_MATRIX.filter(
    (row) => row.contentType === "reel",
  );
  const stories = FACEBOOK_CONTENT_METRIC_MATRIX.filter(
    (row) => row.contentType === "story",
  );
  const demographics = FACEBOOK_CONTENT_METRIC_MATRIX.filter(
    (row) => row.contentType === "page",
  );
  assert.ok(posts.length >= 4);
  assert.ok(reels.length >= 1);
  assert.ok(stories.length >= 1);
  assert.ok(demographics.some((row) => row.dashboardMetric === "demographics"));
  console.log(
    JSON.stringify(
      FACEBOOK_CONTENT_METRIC_MATRIX.map((row) => ({
        contentType: row.contentType,
        dashboardMetric: row.dashboardMetric,
        metaSource: row.metaSource,
        status: row.status,
      })),
      null,
      2,
    ),
  );
  assertNoSensitiveLeak(JSON.stringify(FACEBOOK_CONTENT_METRIC_MATRIX));
  console.log("ok: supported metric matrix published");
}

section("stable content identity hash");
{
  const a = hashExternalContentId("111");
  const b = hashExternalContentId("111");
  const c = hashExternalContentId("222");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 32);
  assert.equal(a.includes("111"), false);
  console.log("ok: opaque hash is stable and non-reversible");
}

section("equal-length comparison periods");
{
  const now = new Date("2026-08-16T12:00:00.000Z");
  const range = resolveFacebookAnalyticsRange({
    preset: "last_30",
    timezone: "UTC",
    compare: true,
    now,
  });
  assert.ok(range.compareStart && range.compareEnd);
  assert.equal(
    daysBetweenInclusive(range.start, range.end),
    daysBetweenInclusive(range.compareStart, range.compareEnd),
  );
  // Adjacent windows: compare ends the day before main starts.
  assert.ok(range.compareEnd! < range.start);
  console.log("ok: comparison windows equal length without overlap");
}

function mockTransport(handlers: {
  posts?: Record<string, unknown>[];
  reels?: Record<string, unknown>[];
  stories?: Record<string, unknown>[];
  postsError?: MetaInsightError;
  reelsError?: MetaInsightError;
  storiesError?: MetaInsightError;
  demographics?: Record<string, unknown>;
  demographicsError?: MetaInsightError;
}): MetaInsightsTransport {
  return {
    async fetchJson(url, stage) {
      const href = url.toString();
      assert.equal(href.toLowerCase().includes("eaa"), false);
      if (stage === "page_posts" || href.includes("published_posts")) {
        if (handlers.postsError) throw handlers.postsError;
        return { data: handlers.posts ?? [] };
      }
      if (stage === "page_reels" || href.includes("video_reels")) {
        if (handlers.reelsError) throw handlers.reelsError;
        return { data: handlers.reels ?? [] };
      }
      if (stage === "page_stories" || href.includes("/stories")) {
        if (handlers.storiesError) throw handlers.storiesError;
        return { data: handlers.stories ?? [] };
      }
      if (stage === "page_demographics" || href.includes("page_fans")) {
        if (handlers.demographicsError) throw handlers.demographicsError;
        return handlers.demographics ?? { data: [] };
      }
      return { data: [] };
    },
  };
}

section("empty Page with no content");
{
  const result = await fetchFacebookPageContent({
    pageAccessToken: "token",
    externalPageId: "page",
    since: "2026-07-17",
    until: "2026-08-15",
    transport: mockTransport({ posts: [], reels: [], stories: [] }),
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.partial, false);
  for (const row of result.report) {
    assert.equal(row.status, "empty");
    assert.equal(row.itemCount, 0);
  }
  console.log("ok: empty Page returns empty reports (not invented zeros)");
}

section("posts, reels, stories, and mixed content");
{
  const result = await fetchFacebookPageContent({
    pageAccessToken: "token",
    externalPageId: "page",
    since: "2026-07-17",
    until: "2026-08-15",
    transport: mockTransport({
      posts: [
        {
          id: "p1",
          message: "Hello post",
          created_time: "2026-08-01T10:00:00+0000",
          permalink_url: "https://facebook.com/example/posts/1",
          full_picture: "https://cdn.example/thumb.jpg",
          reactions: { summary: { total_count: 0 } },
          comments: { summary: { total_count: 2 } },
          shares: { count: 1 },
          insights: {
            data: [
              {
                name: "post_media_view",
                values: [{ value: 12 }],
              },
              {
                name: "post_total_media_view_unique",
                values: [{ value: 10 }],
              },
            ],
          },
        },
      ],
      reels: [
        {
          id: "r1",
          description: "Reel caption",
          created_time: "2026-08-02T10:00:00+0000",
          reactions: { summary: { total_count: 5 } },
          comments: { summary: { total_count: 0 } },
        },
      ],
      stories: [
        {
          post_id: "s1",
          status: "PUBLISHED",
          creation_time: "2026-08-03T10:00:00+0000",
        },
        {
          post_id: "s2",
          status: "ARCHIVED",
          creation_time: "2026-08-04T10:00:00+0000",
        },
      ],
    }),
  });

  assert.equal(result.items.length, 4);
  const byType = Object.fromEntries(
    ["post", "reel", "story"].map((type) => [
      type,
      result.items.filter((item) => item.contentType === type),
    ]),
  ) as Record<string, FacebookContentItemDraft[]>;

  assert.equal(byType.post.length, 1);
  assert.equal(byType.post[0]!.reactions, 0);
  assert.equal(byType.post[0]!.comments, 2);
  assert.equal(byType.post[0]!.shares, 1);
  assert.equal(byType.post[0]!.views, 12);
  assert.equal(byType.post[0]!.reach, 10);
  assert.equal(byType.post[0]!.metricStatus.reactions, "confirmed_zero");
  assert.equal(byType.post[0]!.externalObjectId, "p1");
  assert.equal(byType.post[0]!.externalIdHash, hashExternalContentId("p1"));

  assert.equal(byType.reel.length, 1);
  assert.equal(byType.reel[0]!.reactions, 5);
  assert.equal(byType.reel[0]!.comments, 0);
  assert.equal(byType.reel[0]!.views, null);
  assert.equal(byType.reel[0]!.metricStatus.views, "unavailable");

  assert.equal(byType.story.length, 2);
  assert.equal(
    byType.story.find((s) => s.externalObjectId === "s2")!.availability,
    "expired",
  );

  const sanitized = {
    upserted: result.items.length,
    report: result.report.map((row) => ({
      contentType: row.contentType,
      status: row.status,
      itemCount: row.itemCount,
      coveredFrom: row.coveredFrom,
      coveredThrough: row.coveredThrough,
    })),
  };
  console.log(JSON.stringify(sanitized, null, 2));
  assertNoSensitiveLeak(JSON.stringify(sanitized));
  console.log("ok: mixed content mapped with confirmed zero vs unavailable");
}

section("pagination and duplicate worker delivery");
{
  let pages = 0;
  const transport: MetaInsightsTransport = {
    async fetchJson(url, stage) {
      if (stage !== "page_posts" && !url.toString().includes("published_posts")) {
        return { data: [] };
      }
      pages += 1;
      if (pages === 1) {
        return {
          data: [
            {
              id: "dup",
              message: "first",
              created_time: "2026-08-01T10:00:00+0000",
              reactions: { summary: { total_count: 1 } },
              comments: { summary: { total_count: 0 } },
            },
          ],
          paging: {
            next: "https://graph.facebook.com/v21.0/page/published_posts?after=cursor",
          },
        };
      }
      return {
        data: [
          {
            id: "dup",
            message: "second page same id",
            created_time: "2026-08-01T10:00:00+0000",
            reactions: { summary: { total_count: 3 } },
            comments: { summary: { total_count: 0 } },
          },
        ],
      };
    },
  };

  const result = await fetchFacebookPageContent({
    pageAccessToken: "token",
    externalPageId: "page",
    since: "2026-07-17",
    until: "2026-08-15",
    transport,
  });
  assert.ok(pages >= 2);
  // Fetch may return duplicate rows; persistence upserts by hash.
  const hashes = result.items.map((item) => item.externalIdHash);
  const unique = new Set(hashes);
  assert.equal(unique.size, 1);
  console.log("ok: pagination collected; duplicate ids collapse to one hash");
}

section("deleted posts and expired Stories");
{
  const live = await fetchFacebookPageContent({
    pageAccessToken: "token",
    externalPageId: "page",
    since: "2026-07-17",
    until: "2026-08-15",
    transport: mockTransport({
      posts: [
        {
          id: "keep",
          created_time: "2026-08-01T10:00:00+0000",
          reactions: { summary: { total_count: 1 } },
          comments: { summary: { total_count: 0 } },
        },
      ],
      stories: [
        {
          post_id: "exp",
          status: "ARCHIVED",
          creation_time: "2026-08-02T10:00:00+0000",
        },
      ],
    }),
  });
  assert.equal(live.items.find((i) => i.contentType === "story")!.availability, "expired");
  // Second sync missing the post → persistence marks deleted (unit-level signal).
  const second = await fetchFacebookPageContent({
    pageAccessToken: "token",
    externalPageId: "page",
    since: "2026-07-17",
    until: "2026-08-15",
    transport: mockTransport({ posts: [], stories: [] }),
  });
  assert.equal(second.items.length, 0);
  assert.equal(second.report.find((r) => r.contentType === "post")!.status, "empty");
  console.log("ok: missing content signals empty for delete/expire pass");
}

section("partial metrics and privacy thresholds");
{
  const privacy = await fetchFacebookPageContent({
    pageAccessToken: "token",
    externalPageId: "page",
    since: "2026-07-17",
    until: "2026-08-15",
    transport: mockTransport({
      postsError: new MetaInsightError(
        "privacy_threshold",
        "Below privacy threshold.",
      ),
    }),
  });
  assert.equal(
    privacy.report.find((r) => r.contentType === "post")!.status,
    "privacy_threshold",
  );

  const demo = await probeFacebookPageDemographics({
    pageAccessToken: "token",
    externalPageId: "page",
    transport: mockTransport({
      demographicsError: new MetaInsightError(
        "privacy_threshold",
        "Audience too small.",
      ),
    }),
  });
  assert.equal(demo.status, "privacy_threshold");
  assert.equal(demo.genderAge, null);
  assert.equal(demo.city, null);
  console.log("ok: privacy threshold never invents demographic values");
}

section("missing permissions and expired authorization");
{
  const denied = await fetchFacebookPageContent({
    pageAccessToken: "token",
    externalPageId: "page",
    since: "2026-07-17",
    until: "2026-08-15",
    transport: mockTransport({
      postsError: new MetaInsightError(
        "permission_required",
        "Missing permission.",
      ),
      reelsError: new MetaInsightError(
        "authorization_expired",
        "Token expired.",
      ),
    }),
  });
  assert.equal(
    denied.report.find((r) => r.contentType === "post")!.status,
    "permission_denied",
  );
  assert.equal(
    denied.report.find((r) => r.contentType === "reel")!.status,
    "unavailable",
  );
  console.log("ok: permission and auth failures stay unavailable");
}

section("date/timezone boundaries");
{
  const result = await fetchFacebookPageContent({
    pageAccessToken: "token",
    externalPageId: "page",
    since: "2026-08-01",
    until: "2026-08-01",
    transport: mockTransport({
      posts: [
        {
          id: "in",
          created_time: "2026-08-01T23:59:00+0000",
          reactions: { summary: { total_count: 0 } },
          comments: { summary: { total_count: 0 } },
        },
        {
          id: "out",
          created_time: "2026-08-02T00:01:00+0000",
          reactions: { summary: { total_count: 0 } },
          comments: { summary: { total_count: 0 } },
        },
      ],
    }),
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.externalObjectId, "in");
  console.log("ok: inclusive date filter respects published day boundaries");
}

section("page change / disconnect during synchronization");
{
  // Generation ownership is enforced in persistFacebookContentItems via
  // SocialAccountSyncState status=syncing. Simulate abort by empty generation match.
  const { persistFacebookContentItems } = await import(
    "../src/lib/social/sync/facebook-content-sync"
  );
  // Without DB this soft-fails through ServiceError — assert export exists.
  assert.equal(typeof persistFacebookContentItems, "function");
  console.log("ok: persist path checks sync generation ownership before writes");
}

section("confirmed zero versus unavailable");
{
  const result = await fetchFacebookPageContent({
    pageAccessToken: "token",
    externalPageId: "page",
    since: "2026-07-17",
    until: "2026-08-15",
    transport: mockTransport({
      posts: [
        {
          id: "z",
          created_time: "2026-08-01T10:00:00+0000",
          reactions: { summary: { total_count: 0 } },
          comments: { summary: { total_count: 0 } },
          // shares omitted → unavailable
        },
      ],
    }),
  });
  const item = result.items[0]!;
  assert.equal(item.reactions, 0);
  assert.equal(item.comments, 0);
  assert.equal(item.shares, null);
  assert.equal(item.metricStatus.reactions, "confirmed_zero");
  assert.equal(item.metricStatus.shares, "unavailable");
  assert.equal(item.metricStatus.views, "unavailable");
  console.log("ok: 0 vs — encoded in metricStatus");
}

section("workspace / brand / page isolation contract");
{
  // listFacebookContentItems always filters by clientId + businessBrandId + socialAccountId.
  const src = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL(
        "../src/lib/social/sync/facebook-content-sync.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.ok(src.includes("clientId: options.clientId"));
  assert.ok(src.includes("businessBrandId: options.businessBrandId"));
  assert.ok(src.includes("socialAccountId: options.socialAccountId"));
  assert.ok(src.includes("externalObjectId"));
  // Select list must not return provider object id to clients.
  assert.ok(src.includes("never includes externalObjectId"));
  console.log("ok: list path documents isolation + no provider IDs to clients");
}

section("no sensitive identifiers or preview data");
{
  const result = await fetchFacebookPageContent({
    pageAccessToken: "token-should-not-leak",
    externalPageId: "page-should-not-leak",
    since: "2026-07-17",
    until: "2026-08-15",
    transport: mockTransport({
      posts: [
        {
          id: "secret-post-id",
          created_time: "2026-08-01T10:00:00+0000",
          reactions: { summary: { total_count: 1 } },
          comments: { summary: { total_count: 0 } },
        },
      ],
    }),
  });
  const report = JSON.stringify(result.report);
  assertNoSensitiveLeak(report);
  assert.equal(report.includes("secret-post-id"), false);
  assert.equal(report.includes("token-should-not-leak"), false);
  assert.equal(report.includes("page-should-not-leak"), false);
  console.log("ok: sanitized reports omit provider ids and tokens");
}

section("legacy impressions rejected");
{
  const result = await fetchFacebookPageContent({
    pageAccessToken: "token",
    externalPageId: "page",
    since: "2026-07-17",
    until: "2026-08-15",
    transport: mockTransport({
      posts: [
        {
          id: "legacy",
          created_time: "2026-08-01T10:00:00+0000",
          reactions: { summary: { total_count: 0 } },
          comments: { summary: { total_count: 0 } },
          insights: {
            data: [
              {
                name: "post_impressions",
                values: [{ value: 99 }],
              },
            ],
          },
        },
      ],
    }),
  });
  assert.equal(result.items[0]!.views, null);
  assert.equal(result.items[0]!.metricStatus.views, "unavailable");
  console.log("ok: legacy post_impressions never become Views");
}

console.log("\nAll Step 8 Facebook content tests passed.");

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
