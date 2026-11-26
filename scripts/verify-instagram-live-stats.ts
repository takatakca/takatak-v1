// Instagram network dashboard on real Instagram numbers: the Graph API answers
// are parsed safely, period sums never invent a number, and the token stays
// in the server file (Authorization header, never in a URL).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  communityFromLive,
  competitorRow,
  csvCell,
  normalizeInstagramUsername,
  parseBusinessDiscovery,
  dailyInteractions,
  hashtagsFromMedia,
  mediaInRange,
  mediaTypeBreakdown,
  parseInsightBreakdown,
  parseInsightSeries,
  parseInsightTotals,
  parseInstagramMedia,
  summarizeMedia,
  toCsv,
  type InstagramLiveStats,
} from "../src/lib/social/instagram-live-stats";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

const mediaPage = {
  data: [
    {
      id: "1",
      caption: "Brunch du dimanche #Montreal #brunch",
      media_type: "IMAGE",
      media_product_type: "FEED",
      timestamp: "2026-11-20T15:00:00+0000",
      permalink: "https://www.instagram.com/p/abc/",
      like_count: 40,
      comments_count: 5,
      insights: { data: [{ name: "reach", values: [{ value: 500 }] }, { name: "views", values: [{ value: 900 }] }, { name: "saved", values: [{ value: 3 }] }, { name: "shares", values: [{ value: 2 }] }] },
    },
    {
      id: "2",
      caption: "Nouveau menu #montreal",
      media_type: "VIDEO",
      media_product_type: "REELS",
      timestamp: "2026-11-22T18:00:00+0000",
      permalink: "javascript:alert(1)",
      like_count: 100,
      comments_count: 10,
      insights: { data: [{ name: "reach", total_value: { value: 1500 } }, { name: "views", total_value: { value: 3000 } }] },
    },
    { id: "3", caption: "story", media_type: "IMAGE", media_product_type: "STORY", timestamp: "2026-11-23T10:00:00+0000" },
    { id: "", caption: "broken" },
    { id: "4", caption: "", media_type: "CAROUSEL_ALBUM", media_product_type: "FEED", timestamp: "2026-09-01T10:00:00+0000", like_count: 7 },
  ],
};
const media = parseInstagramMedia(mediaPage);

check("media parser keeps feed posts and reels, skips stories and broken rows", () => {
  assert.deepEqual(media.map((m) => m.id), ["1", "2", "4"]);
  assert.equal(media[0].kind, "post");
  assert.equal(media[1].kind, "reel");
  assert.equal(media[0].reach, 500);
  assert.equal(media[1].views, 3000);
  assert.equal(media[2].comments, null, "a missing count stays unknown, not 0");
});

check("only https permalinks are kept", () => {
  assert.equal(media[0].permalink, "https://www.instagram.com/p/abc/");
  assert.equal(media[1].permalink, null);
});

check("period filter is inclusive and by kind", () => {
  assert.equal(mediaInRange(media, "2026-11-01", "2026-11-26").length, 2);
  assert.equal(mediaInRange(media, "2026-11-01", "2026-11-26", "reel").length, 1);
  assert.equal(mediaInRange(media, "2026-11-20", "2026-11-20").length, 1);
});

check("summary sums what Instagram gave and computes engagement on reach", () => {
  const posts = mediaInRange(media, "2026-11-01", "2026-11-26", "post");
  const s = summarizeMedia(posts, 26);
  assert.equal(s.count, 1);
  assert.equal(s.likes, 40);
  assert.equal(s.interactions, 50);
  assert.equal(s.averageReach, 500);
  assert.equal(s.engagementRate, 10);
  assert.equal(s.likesPerComment, 8);
});

