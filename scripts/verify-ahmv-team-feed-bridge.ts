import assert from "node:assert/strict";
import {
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

check("extract exact AHMV team id", () => {
  assert.equal(
    ahmvTeamIdFromServiceMetadata({ ahmv: { publicTeamId: "2025191400017305" } }),
    "2025191400017305",
  );
  assert.equal(ahmvTeamIdFromServiceMetadata({ ahmv: { publicTeamId: "bad" } }), null);
  assert.equal(ahmvTeamIdFromServiceMetadata(null), null);
});

check("bearer token comparison fails closed", () => {
  const token = "01234567890123456789012345678901";
  assert.equal(bearerMatches(`Bearer ${token}`, token), true);
  assert.equal(bearerMatches("Bearer wrong", token), false);
  assert.equal(bearerMatches(null, token), false);
  assert.equal(bearerMatches(`Bearer ${token}`, "short"), false);
});

check("paid active service grants feed access", () => {
  assert.equal(resolveAhmvTeamFeedAccess(paidService), "ready");
});

check("blocked subscription is rejected", () => {
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
});

check("inactive service or brand cannot publish feed", () => {
  assert.equal(resolveAhmvTeamFeedAccess({ ...paidService, status: "paused" }), "unavailable");
  assert.equal(
    resolveAhmvTeamFeedAccess({ ...paidService, businessBrand: { status: "frozen" } }),
    "unavailable",
  );
});

check("public feed item strips unsafe fields and URLs", () => {
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

  assert.equal(
    publicAhmvFeedItem({
      externalIdHash: "bad",
      publishedAt: new Date(),
      captionExcerpt: null,
      permalinkUrl: "http://facebook.com/example",
      thumbnailUrl: null,
      socialAccount: { platform: "facebook" },
    }),
    null,
  );

  assert.equal(
    publicAhmvFeedItem({
      externalIdHash: "bad-platform",
      publishedAt: new Date(),
      captionExcerpt: null,
      permalinkUrl: "https://example.com/post",
      thumbnailUrl: null,
      socialAccount: { platform: "threads" },
    }),
    null,
  );
});

console.log(`AHMV team feed bridge checks passed: ${checks}`);
