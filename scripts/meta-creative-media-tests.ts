import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { safeCreativeAction, safeCreativeCopy, safeMetaCreativeThumbnail } from "../src/lib/social/analytics/meta-creative-media";
import { mergeMetaAdInsightsWithCreatives } from "../src/lib/social/analytics/meta-ad-creative-mapping";

const valid = [
  "https://scontent.xx.fbcdn.net/v/t1/a.jpg?oh=a&oe=b",
  "https://lookaside.fbsbx.com/creative/image.png",
  "https://graph.facebook.com/image.jpg",
  "https://scontent.cdninstagram.com/a.webp",
];
for (const url of valid) assert.equal(safeMetaCreativeThumbnail(url), url, `Meta host should be accepted: ${url}`);
for (const url of [
  "http://scontent.xx.fbcdn.net/x.jpg",
  "https://evilfbcdn.net/x.png",
  "https://fbcdn.net.evil.org/a.jpg",
  "https://127.0.0.1/x",
  "javascript:alert(1)",
  "https://scontent.xx.fbcdn.net/a.jpg?access_token=secret",
  "https://scontent.xx.fbcdn.net/a.jpg?client_secret=secret",
  "https://user:password@graph.facebook.com/x",
  "https://fbcdn.net:8443/x",
  "https://fbcdn.net/a#fragment",
  "https://example.org",
]) assert.equal(safeMetaCreativeThumbnail(url), null, `Unsafe thumbnail must be rejected: ${url}`);
assert.equal(safeMetaCreativeThumbnail(null), null);
assert.equal(safeCreativeCopy("  Good\u0000head\nline  ", 80), "Good head line");
assert.equal(safeCreativeCopy("".padEnd(500, "x"), 140)?.length, 140);
assert.equal(safeCreativeAction("LEARN_MORE"), "LEARN_MORE");
assert.equal(safeCreativeAction("<script>"), null);

const rows = mergeMetaAdInsightsWithCreatives(
  [{ ad_id: "301", ad_name: "Demo", campaign_id: "201", spend: "20" }],
  [{
    id: "301",
    creative: {
      id: "401",
      object_type: "VIDEO",
      name: "Video offer",
      thumbnail_url: "https://scontent.xx.fbcdn.net/pic.jpg",
      title: "Get offer",
      body: "Watch this",
      video_id: "999",
      call_to_action_type: "SHOP_NOW",
    },
  }],
);
assert.equal(rows.length, 1);
assert.equal(rows[0].creativeTitle, "Get offer");
assert.equal(rows[0].creativeBody, "Watch this");
assert.equal(rows[0].creativeThumbnailUrl, "https://scontent.xx.fbcdn.net/pic.jpg");
assert.equal(rows[0].creativeVideoId, "999");
assert.equal(rows[0].creativeCallToAction, "SHOP_NOW");
assert.equal(rows[0].creativeType, "VIDEO");

const missing = mergeMetaAdInsightsWithCreatives(
  [{ ad_id: "301", spend: "20" }],
  [{ id: "301", creative: { id: "401", thumbnail_url: "https://notmeta.example/x.png", video_id: "unsafe/1" } }],
);
assert.equal(missing[0].creativeThumbnailUrl, null);
assert.equal(missing[0].creativeVideoId, null);

const source = readFileSync("src/lib/social/providers/meta-ads-insights.ts", "utf8");
assert(source.includes("creative{id,name,object_type,thumbnail_url,title,body,video_id,call_to_action_type}"));
assert(source.includes("MAX_CREATIVE_REPORT_ROWS"));
const endpoint = readFileSync("src/app/api/social/meta-ads/creatives/route.ts", "utf8");
assert(endpoint.includes("TAKATAK_CREATIVE_INTELLIGENCE_ENABLED"), "server flag retained");
const ui = readFileSync("src/components/social/platforms/meta-ads-subscribed-dashboard.tsx", "utf8");
assert(ui.includes("/api/social/meta-ads/creative-intelligence/capability"), "UI must use live authorization capability");
console.log("PASS sanitized Meta creative gallery metadata, URL allowlist, missing fields and feature gates.");