check("an empty period is a real zero, a missing metric is null", () => {
  const empty = summarizeMedia([], 30);
  assert.equal(empty.count, 0);
  assert.equal(empty.likes, 0);
  assert.equal(empty.averageReach, null);
  const old = summarizeMedia(media.filter((m) => m.id === "4"), 30);
  assert.equal(old.comments, null);
  assert.equal(old.views, null);
  assert.equal(old.engagementRate, null);
});

check("daily interactions cover every day of the period", () => {
  const series = dailyInteractions(media, "2026-11-19", "2026-11-23");
  assert.equal(series.length, 5);
  assert.equal(series[1].value, 50);
  assert.equal(series[3].value, 110);
  assert.equal(series[0].value, 0);
});

check("hashtags are read from captions, case-insensitive, one count per post", () => {
  const tags = hashtagsFromMedia(media);
  assert.deepEqual(tags[0], { tag: "#montreal", posts: 2, interactions: 160 });
  assert.equal(tags.find((t) => t.tag === "#brunch")?.posts, 1);
});

check("media types break down by count and views", () => {
  const types = mediaTypeBreakdown(media);
  assert.equal(types.length, 3);
  assert.equal(types.find((t) => t.type === "VIDEO")?.views, 3000);
});

check("insight series and totals are parsed, days stamped by their own date", () => {
  const series = parseInsightSeries(
    { data: [{ name: "follower_count", values: [{ value: 4, end_time: "2026-11-21T08:00:00+0000" }, { value: "x", end_time: "2026-11-22T08:00:00+0000" }] }] },
    "follower_count",
  );
  assert.deepEqual(series, [{ date: "2026-11-20", value: 4 }]);
  assert.deepEqual(parseInsightTotals({ data: [{ name: "views", total_value: { value: 1200 } }, { name: "likes" }] }), { views: 1200 });
  const split = parseInsightBreakdown(
    { data: [{ name: "follows_and_unfollows", total_value: { breakdowns: [{ results: [{ dimension_values: ["FOLLOWER"], value: 12 }, { dimension_values: ["NON_FOLLOWER"], value: 3 }] }] } }] },
    "follows_and_unfollows",
  );
  assert.deepEqual(split, { FOLLOWER: 12, NON_FOLLOWER: 3 });
  assert.deepEqual(parseInsightTotals(null), {});
  assert.deepEqual(parseInstagramMedia({ error: { message: "x" } }), []);
});

const stats: InstagramLiveStats = {
  fetchedAt: "2026-11-26T09:00:00.000Z",
  username: "resto",
  followers: 1200,
  following: 80,
  mediaCount: 140,
  media,
  account: {
    since: "2026-10-28",
    until: "2026-11-26",
    reachSeries: [],
    newFollowersSeries: [{ date: "2026-11-20", value: 4 }, { date: "2026-11-21", value: 6 }],
    views: null,
    accountsEngaged: null,
    totalInteractions: null,
    likes: null,
    comments: null,
    saves: null,
    shares: null,
    profileLinksTaps: null,
    follows: 10,
    unfollows: 2,
  },
  missing: [],
};

check("community numbers come from the live profile and new-follower days", () => {
  const c = communityFromLive(stats, "2026-10-28", "2026-11-26");
  assert.equal(c.followers, 1200);
  assert.equal(c.following, 80);
  assert.equal(c.totalContent, 140);
  assert.equal(c.acquired, 10);
  assert.equal(c.lost, 2);
  assert.equal(c.dailyPosts, Math.round((2 / 30) * 100) / 100);
});

check("over 30 days the new-follower sum is not shown (Instagram keeps 30 days)", () => {
  const c = communityFromLive(stats, "2026-08-29", "2026-11-26");
  assert.equal(c.acquired, null);
  assert.equal(c.lost, null);
  assert.equal(c.followers, 1200);
});

check("CSV cells are quoted and protected from formulas", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell('a "b", c'), '"a ""b"", c"');
  assert.equal(csvCell(-5), "-5");
  assert.equal(csvCell(null), "");
  assert.equal(toCsv(["a", "b"], [[1, "x"]]), "a,b\n1,x\n");
});

