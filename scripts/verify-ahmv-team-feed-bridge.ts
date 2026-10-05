import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  normalizeAhmvPublicTeamIds,
  withAhmvPublicTeamIds,
} from "../src/lib/integrations/ahmv-team-feed-admin";
import {
  AHMV_PUBLIC_TEAM_ID_RE,
  ahmvTeamIdFromServiceMetadata,
  ahmvTeamIdsFromMetadata,
  metadataHasAhmvTeamId,
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
  metadata: {
    ahmv: {
      publicTeamIds: ["2025191400017305", "2025191400017103"],
    },
  },
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

  assert.deepEqual(
    ahmvTeamIdsFromMetadata({
      ahmv: {
        publicTeamId: "2025191400017305",
        publicTeamIds: [
          "2025191400017103",
          "bad",
          "2025191400017305",
        ],
      },
    }),
    ["2025191400017103", "2025191400017305"],
  );

  assert.equal(
    metadataHasAhmvTeamId(
      {
        ahmv: {
          publicTeamIds: ["2025191400017305", "2025191400017103"],
        },
      },
      "2025191400017103",
    ),
    true,
  );
  assert.equal(
    metadataHasAhmvTeamId(
      { ahmv: { publicTeamIds: ["2025191400017305"] } },
      "2025191400017103",
    ),
    false,
  );

  assert.equal(
    ahmvTeamIdFromServiceMetadata({
      ahmv: { publicTeamId: "2025191400017305" },
    }),
    "2025191400017305",
  );
  assert.equal(
    ahmvTeamIdFromServiceMetadata({
      ahmv: {
        publicTeamIds: ["2025191400017305", "2025191400017103"],
      },
    }),
    null,
  );
  assert.equal(
    ahmvTeamIdFromServiceMetadata({ ahmv: { publicTeamId: "bad" } }),
    null,
  );
  assert.equal(ahmvTeamIdFromServiceMetadata(null), null);
});

check("admin team tags are exact, unique and editable", () => {
  assert.deepEqual(
    normalizeAhmvPublicTeamIds([
      "2025191400017305",
      "2025191400017103",
      "2025191400017305",
    ]),
    ["2025191400017103", "2025191400017305"],
  );
  assert.equal(
    normalizeAhmvPublicTeamIds(["2025191400017305", "LEAFS VERDUN"]),
    null,
  );

  assert.deepEqual(
    withAhmvPublicTeamIds(
      {
        preserved: true,
        ahmv: {
          publicTeamId: "2025191400017305",
          note: "keep",
        },
      },
      ["2025191400017103"],
    ),
    {
      preserved: true,
      ahmv: {
        note: "keep",
        publicTeamIds: ["2025191400017103"],
      },
    },
  );
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
  assert.match(route, /path: \["ahmv", "publicTeamIds"\]/);
  assert.match(route, /equals: teamId/);
  assert.match(route, /array_contains: \[teamId\]/);
  assert.match(route, /take: 2/);
  assert.match(route, /ambiguous_mapping/);
  assert.match(route, /businessBrandId: service\.businessBrandId/);
  assert.match(route, /metadata: \{[\s\S]*path: \["ahmv", "publicTeamIds"\][\s\S]*array_contains: \[teamId\]/);
  assert.match(route, /take: 20/);
  assert.doesNotMatch(route, /externalObjectId/);
  assert.doesNotMatch(route, /accessToken|refreshToken|providerToken/);

  const adminRoute = readFileSync(
    "src/app/api/admin/ahmv/team-feed/route.ts",
    "utf8",
  );
  assert.match(adminRoute, /requireAdminApiAccess/);
  assert.match(adminRoute, /sourceApplication: "ahmverdun"/);
  assert.match(adminRoute, /teamId: \{ in: teamIds \}/);
  assert.match(adminRoute, /clientId_businessBrandId_serviceType/);
  assert.match(adminRoute, /serviceType: "social_media"/);
  assert.match(adminRoute, /status: "planned"/);
  assert.match(adminRoute, /team_ids_not_mapped_to_service/);
  assert.doesNotMatch(adminRoute, /captionExcerpt.*teamIds|name.*teamIds/i);
});

console.log(`AHMV team feed bridge checks passed: ${checks}`);


check("Team Feed provisioner is fail-closed and never activates billing/providers", () => {
  const provisioner = readFileSync(
    "scripts/provision-ahmv-team-feed.ts",
    "utf8",
  );
  assert.match(provisioner, /EXPECTED_TEAM_COUNT = 24/);
  assert.match(provisioner, /CURRENT_SEASON = "2026-2027"/);
  assert.match(provisioner, /status: "planned"/);
  assert.match(provisioner, /process\.argv\.includes\("--apply"\)/);
  assert.match(provisioner, /Expected exactly one active canonical AHM Verdun brand/);
  assert.match(provisioner, /Refusing to modify existing Team Feed service in status/);
  assert.doesNotMatch(provisioner, /subscription\.(create|update)|socialAccount\.(create|update)|status: "active"/);
});
