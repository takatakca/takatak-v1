import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AHMV_PUBLIC_TEAM_ID_RE,
  ahmvTeamIdFromServiceMetadata,
  bearerMatches,
  publicAhmvFeedItem,
  resolveAhmvTeamFeedAccess,
  type AhmvMappedService,
} from "../src/lib/integrations/ahmv-team-feed";

let checks = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    checks += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const paidService: AhmvMappedService = {
  clientId: "00000000-0000-4000-8000-000000000001",
  businessBrandId: "00000000-0000-4000-8000-000000000002",
  status: "active",
  metadata: { ahmv: { publicTeamId: "2025191400017305" } },
  businessBrand: { status: "active" },
  client: {
    subscription: {
      status: "active",
      planCode: "social_essential_1",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2027-01-01T00:00:00Z"),
      xAccountAllowance: 0,
      advancedAnalytics: false,
    },
  },
};

check("exact public AHMV team ids only", () => {
  assert.equal(AHMV_PUBLIC_TEAM_ID_RE.test("2025191400017305"), true);
  assert.equal(AHMV_PUBLIC_TEAM_ID_RE.test("2025191400017305x"), false);
  assert.equal(AHMV_PUBLIC_TEAM_ID_RE.test("../other-team"), false);
  assert.equal(
    ahmvTeamIdFromServiceMetadata({
      ahmv: { publicTeamId: "2025191400017305" },
    }),
    "2025191400017305",
  );
  assert.equal(
    ahmvTeamIdFromServiceMetadata({ ahmv: { publicTeamId: "bad" } }),
    null,
  );
  assert.equal(ahmvTeamIdFromServiceMetadata(null), null);
});

check("bearer token comparison fails closed", () => {
  const token = "01234567890123456789012345678901";
  assert.equal(bearerMatches(`Bearer ${token}`, token), true);
  assert.equal(bearerMatches("Bearer wrong", token), false);
  assert.equal(bearerMatches(null, token), false);
  assert.equal(bearerMatches(`Bearer ${token}`, "short"), false);
});

check("paid active social service grants feed access", () => {
  assert.equal(resolveAhmvTeamFeedAccess(paidService), "ready");
});

check("blocked or missing social subscription is rejected", () => {
  assert.equal(
    resolveAhmvTeamFeedAccess({
      ...paidService,
      client: {
        subscription: {
          ...paidService.client.subscription!,
          status: "paused",
        },
      },
    }),
    "subscription_required",
  );
  assert.equal(
    resolveAhmvTeamFeedAccess({
      ...paidService,
      client: { subscription: null },
    }),
    "subscription_required",
  );
});

check("inactive service or brand cannot publish feed", () => {
  assert.equal(
    resolveAhmvTeamFeedAccess({ ...paidService, status: "paused" }),
    "unavailable",
  );
  assert.equal(
    resolveAhmvTeamFeedAccess({
      ...paidService,
      businessBrand: { status: "frozen" },
    }),
    "unavailable",
  );
});

check("public feed item exposes only approved fields", () => {
  const safe = publicAhmvFeedItem({
    externalIdHash: "opaque-hash",
    publishedAt: new Date("2026-10-03T12:00:00Z"),
    captionExcerpt: "Public update",
    permalinkUrl: "https://facebook.com/example",
    thumbnailUrl: "https://cdn.example.com/photo.jpg",
    socialAccount: { platform: "facebook" },
  });

  assert.deepEqual(safe, {
    id: "opaque-hash",
    platform: "facebook",
    publishedAt: "2026-10-03T12:00:00.000Z",
    text: "Public update",
    url: "https://facebook.com/example",
    mediaUrl: "https://cdn.example.com/photo.jpg",
  });

  for (const row of [
    {
      externalIdHash: "bad-http",
      publishedAt: new Date(),
      captionExcerpt: null,
      permalinkUrl: "http://facebook.com/example",
      thumbnailUrl: null,
      socialAccount: { platform: "facebook" },
    },
    {
      externalIdHash: "bad-userinfo",
      publishedAt: new Date(),
      captionExcerpt: null,
      permalinkUrl: "https://user:pass@example.com/post",
      thumbnailUrl: null,
      socialAccount: { platform: "facebook" },
    },
    {
      externalIdHash: "bad-platform",
      publishedAt: new Date(),
      captionExcerpt: null,
      permalinkUrl: "https://example.com/post",
      thumbnailUrl: null,
      socialAccount: { platform: "threads" },
    },
  ]) {
    assert.equal(publicAhmvFeedItem(row), null);
  }
});

check("route fails closed and scopes mapping at database boundary", () => {
  const route = readFileSync(
    "src/app/api/integrations/ahmv/team-feed/route.ts",
    "utf8",
  );
  assert.match(route, /AHMV_TEAM_FEED_ENABLED/);
  assert.match(route, /AHMV_TEAM_FEED_SHARED_TOKEN/);
  assert.match(route, /x-ahmv-team-id/);
  assert.match(route, /path: \["ahmv", "publicTeamId"\]/);
  assert.match(route, /equals: teamId/);
  assert.match(route, /take: 2/);
  assert.match(route, /ambiguous_mapping/);
  assert.match(route, /businessBrandId: service\.businessBrandId/);
  assert.match(route, /take: 20/);
  assert.doesNotMatch(route, /externalObjectId/);
  assert.doesNotMatch(route, /accessToken|refreshToken|providerToken/);
});

console.log(`AHMV team feed bridge checks passed: ${checks}`);