check("the token stays server-side, in the Authorization header", () => {
  const fetcher = readFileSync("src/lib/social/providers/instagram-live-fetch.ts", "utf8");
  assert.match(fetcher, /^import "server-only";/);
  assert.match(fetcher, /authorization: `Bearer \$\{credential\.accessToken\}`/);
  assert.doesNotMatch(fetcher, /searchParams\.set\("access_token"/);
  assert.match(fetcher, /clientId: options\.clientId/, "the account is read inside the workspace only");
  const panels = readFileSync("src/components/social/platforms/instagram-live-panels.tsx", "utf8");
  assert.doesNotMatch(panels, /accessToken/);
});

check("the dashboard uses the live numbers and every table button works", () => {
  const dashboard = readFileSync("src/components/social/platforms/instagram-subscribed-dashboard.tsx", "utf8");
  assert.match(dashboard, /communityFromLive\(live, start, end\)/);
  assert.match(dashboard, /<InstagramLiveMediaSection stats=\{live\} kind="post"/);
  assert.match(dashboard, /<InstagramLiveMediaSection stats=\{live\} kind="reel"/);
  assert.match(dashboard, /<InstagramLiveAccountSection stats=\{live\} \/>/);
  assert.doesNotMatch(dashboard, /aria-label="Choose reels table columns"/);
  const page = readFileSync("src/app/dashboard/social/[platform]/page.tsx", "utf8");
  assert.match(page, /loadInstagramLiveStats\(\{\s*clientId: access\.activeClientId,/);
});


check("competitor usernames are validated before they reach the Graph field", () => {
  assert.equal(normalizeInstagramUsername("@Resto.Montreal"), "resto.montreal");
  assert.equal(normalizeInstagramUsername("https://www.instagram.com/cafe_ndg/"), "cafe_ndg");
  assert.equal(normalizeInstagramUsername("a){id}"), null);
  assert.equal(normalizeInstagramUsername("bad..name"), null);
  assert.equal(normalizeInstagramUsername(".lead"), null);
  assert.equal(normalizeInstagramUsername("x".repeat(31)), null);
});

check("business discovery is parsed and a competitor's period is summed", () => {
  const found = parseBusinessDiscovery({
    business_discovery: {
      id: "178",
      username: "cafe_ndg",
      name: "Café NDG",
      followers_count: 2000,
      media_count: 300,
      media: { data: [
        { id: "a", caption: "Latte", media_type: "IMAGE", timestamp: "2026-11-20T10:00:00+0000", like_count: 90, comments_count: 10 },
        { id: "b", caption: "Old", media_type: "IMAGE", timestamp: "2026-01-20T10:00:00+0000", like_count: 5, comments_count: 0 },
      ] },
    },
  });
  assert.ok(found);
  assert.equal(found.followers, 2000);
  const row = competitorRow("igc_x", found, "2026-10-28", "2026-11-26");
  assert.equal(row.postsInPeriod, 1);
  assert.equal(row.interactions, 100);
  assert.equal(row.engagementRate, 5);
  assert.equal(parseBusinessDiscovery({}), null);
});

check("competitor routes check permissions and keep Instagram ids server-side", () => {
  const route = readFileSync("src/app/api/social/instagram/competitors/route.ts", "utf8");
  assert.match(route, /requireWorkspaceApiPermission\("view_social"\)/);
  assert.equal((route.match(/requireWorkspaceApiPermission\("manage_social_accounts"\)/g) ?? []).length, 2);
  assert.doesNotMatch(route, /externalPageId|account\.id\b|id: row\.account\.id/);
  const lib = readFileSync("src/lib/social/providers/instagram-competitors.ts", "utf8");
  assert.match(lib, /normalizeInstagramUsername\(options\.username\)/);
  assert.match(lib, /platform: "instagram"/);
});

console.log(`${passed} Instagram live checks passed`);
