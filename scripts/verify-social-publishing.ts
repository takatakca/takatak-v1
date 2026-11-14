// Social publishing engine: pure model, Facebook and Instagram adapters with a
// fake transport, and the durable worker against an in-memory database.
// Run: npm run qa:social-publishing
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Deterministic key so the worker can decrypt a credential it encrypted itself
// (the dispatch path is exercised end to end; no provider is contacted).
process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 ??= "0".repeat(63) + "1";
process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION ??= "1";

import {
  classifyFacebookPublishFailure,
  publishFacebookPagePost,
  reconcileFacebookPagePost,
  type FacebookPublishTransport,
} from "../src/lib/social/publishing/facebook-page-publisher";
import {
  classifyInstagramPublishFailure,
  publishInstagramMedia,
  reconcileInstagramMedia,
  validateInstagramPublishInput,
  type InstagramPublishTransport,
} from "../src/lib/social/publishing/instagram-publisher";
import {
  applyApprovalDecision,
  assessPublicationReadiness,
  canQueuePublication,
  isVideoMediaUrl,
  parseScheduleRequest,
  publicationBackoffMs,
  readPublicationReceipt,
  withPublicationReceipt,
  INSTAGRAM_CAPTION_LIMIT,
  SOCIAL_PUBLICATION_RECEIPT_VERSION,
} from "../src/lib/social/publishing/publication-model";
import {
  INSTAGRAM_OAUTH_PERMISSION_PUBLISH,
  INSTAGRAM_OAUTH_PUBLISHING_SCOPES,
  INSTAGRAM_OAUTH_START_SCOPES,
  buildInstagramAuthorizationUrl,
  resolveInstagramOAuthScopes,
} from "../src/lib/social/providers/instagram-oauth";
import {
  buildSocialCredentialAad,
  encryptSocialTokenPayload,
} from "../src/lib/social/security/social-crypto";
import { accountPublishReady, chooseHandoffAccount } from "../src/lib/ai/handoff";
import { assessTokenHealth, describeConnectionCapabilities } from "../src/lib/social/connections/capability-profile";
import {
  isSocialPublicationJobMetadata,
  publicationContentHash,
  processSocialPublicationJob,
  queueSocialPostPublication,
  type PublicationDb,
} from "../src/lib/social/publishing/publication-jobs";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`ok ${name}`);
    });
}

async function main() {
const NOW = new Date("2026-11-06T20:00:00.000Z");
const PAGE_ID = "123456789012345";
const PAGE_TOKEN = "EAAB-page-token-never-logged";

// ── pure model ────────────────────────────────────────

  await check("content hash is stable and sensitive to caption, link and media", () => {
  const a = publicationContentHash({ caption: "Bonjour\r\nMontréal ", link: null, mediaUrls: [] });
  const b = publicationContentHash({ caption: "Bonjour\nMontréal", link: null, mediaUrls: [] });
  assert.equal(a, b);
  assert.notEqual(a, publicationContentHash({ caption: "Bonjour\nMontréal", link: "https://takatak.ca", mediaUrls: [] }));
  assert.notEqual(a, publicationContentHash({ caption: "Bonjour\nMontréal", mediaUrls: ["https://x/y.jpg"] }));
});

  await check("a malformed receipt is ignored and a valid one round-trips", () => {
  assert.equal(readPublicationReceipt({ publication: { state: "confirmed" } }), null);
  assert.equal(readPublicationReceipt({ publication: { version: 1, attemptId: "a", state: "nope" } }), null);
  const receipt = {
    version: SOCIAL_PUBLICATION_RECEIPT_VERSION,
    attemptId: "11111111-1111-4111-8111-111111111111",
    jobId: null,
    state: "confirmed" as const,
    provider: "meta" as const,
    platform: "facebook" as const,
    targetExternalId: PAGE_ID,
    contentHash: "a".repeat(64),
    startedAt: NOW.toISOString(),
    confirmedAt: NOW.toISOString(),
    remotePostId: `${PAGE_ID}_1`,
    permalinkUrl: "https://www.facebook.com/1",
    errorCategory: null,
    errorMessage: null,
    attempts: 1,
  };
  const metadata = withPublicationReceipt({ source: "ai_studio" }, receipt);
  assert.equal(metadata.source, "ai_studio");
  assert.deepEqual(readPublicationReceipt(metadata), receipt);
});

  await check("readiness refuses unscheduled, unapproved, foreign-platform and in-flight posts", () => {
  const base = { status: "scheduled", scheduledAt: NOW, publishedAt: null, caption: "Hello", platform: "facebook", socialAccountId: "acc", metadata: null };
  assert.deepEqual(assessPublicationReadiness({ post: base, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: true, receipt: null });
  assert.equal(assessPublicationReadiness({ post: { ...base, status: "approved" }, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }).ok, false);
  assert.deepEqual(assessPublicationReadiness({ post: base, latestApprovalStatus: "rejected", approvalsRequired: true, now: NOW }), { ok: false, reason: "approval_not_approved" });
  assert.deepEqual(assessPublicationReadiness({ post: base, latestApprovalStatus: null, approvalsRequired: true, now: NOW }), { ok: false, reason: "approval_missing" });
  assert.deepEqual(assessPublicationReadiness({ post: { ...base, platform: "tiktok" }, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: false, reason: "unsupported_platform" });
  assert.deepEqual(assessPublicationReadiness({ post: { ...base, status: "blocked_by_plan" }, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: false, reason: "blocked_by_plan" });
  assert.deepEqual(assessPublicationReadiness({ post: { ...base, caption: "   " }, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: false, reason: "empty_caption" });
  const sending = withPublicationReceipt(null, {
    version: 1, attemptId: "a", jobId: null, state: "sending", provider: "meta", platform: "facebook", targetExternalId: PAGE_ID,
    contentHash: "b".repeat(64), startedAt: new Date(NOW.getTime() - 10_000).toISOString(), confirmedAt: null, remotePostId: null,
    permalinkUrl: null, errorCategory: null, errorMessage: null, attempts: 1,
  });
  assert.deepEqual(assessPublicationReadiness({ post: { ...base, metadata: sending }, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: false, reason: "publication_in_flight" });
  const stale = assessPublicationReadiness({ post: { ...base, metadata: sending }, latestApprovalStatus: "approved", approvalsRequired: true, now: new Date(NOW.getTime() + 600_000) });
  assert.equal(stale.ok, true);
});

  await check("Instagram readiness requires one public media URL and a 2,200-character caption", () => {
    const ig = { status: "scheduled", scheduledAt: NOW, publishedAt: null, caption: "Bonjour", platform: "instagram", socialAccountId: "acc", metadata: null };
    assert.deepEqual(assessPublicationReadiness({ post: ig, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: false, reason: "media_required" });
    assert.deepEqual(assessPublicationReadiness({ post: { ...ig, mediaUrls: ["http://insecure/a.jpg"] }, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: false, reason: "media_required" });
    assert.deepEqual(assessPublicationReadiness({ post: { ...ig, mediaUrls: ["https://cdn.takatak.ca/a.jpg"] }, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: true, receipt: null });
    assert.deepEqual(assessPublicationReadiness({ post: { ...ig, mediaUrls: ["https://cdn.takatak.ca/a.jpg"], caption: "x".repeat(INSTAGRAM_CAPTION_LIMIT + 1) }, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: false, reason: "caption_too_long" });
    // Facebook keeps its own limit and never needs media.
    const fb = { ...ig, platform: "facebook", caption: "x".repeat(INSTAGRAM_CAPTION_LIMIT + 1) };
    assert.deepEqual(assessPublicationReadiness({ post: fb, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: true, receipt: null });
    assert.equal(isVideoMediaUrl("https://cdn.takatak.ca/reel.mp4?x=1"), true);
    assert.equal(isVideoMediaUrl("https://cdn.takatak.ca/a.jpg"), false);
    // An Instagram receipt round-trips; a mismatched provider/platform pair is ignored.
    const receipt = {
      version: SOCIAL_PUBLICATION_RECEIPT_VERSION, attemptId: "22222222-2222-4222-8222-222222222222", jobId: null, state: "confirmed" as const,
      provider: "instagram" as const, platform: "instagram" as const, targetExternalId: "1784", contentHash: "c".repeat(64), startedAt: NOW.toISOString(),
      confirmedAt: NOW.toISOString(), remotePostId: "1790", permalinkUrl: "https://www.instagram.com/p/abc/", errorCategory: null, errorMessage: null, attempts: 1,
    };
    assert.deepEqual(readPublicationReceipt(withPublicationReceipt(null, receipt)), receipt);
    assert.equal(readPublicationReceipt({ publication: { ...receipt, provider: "meta" } }), null);
  });

  await check("approval decisions move the post honestly", () => {
  assert.deepEqual(applyApprovalDecision({ decision: "approve", currentApprovalStatus: "pending", currentPostStatus: "pending_approval", scheduledAt: null }), { ok: true, approvalStatus: "approved", postStatus: "approved" });
  assert.deepEqual(applyApprovalDecision({ decision: "approve", currentApprovalStatus: "pending", currentPostStatus: "pending_approval", scheduledAt: NOW }), { ok: true, approvalStatus: "approved", postStatus: "scheduled" });
  assert.deepEqual(applyApprovalDecision({ decision: "reject", currentApprovalStatus: "pending", currentPostStatus: "pending_approval", scheduledAt: null }), { ok: true, approvalStatus: "rejected", postStatus: "draft" });
  assert.deepEqual(applyApprovalDecision({ decision: "approve", currentApprovalStatus: "approved", currentPostStatus: "approved", scheduledAt: null }), { ok: false, reason: "approval_closed" });
  assert.deepEqual(applyApprovalDecision({ decision: "reject", currentApprovalStatus: "pending", currentPostStatus: "published", scheduledAt: null }), { ok: false, reason: "post_not_reviewable" });
});

  await check("schedule requests are bounded to the future and one year", () => {
  assert.deepEqual(parseScheduleRequest({ mode: "now" }, NOW), { mode: "now" });
  assert.equal(parseScheduleRequest({ mode: "schedule", scheduledAt: "2020-01-01T00:00:00Z" }, NOW), null);
  assert.equal(parseScheduleRequest({ mode: "schedule", scheduledAt: "2030-01-01T00:00:00Z" }, NOW), null);
  assert.equal(parseScheduleRequest({ mode: "schedule", scheduledAt: "not a date" }, NOW), null);
  assert.deepEqual(parseScheduleRequest({ mode: "schedule", scheduledAt: "2026-11-07T09:00:00.000Z" }, NOW), { mode: "schedule", scheduledAt: new Date("2026-11-07T09:00:00.000Z") });
  assert.equal(parseScheduleRequest("now", NOW), null);
});

  await check("queue policy and backoff", () => {
  assert.deepEqual(canQueuePublication({ postStatus: "approved", latestApprovalStatus: "approved", approvalsRequired: true }), { ok: true });
  assert.deepEqual(canQueuePublication({ postStatus: "published", latestApprovalStatus: "approved", approvalsRequired: true }), { ok: false, reason: "already_published" });
  assert.deepEqual(canQueuePublication({ postStatus: "pending_approval", latestApprovalStatus: "pending", approvalsRequired: true }), { ok: false, reason: "approval_not_approved" });
  assert.deepEqual(canQueuePublication({ postStatus: "draft", latestApprovalStatus: null, approvalsRequired: false }), { ok: true });
  assert.ok(publicationBackoffMs(1) >= 27_000 && publicationBackoffMs(1) <= 33_000);
  assert.ok(publicationBackoffMs(10) <= 15 * 60_000 * 1.1);
});

  await check("job metadata guard", () => {
  assert.equal(isSocialPublicationJobMetadata({ source: "social_publication_v1", version: 1, clientId: "c", socialPostId: "p", requestedByProfileId: null, requestedAt: "x" }), true);
  assert.equal(isSocialPublicationJobMetadata({ source: "facebook_sync", version: 1 }), false);
});

// ── Facebook adapter ──────────────────────────────────

type Call = { method: string; url: string; form: Record<string, string> | null; headers: Record<string, string> };
function fakeTransport(handler: (call: Call) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }>) {
  const calls: Call[] = [];
  const transport: FacebookPublishTransport = async (request) => {
    const call: Call = {
      method: request.method,
      url: request.url.toString(),
      form: request.form ? Object.fromEntries(request.form.entries()) : null,
      headers: request.headers,
    };
    calls.push(call);
    return handler(call);
  };
  return { transport, calls };
}

  await check("Graph errors are classified by Meta error code", () => {
  assert.equal(classifyFacebookPublishFailure(400, { error: { code: 190, message: "expired" } }).category, "authorization_expired");
  assert.equal(classifyFacebookPublishFailure(403, { error: { code: 200, message: "perm" } }).category, "permission_denied");
  assert.equal(classifyFacebookPublishFailure(400, { error: { code: 10, message: "perm" } }).category, "permission_denied");
  assert.deepEqual(classifyFacebookPublishFailure(429, {}).retryable, true);
  assert.equal(classifyFacebookPublishFailure(400, { error: { code: 4 } }).category, "rate_limited");
  assert.equal(classifyFacebookPublishFailure(503, {}).category, "provider_unavailable");
  assert.equal(classifyFacebookPublishFailure(400, { error: { code: 100, message: "bad param" } }).category, "invalid_content");
  assert.equal(classifyFacebookPublishFailure(400, { error: { code: 100, message: "bad param" } }).retryable, false);
});

  await check("a feed post sends the token in the body, verifies and returns the remote id", async () => {
  const { transport, calls } = fakeTransport((call) => {
    if (call.method === "POST") return { status: 200, body: { id: `${PAGE_ID}_777` } };
    return { status: 200, body: { id: `${PAGE_ID}_777`, permalink_url: "https://www.facebook.com/777", is_published: true } };
  });
  const result = await publishFacebookPagePost({ pageId: PAGE_ID, pageAccessToken: PAGE_TOKEN, message: "  Bonjour  ", link: "https://takatak.ca" }, transport);
  assert.deepEqual(result, { ok: true, remotePostId: `${PAGE_ID}_777`, permalinkUrl: "https://www.facebook.com/777", verified: true });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, new RegExp(`/${PAGE_ID}/feed$`));
  assert.equal(calls[0].form?.message, "Bonjour");
  assert.equal(calls[0].form?.link, "https://takatak.ca");
  assert.equal(calls[0].form?.access_token, PAGE_TOKEN);
  assert.ok(!calls[0].url.includes(PAGE_TOKEN), "token never in URL");
  assert.equal(calls[1].headers.authorization, `Bearer ${PAGE_TOKEN}`);
  assert.ok(!calls[1].url.includes(PAGE_TOKEN));
});

  await check("a photo post uses /photos and prefers post_id", async () => {
  const { transport, calls } = fakeTransport((call) =>
    call.method === "POST" ? { status: 200, body: { id: "photo1", post_id: `${PAGE_ID}_888` } } : { status: 200, body: { id: `${PAGE_ID}_888` } },
  );
  const result = await publishFacebookPagePost({ pageId: PAGE_ID, pageAccessToken: PAGE_TOKEN, message: "Photo", photoUrl: "https://cdn.takatak.ca/a.jpg" }, transport);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.remotePostId, `${PAGE_ID}_888`);
  assert.match(calls[0].url, /\/photos$/);
  assert.equal(calls[0].form?.url, "https://cdn.takatak.ca/a.jpg");
});

  await check("invalid inputs never reach Meta", async () => {
  const { transport, calls } = fakeTransport(() => ({ status: 200, body: {} }));
  const empty = await publishFacebookPagePost({ pageId: PAGE_ID, pageAccessToken: PAGE_TOKEN, message: "" }, transport);
  const badLink = await publishFacebookPagePost({ pageId: PAGE_ID, pageAccessToken: PAGE_TOKEN, message: "x", link: "http://insecure" }, transport);
  const noToken = await publishFacebookPagePost({ pageId: PAGE_ID, pageAccessToken: "", message: "x" }, transport);
  assert.equal(empty.ok, false);
  assert.equal(badLink.ok, false);
  assert.equal(noToken.ok, false);
  if (!noToken.ok) assert.equal(noToken.category, "not_configured");
  assert.equal(calls.length, 0);
});

  await check("a timeout is reported as ambiguous and retryable", async () => {
  const { transport } = fakeTransport(() => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  });
  const result = await publishFacebookPagePost({ pageId: PAGE_ID, pageAccessToken: PAGE_TOKEN, message: "x" }, transport);
  assert.deepEqual(result, { ok: false, category: "timeout", retryable: true, message: "Facebook did not answer in time.", ambiguous: true });
});

  await check("reconciliation matches the exact message in the Page feed", async () => {
  const { transport, calls } = fakeTransport(() => ({
    status: 200,
    body: { data: [{ id: `${PAGE_ID}_1`, message: "Other" }, { id: `${PAGE_ID}_2`, message: "Bonjour\nMontréal", created_time: "2026-11-06T19:59:00+0000", permalink_url: "https://www.facebook.com/2" }] },
  }));
  const found = await reconcileFacebookPagePost({ pageId: PAGE_ID, pageAccessToken: PAGE_TOKEN, message: "Bonjour\r\nMontréal", since: NOW }, transport);
  assert.deepEqual(found, { found: true, remotePostId: `${PAGE_ID}_2`, permalinkUrl: "https://www.facebook.com/2", createdAt: "2026-11-06T19:59:00+0000" });
  assert.match(calls[0].url, /since=\d+/);
  const missing = await reconcileFacebookPagePost({ pageId: PAGE_ID, pageAccessToken: PAGE_TOKEN, message: "Absent", since: NOW }, transport);
  assert.deepEqual(missing, { found: false });
});

// ── Instagram adapter ─────────────────────────────────

const IG_USER_ID = "17841400000000001";
const IG_TOKEN = "IGAAB-user-token-never-logged";
const noSleep = async () => {};

  await check("Instagram scope sets: default unchanged, publishing adds exactly the publish scope", () => {
    assert.deepEqual([...INSTAGRAM_OAUTH_START_SCOPES], ["instagram_business_basic", "instagram_business_manage_insights"]);
    assert.deepEqual([...resolveInstagramOAuthScopes()], [...INSTAGRAM_OAUTH_START_SCOPES]);
    assert.deepEqual([...resolveInstagramOAuthScopes("instagram_publishing")], [...INSTAGRAM_OAUTH_PUBLISHING_SCOPES]);
    assert.deepEqual([...INSTAGRAM_OAUTH_PUBLISHING_SCOPES], [...INSTAGRAM_OAUTH_START_SCOPES, INSTAGRAM_OAUTH_PERMISSION_PUBLISH]);
    assert.ok(!INSTAGRAM_OAUTH_START_SCOPES.includes(INSTAGRAM_OAUTH_PERMISSION_PUBLISH as never), "default scopes must not request publishing before app review");
    process.env.INSTAGRAM_APP_ID = "test-app-id";
    process.env.INSTAGRAM_OAUTH_REDIRECT_URI = "https://example.test/api/social/callback/instagram";
    const basic = new URL(buildInstagramAuthorizationUrl({ state: "state-1" }));
    const publishing = new URL(buildInstagramAuthorizationUrl({ state: "state-1", scopeSet: "instagram_publishing" }));
    assert.equal(basic.searchParams.get("scope"), INSTAGRAM_OAUTH_START_SCOPES.join(","));
    assert.equal(publishing.searchParams.get("scope"), INSTAGRAM_OAUTH_PUBLISHING_SCOPES.join(","));
    assert.equal(publishing.origin, "https://www.instagram.com");
  });

  await check("Instagram Graph errors are classified, including publishing-specific codes", () => {
    assert.equal(classifyInstagramPublishFailure(400, { error: { code: 190 } }).category, "authorization_expired");
    assert.equal(classifyInstagramPublishFailure(403, { error: { code: 200 } }).category, "permission_denied");
    assert.equal(classifyInstagramPublishFailure(400, { error: { code: 10 } }).category, "permission_denied");
    assert.deepEqual(classifyInstagramPublishFailure(400, { error: { code: 25, message: "limit" } }), { category: "rate_limited", retryable: true, message: "limit" });
    assert.equal(classifyInstagramPublishFailure(400, { error: { code: 9007 } }).retryable, true);
    assert.equal(classifyInstagramPublishFailure(400, { error: { code: 9004 } }).category, "invalid_content");
    assert.equal(classifyInstagramPublishFailure(400, { error: { code: 36003 } }).category, "invalid_content");
    assert.equal(classifyInstagramPublishFailure(503, {}).category, "provider_unavailable");
    assert.equal(classifyInstagramPublishFailure(400, { error: { code: 100 } }).retryable, false);
  });

  await check("Instagram: missing, duplicate or insecure media is refused before any call", async () => {
    const { transport, calls } = fakeTransport(() => ({ status: 200, body: { id: "x" } }));
    const none = await publishInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "Hello" }, transport, noSleep);
    const both = await publishInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "Hello", imageUrl: "https://cdn/a.jpg", videoUrl: "https://cdn/b.mp4" }, transport, noSleep);
    const insecure = await publishInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "Hello", imageUrl: "http://cdn/a.jpg" }, transport, noSleep);
    const empty = await publishInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "  ", imageUrl: "https://cdn/a.jpg" }, transport, noSleep);
    const noToken = await publishInstagramMedia({ igUserId: IG_USER_ID, accessToken: "", caption: "Hello", imageUrl: "https://cdn/a.jpg" }, transport, noSleep);
    for (const result of [none, both, insecure, empty]) {
      assert.equal(result.ok, false);
      if (!result.ok) { assert.equal(result.category, "invalid_content"); assert.equal(result.ambiguous, false); }
    }
    if (!none.ok) assert.match(none.message, /text-only/);
    if (!noToken.ok) assert.equal(noToken.category, "not_configured");
    assert.equal(validateInstagramPublishInput({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "ok", imageUrl: "https://cdn/a.jpg" }), null);
    assert.equal(calls.length, 0);
  });

  await check("Instagram image: container → status → media_publish → permalink, token never in a URL", async () => {
    const { transport, calls } = fakeTransport((call) => {
      if (call.method === "POST" && call.url.endsWith("/media")) return { status: 200, body: { id: "container-1" } };
      if (call.method === "GET" && call.url.includes("/container-1?")) return { status: 200, body: { status_code: "FINISHED" } };
      if (call.method === "POST" && call.url.endsWith("/media_publish")) return { status: 200, body: { id: "media-9" } };
      if (call.method === "GET" && call.url.includes("/media-9?")) return { status: 200, body: { id: "media-9", permalink: "https://www.instagram.com/p/abc/", timestamp: "2026-11-06T20:00:01+0000" } };
      throw new Error(`unexpected call ${call.method} ${call.url}`);
    });
    const result = await publishInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "  Bonjour\r\nMontréal ", imageUrl: "https://cdn.takatak.ca/a.jpg" }, transport, noSleep);
    assert.deepEqual(result, { ok: true, remotePostId: "media-9", permalinkUrl: "https://www.instagram.com/p/abc/", verified: true, containerId: "container-1" });
    assert.equal(calls.length, 4);
    assert.match(calls[0].url, new RegExp(`^https://graph\\.instagram\\.com/v[0-9.]+/${IG_USER_ID}/media$`));
    assert.equal(calls[0].form?.image_url, "https://cdn.takatak.ca/a.jpg");
    assert.equal(calls[0].form?.caption, "Bonjour\nMontréal");
    assert.equal(calls[0].form?.access_token, IG_TOKEN);
    assert.equal(calls[0].form?.media_type, undefined);
    assert.equal(calls[1].headers.authorization, `Bearer ${IG_TOKEN}`);
    assert.equal(calls[2].form?.creation_id, "container-1");
    assert.equal(calls[2].form?.access_token, IG_TOKEN);
    for (const call of calls) assert.ok(!call.url.includes(IG_TOKEN), `token leaked into URL: ${call.url}`);
  });

  await check("Instagram Reel: video_url + media_type=REELS, polls until FINISHED", async () => {
    let polls = 0;
    const waits: number[] = [];
    const { transport, calls } = fakeTransport((call) => {
      if (call.method === "POST" && call.url.endsWith("/media")) return { status: 200, body: { id: "container-2" } };
      if (call.method === "GET" && call.url.includes("/container-2?")) { polls += 1; return { status: 200, body: { status_code: polls < 3 ? "IN_PROGRESS" : "FINISHED" } }; }
      if (call.method === "POST" && call.url.endsWith("/media_publish")) return { status: 200, body: { id: "media-10" } };
      return { status: 500, body: null };
    });
    const result = await publishInstagramMedia(
      { igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "Reel", videoUrl: "https://cdn.takatak.ca/reel.mp4", maxStatusPolls: 5, pollIntervalMs: 7 },
      transport,
      async (ms) => { waits.push(ms); },
    );
    assert.equal(result.ok, true);
    if (result.ok) { assert.equal(result.remotePostId, "media-10"); assert.equal(result.verified, false); assert.equal(result.permalinkUrl, null); }
    assert.equal(calls[0].form?.media_type, "REELS");
    assert.equal(calls[0].form?.video_url, "https://cdn.takatak.ca/reel.mp4");
    assert.equal(polls, 3);
    assert.deepEqual(waits, [7, 7]);
  });

  await check("Instagram status polling is bounded and never publishes an unready container", async () => {
    const { transport, calls } = fakeTransport((call) => {
      if (call.method === "POST" && call.url.endsWith("/media")) return { status: 200, body: { id: "container-3" } };
      if (call.method === "GET") return { status: 200, body: { status_code: "IN_PROGRESS" } };
      throw new Error("media_publish must not be called");
    });
    const result = await publishInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "Slow", imageUrl: "https://cdn.takatak.ca/a.jpg", maxStatusPolls: 4, pollIntervalMs: 0 }, transport, noSleep);
    assert.deepEqual(result, { ok: false, category: "timeout", retryable: true, message: "Instagram is still processing the media; the attempt will be retried.", ambiguous: false });
    assert.equal(calls.length, 1 + 4);
    const failed = fakeTransport((call) => {
      if (call.method === "POST") return { status: 200, body: { id: "container-4" } };
      return { status: 200, body: { status_code: "ERROR", status: "Media aspect ratio is not supported." } };
    });
    const error = await publishInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "Bad", imageUrl: "https://cdn.takatak.ca/a.jpg", maxStatusPolls: 4 }, failed.transport, noSleep);
    assert.equal(error.ok, false);
    if (!error.ok) { assert.equal(error.category, "invalid_content"); assert.equal(error.retryable, false); assert.match(error.message, /aspect ratio/); }
  });

  await check("Instagram: a container timeout is retryable but not ambiguous; a media_publish timeout is ambiguous", async () => {
    const abort = () => { const error = new Error("aborted"); error.name = "AbortError"; throw error; };
    const container = fakeTransport(() => abort());
    const first = await publishInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "x", imageUrl: "https://cdn/a.jpg" }, container.transport, noSleep);
    assert.deepEqual(first, { ok: false, category: "timeout", retryable: true, message: "Instagram did not answer in time.", ambiguous: false });
    const publish = fakeTransport((call) => {
      if (call.method === "POST" && call.url.endsWith("/media")) return { status: 200, body: { id: "container-5" } };
      if (call.method === "GET") return { status: 200, body: { status_code: "FINISHED" } };
      return abort();
    });
    const second = await publishInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "x", imageUrl: "https://cdn/a.jpg" }, publish.transport, noSleep);
    assert.deepEqual(second, { ok: false, category: "timeout", retryable: true, message: "Instagram did not answer in time.", ambiguous: true });
  });

  await check("Instagram reconciliation matches the caption on media created since the attempt", async () => {
    const { transport, calls } = fakeTransport(() => ({
      status: 200,
      body: { data: [
        { id: "old", caption: "Bonjour\nMontréal", timestamp: "2026-11-06T18:00:00+0000" },
        { id: "other", caption: "Autre", timestamp: "2026-11-06T20:00:05+0000" },
        { id: "match", caption: "Bonjour\nMontréal", timestamp: "2026-11-06T20:00:05+0000", permalink: "https://www.instagram.com/p/match/" },
      ] },
    }));
    const found = await reconcileInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "Bonjour\r\nMontréal", since: NOW }, transport);
    assert.deepEqual(found, { found: true, remotePostId: "match", permalinkUrl: "https://www.instagram.com/p/match/", createdAt: "2026-11-06T20:00:05+0000" });
    assert.match(calls[0].url, /\/media\?fields=id%2Ccaption%2Ctimestamp%2Cpermalink&since=\d+&limit=25$/);
    assert.equal(calls[0].headers.authorization, `Bearer ${IG_TOKEN}`);
    assert.ok(!calls[0].url.includes(IG_TOKEN));
    assert.deepEqual(await reconcileInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "Absent", since: NOW }, transport), { found: false });
    const down = fakeTransport(() => ({ status: 503, body: {} }));
    const unknown = await reconcileInstagramMedia({ igUserId: IG_USER_ID, accessToken: IG_TOKEN, caption: "x", since: NOW }, down.transport);
    assert.equal(unknown.found, "unknown");
  });

// ── worker against an in-memory database ──────────────

type Row = Record<string, unknown>;
function matches(row: Row, where: Row): boolean {
  for (const [key, expected] of Object.entries(where)) {
    const value = row[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected) && !(expected instanceof Date)) {
      const op = expected as Row;
      if ("in" in op) { if (!(op.in as unknown[]).includes(value)) return false; continue; }
      if ("path" in op) { const path = op.path as string[]; let cur: unknown = value; for (const p of path) cur = (cur as Row | null)?.[p]; if (cur !== op.equals) return false; continue; }
      if ("equals" in op) {
        const eq = op.equals;
        const normalized = eq && typeof eq === "object" && "__nulltype" in (eq as Row) ? null : eq;
        if (JSON.stringify(value ?? null) !== JSON.stringify(normalized ?? null)) return false;
        continue;
      }
      if ("lt" in op) { if (!(value instanceof Date) || !(op.lt instanceof Date) || !(value < op.lt)) return false; continue; }
      if ("not" in op) { if (value === op.not) return false; continue; }
    }
    if (expected instanceof Date) { if (!(value instanceof Date) || value.getTime() !== expected.getTime()) return false; continue; }
    if (expected && typeof expected === "object") continue;
    if (value !== expected) return false;
  }
  return true;
}

function fakeDb(seed: { posts: Row[]; jobs?: Row[] }) {
  const posts = seed.posts;
  const jobs: Row[] = seed.jobs ?? [];
  const logs: Row[] = [];
  let ids = 0;
  const db: PublicationDb = {
    $queryRaw: async () => { throw new Error("not used in these tests"); },
    $transaction: async (fn) => fn(db),
    job: {
      create: async ({ data }) => { const row = { id: `job-${++ids}`, createdAt: NOW, ...data }; jobs.push(row); return { id: row.id as string }; },
      findFirst: async (args) => jobs.find((row) => matches(row, (args.where as Row) ?? {})) ?? null,
      findMany: async (args) => jobs.filter((row) => matches(row, (args.where as Row) ?? {})),
      updateMany: async (args) => { let count = 0; for (const row of jobs) if (matches(row, args.where as Row)) { Object.assign(row, args.data as Row); count += 1; } return { count }; },
    },
    jobLog: { create: async ({ data }) => { logs.push(data); return data; } },
    socialPost: {
      findFirst: async (args) => { const row = posts.find((p) => matches(p, (args.where as Row) ?? {})); return row ? structuredClone(row) : null; },
      updateMany: async (args) => { let count = 0; for (const row of posts) if (matches(row, args.where as Row)) { Object.assign(row, args.data as Row); count += 1; } return { count }; },
    },
  };
  return { db, posts, jobs, logs };
}

const CLIENT = "c1";
function postRow(overrides: Row = {}): Row {
  return {
    id: "post-1",
    clientId: CLIENT,
    status: "scheduled",
    caption: "Bonjour Montréal",
    platform: "facebook",
    scheduledAt: NOW,
    publishedAt: null,
    socialAccountId: "acc-1",
    mediaUrls: null,
    metadata: { source: "ai_studio" },
    approvals: [{ status: "approved" }],
    socialAccount: {
      id: "acc-1",
      platform: "facebook",
      status: "connected",
      accountType: "facebook_page",
      externalAccountId: PAGE_ID,
      metadata: { canPublish: true },
      providerConnection: {
        id: "conn-1",
        clientId: CLIENT,
        provider: "meta",
        status: "connected",
        scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
        credential: { status: "active", encryptedPayload: "x", iv: "y", authTag: "z", keyVersion: 1 },
      },
    },
    ...overrides,
  };
}
const JOB = { id: "job-1", clientId: CLIENT, attempts: 1, maxAttempts: 3, leaseOwner: "lease-1", metadata: { source: "social_publication_v1" as const, version: 1 as const, clientId: CLIENT, socialPostId: "post-1", requestedByProfileId: null, requestedAt: NOW.toISOString() } };
const deps = (db: PublicationDb, transport: FacebookPublishTransport) => ({
  db,
  transport,
  now: () => NOW,
  workspaceCanWrite: async () => ({ allowed: true as const }),
});

// The worker decrypts the credential through social-crypto; a payload it
// cannot read fails closed as needs_reconnect and nothing is sent.
  await check("a post whose credential cannot be read is marked needs_reconnect, never sent", async () => {
  const { db, posts, jobs } = fakeDb({ posts: [postRow()], jobs: [{ ...JOB, status: "running" }] });
  const { transport, calls } = fakeTransport(() => ({ status: 200, body: { id: "x" } }));
  const outcome = await processSocialPublicationJob(JOB, deps(db, transport));
  assert.deepEqual(outcome, { outcome: "blocked", socialPostId: "post-1", reason: "needs_reconnect" });
  assert.equal(calls.length, 0);
  assert.equal(posts[0].status, "failed");
  assert.equal(readPublicationReceipt(posts[0].metadata)?.state, "needs_reconnect");
  assert.equal(jobs[0].status, "failed");
});

  await check("a post without publishing scope is blocked before any network call", async () => {
  const row = postRow();
  (row.socialAccount as Row).providerConnection = { ...((row.socialAccount as Row).providerConnection as Row), scopes: ["pages_read_engagement"] };
  const { db, posts } = fakeDb({ posts: [row], jobs: [{ ...JOB, status: "running" }] });
  const { transport, calls } = fakeTransport(() => ({ status: 200, body: { id: "x" } }));
  const outcome = await processSocialPublicationJob(JOB, deps(db, transport));
  assert.equal(outcome.outcome, "blocked");
  assert.equal(calls.length, 0);
  assert.match(String(readPublicationReceipt(posts[0].metadata)?.errorMessage), /pages_manage_posts/);
});

  await check("an unapproved or already-published post never reaches Meta", async () => {
  const unapproved = fakeDb({ posts: [postRow({ approvals: [{ status: "pending" }] })], jobs: [{ ...JOB, status: "running" }] });
  const { transport, calls } = fakeTransport(() => ({ status: 200, body: { id: "x" } }));
  const blocked = await processSocialPublicationJob(JOB, deps(unapproved.db, transport));
  assert.deepEqual(blocked, { outcome: "blocked", socialPostId: "post-1", reason: "approval_not_approved" });
  assert.equal(unapproved.jobs[0].status, "failed");
  const published = fakeDb({ posts: [postRow({ status: "published" })], jobs: [{ ...JOB, status: "running" }] });
  const replay = await processSocialPublicationJob(JOB, deps(published.db, transport));
  assert.equal(replay.outcome, "published");
  assert.equal(published.jobs[0].status, "completed");
  assert.equal(calls.length, 0);
});

  await check("a locked workspace blocks dispatch", async () => {
  const { db, jobs } = fakeDb({ posts: [postRow()], jobs: [{ ...JOB, status: "running" }] });
  const { transport, calls } = fakeTransport(() => ({ status: 200, body: { id: "x" } }));
  const outcome = await processSocialPublicationJob(JOB, { ...deps(db, transport), workspaceCanWrite: async () => ({ allowed: false, message: "past due" }) });
  assert.deepEqual(outcome, { outcome: "blocked", socialPostId: "post-1", reason: "workspace_locked" });
  assert.equal(calls.length, 0);
  assert.equal(jobs[0].errorMessage, "workspace_locked");
});

  const IG_CONN = "conn-ig";
  function instagramCredential(overrides: { accessToken?: string; providerAccountId?: string | null } = {}) {
    const encrypted = encryptSocialTokenPayload(
      { accessToken: overrides.accessToken ?? IG_TOKEN, tokenType: "bearer", scopes: [...INSTAGRAM_OAUTH_PUBLISHING_SCOPES], providerAccountId: overrides.providerAccountId === undefined ? IG_USER_ID : overrides.providerAccountId, issuedAt: NOW.toISOString() },
      buildSocialCredentialAad({ clientId: CLIENT, connectionId: IG_CONN, provider: "instagram" }),
    );
    return { status: "active", encryptedPayload: encrypted.ciphertext, iv: encrypted.iv, authTag: encrypted.authTag, keyVersion: encrypted.keyVersion };
  }
  function instagramPostRow(overrides: Row = {}, scopes: string[] = [...INSTAGRAM_OAUTH_PUBLISHING_SCOPES]): Row {
    return postRow({
      platform: "instagram",
      caption: "Bonjour\nMontréal",
      mediaUrls: ["https://cdn.takatak.ca/a.jpg"],
      socialAccount: {
        id: "acc-ig",
        platform: "instagram",
        status: "connected",
        accountType: "instagram_professional",
        externalAccountId: IG_USER_ID,
        metadata: { source: "instagram_login" },
        providerConnection: { id: IG_CONN, clientId: CLIENT, provider: "instagram", status: "connected", scopes, credential: instagramCredential() },
      },
      socialAccountId: "acc-ig",
      ...overrides,
    });
  }
  const igOk = (call: Call) => {
    if (call.method === "POST" && call.url.endsWith("/media")) return { status: 200, body: { id: "container-w" } };
    if (call.method === "GET" && call.url.includes("/container-w?")) return { status: 200, body: { status_code: "FINISHED" } };
    if (call.method === "POST" && call.url.endsWith("/media_publish")) return { status: 200, body: { id: "media-w" } };
    if (call.method === "GET" && call.url.includes("/media-w?")) return { status: 200, body: { id: "media-w", permalink: "https://www.instagram.com/p/w/" } };
    throw new Error(`unexpected ${call.method} ${call.url}`);
  };
  const igDeps = (db: PublicationDb, transport: InstagramPublishTransport) => ({ ...deps(db, transport as FacebookPublishTransport), instagramTransport: transport, sleep: noSleep });

  await check("worker: an Instagram post is published through the container flow with a verified receipt", async () => {
    const { db, posts, jobs, logs } = fakeDb({ posts: [instagramPostRow()], jobs: [{ ...JOB, status: "running" }] });
    const { transport, calls } = fakeTransport(igOk);
    const outcome = await processSocialPublicationJob(JOB, igDeps(db, transport));
    assert.deepEqual(outcome, { outcome: "published", socialPostId: "post-1", remotePostId: "media-w", replayed: false });
    assert.equal(calls.length, 4);
    assert.equal(posts[0].status, "published");
    const receipt = readPublicationReceipt(posts[0].metadata);
    assert.equal(receipt?.state, "confirmed");
    assert.equal(receipt?.provider, "instagram");
    assert.equal(receipt?.platform, "instagram");
    assert.equal(receipt?.remotePostId, "media-w");
    assert.equal(receipt?.permalinkUrl, "https://www.instagram.com/p/w/");
    assert.equal(receipt?.targetExternalId, IG_USER_ID);
    assert.equal(jobs[0].status, "completed");
    assert.ok(!JSON.stringify(logs).includes(IG_TOKEN), "token never logged");
    assert.ok(!JSON.stringify(logs).includes("Bonjour"), "caption never logged");
  });

  await check("worker: Instagram without the publish scope, without media, or linked through a Page never reaches Instagram", async () => {
    const { transport, calls } = fakeTransport(igOk);
    const noScope = fakeDb({ posts: [instagramPostRow({}, [...INSTAGRAM_OAUTH_START_SCOPES])], jobs: [{ ...JOB, status: "running" }] });
    const blocked = await processSocialPublicationJob(JOB, igDeps(noScope.db, transport));
    assert.deepEqual(blocked, { outcome: "blocked", socialPostId: "post-1", reason: "needs_reconnect" });
    assert.match(String(readPublicationReceipt(noScope.posts[0].metadata)?.errorMessage), /instagram_business_content_publish/);
    assert.equal(readPublicationReceipt(noScope.posts[0].metadata)?.platform, "instagram");
    const noMedia = fakeDb({ posts: [instagramPostRow({ mediaUrls: null })], jobs: [{ ...JOB, status: "running" }] });
    assert.deepEqual(await processSocialPublicationJob(JOB, igDeps(noMedia.db, transport)), { outcome: "blocked", socialPostId: "post-1", reason: "media_required" });
    const viaPage = instagramPostRow();
    (viaPage.socialAccount as Row).providerConnection = { ...((viaPage.socialAccount as Row).providerConnection as Row), provider: "meta" };
    const linked = fakeDb({ posts: [viaPage], jobs: [{ ...JOB, status: "running" }] });
    assert.equal((await processSocialPublicationJob(JOB, igDeps(linked.db, transport))).outcome, "blocked");
    assert.match(String(readPublicationReceipt(linked.posts[0].metadata)?.errorMessage), /Instagram Login/);
    assert.equal(calls.length, 0);
  });

  await check("worker: an ambiguous Instagram media_publish is reconciled before any retry", async () => {
    const { db, posts, jobs } = fakeDb({ posts: [instagramPostRow()], jobs: [{ ...JOB, status: "running" }] });
    const first = fakeTransport((call) => {
      if (call.method === "POST" && call.url.endsWith("/media_publish")) { const error = new Error("aborted"); error.name = "AbortError"; throw error; }
      return igOk(call);
    });
    const outcome = await processSocialPublicationJob(JOB, igDeps(db, first.transport));
    assert.deepEqual(outcome, { outcome: "uncertain", socialPostId: "post-1" });
    assert.equal(readPublicationReceipt(posts[0].metadata)?.state, "uncertain");
    assert.equal(posts[0].status, "scheduled");
    assert.equal(jobs[0].status, "retrying");
    // Second attempt (re-leased by the claim query): reconciliation finds the media; nothing is published twice.
    jobs[0].status = "running";
    jobs[0].leaseOwner = JOB.leaseOwner;
    const second = fakeTransport((call) => {
      if (call.method === "GET" && call.url.includes(`/${IG_USER_ID}/media?`)) {
        return { status: 200, body: { data: [{ id: "media-found", caption: "Bonjour\nMontréal", timestamp: "2026-11-06T20:00:02+0000", permalink: "https://www.instagram.com/p/found/" }] } };
      }
      throw new Error(`no publish allowed after reconciliation: ${call.method} ${call.url}`);
    });
    const later = { ...igDeps(db, second.transport), now: () => new Date(NOW.getTime() + 60_000) };
    const replay = await processSocialPublicationJob({ ...JOB, attempts: 2 }, later);
    assert.deepEqual(replay, { outcome: "published", socialPostId: "post-1", remotePostId: "media-found", replayed: true });
    assert.equal(second.calls.length, 1);
    assert.equal(posts[0].status, "published");
    assert.equal(readPublicationReceipt(posts[0].metadata)?.permalinkUrl, "https://www.instagram.com/p/found/");
    assert.equal(jobs[0].status, "completed");
  });

  await check("worker: Facebook dispatch with a readable credential publishes and verifies", async () => {
    const encrypted = encryptSocialTokenPayload(
      { accessToken: "user-token", scopes: ["pages_manage_posts"], metadata: { pageCredential: { purpose: "meta_facebook_page", pageId: PAGE_ID, accessToken: PAGE_TOKEN, obtainedAt: NOW.toISOString() } } },
      buildSocialCredentialAad({ clientId: CLIENT, connectionId: "conn-1", provider: "meta" }),
    );
    const row = postRow();
    (row.socialAccount as Row).providerConnection = { ...((row.socialAccount as Row).providerConnection as Row), credential: { status: "active", encryptedPayload: encrypted.ciphertext, iv: encrypted.iv, authTag: encrypted.authTag, keyVersion: encrypted.keyVersion } };
    const { db, posts } = fakeDb({ posts: [row], jobs: [{ ...JOB, status: "running" }] });
    const { transport, calls } = fakeTransport((call) => call.method === "POST" ? { status: 200, body: { id: `${PAGE_ID}_42` } } : { status: 200, body: { id: `${PAGE_ID}_42`, permalink_url: "https://www.facebook.com/42" } });
    const outcome = await processSocialPublicationJob(JOB, deps(db, transport));
    assert.deepEqual(outcome, { outcome: "published", socialPostId: "post-1", remotePostId: `${PAGE_ID}_42`, replayed: false });
    assert.equal(calls[0].form?.access_token, PAGE_TOKEN);
    assert.equal(readPublicationReceipt(posts[0].metadata)?.provider, "meta");
    assert.equal(posts[0].status, "published");
  });

  await check("queueing accepts Instagram posts and uses a valid Job.provider value", async () => {
    const { db, jobs } = fakeDb({ posts: [instagramPostRow({ status: "approved", scheduledAt: null })] });
    const queued = await queueSocialPostPublication({ clientId: CLIENT, socialPostId: "post-1", requestedByProfileId: "pr-1", scheduledFor: NOW }, { db, now: () => NOW });
    assert.equal(queued.ok, true);
    assert.equal(jobs[0].provider, "internal");
    const tiktok = fakeDb({ posts: [postRow({ platform: "tiktok" })] });
    assert.deepEqual(await queueSocialPostPublication({ clientId: CLIENT, socialPostId: "post-1", requestedByProfileId: null, scheduledFor: NOW }, { db: tiktok.db, now: () => NOW }), { ok: false, reason: "unsupported_platform" });
  });

  await check("queueing is idempotent per post and moves it to scheduled", async () => {
  const { db, posts, jobs } = fakeDb({ posts: [postRow({ status: "approved", scheduledAt: null })] });
  const first = await queueSocialPostPublication({ clientId: CLIENT, socialPostId: "post-1", requestedByProfileId: "pr-1", scheduledFor: NOW }, { db, now: () => NOW });
  assert.equal(first.ok, true);
  assert.equal(posts[0].status, "scheduled");
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].type, "approve_post");
  assert.equal((jobs[0].metadata as Row).source, "social_publication_v1");
  const later = new Date(NOW.getTime() + 3_600_000);
  const second = await queueSocialPostPublication({ clientId: CLIENT, socialPostId: "post-1", requestedByProfileId: "pr-1", scheduledFor: later }, { db, now: () => NOW });
  assert.equal(second.ok && second.replayed, true);
  assert.equal(jobs.length, 1);
  assert.equal((jobs[0].scheduledFor as Date).getTime(), later.getTime());
  const foreign = await queueSocialPostPublication({ clientId: "other", socialPostId: "post-1", requestedByProfileId: null, scheduledFor: NOW }, { db, now: () => NOW });
  assert.deepEqual(foreign, { ok: false, reason: "not_found" });
});

  await check("queueing refuses a pending approval and a published post", async () => {
  const pending = fakeDb({ posts: [postRow({ status: "pending_approval", approvals: [{ status: "pending" }] })] });
  assert.deepEqual(await queueSocialPostPublication({ clientId: CLIENT, socialPostId: "post-1", requestedByProfileId: null, scheduledFor: NOW }, { db: pending.db, now: () => NOW }), { ok: false, reason: "approval_not_approved" });
  const done = fakeDb({ posts: [postRow({ status: "published" })] });
  assert.deepEqual(await queueSocialPostPublication({ clientId: CLIENT, socialPostId: "post-1", requestedByProfileId: null, scheduledFor: NOW }, { db: done.db, now: () => NOW }), { ok: false, reason: "already_published" });
  assert.equal(pending.jobs.length + done.jobs.length, 0);
});

  await check("AI Studio handoff targets a publish-ready Facebook Page and validates explicit choices", () => {
    assert.equal(accountPublishReady({ platform: "facebook", accountType: "facebook_page", accessStatus: "selected", metadata: { canPublish: true } }), true);
    assert.equal(accountPublishReady({ platform: "facebook", accountType: "facebook_page", accessStatus: "selected", metadata: { canPublish: false } }), false);
    assert.equal(accountPublishReady({ platform: "instagram", accountType: null, accessStatus: "selected", metadata: null }), false);
    const older = new Date(NOW.getTime() - 60_000);
    const accounts = [
      { id: "ig", platform: "instagram", status: "connected", businessBrandId: "b1", publishReady: false, updatedAt: NOW },
      { id: "fb", platform: "facebook", status: "connected", businessBrandId: "b1", publishReady: true, updatedAt: older },
      { id: "other-brand", platform: "facebook", status: "connected", businessBrandId: "b2", publishReady: true, updatedAt: NOW },
      { id: "expired", platform: "facebook", status: "expired", businessBrandId: "b1", publishReady: true, updatedAt: NOW },
    ];
    const auto = chooseHandoffAccount(accounts, null, "b1");
    assert.equal(auto.ok && auto.account?.id, "fb");
    const explicit = chooseHandoffAccount(accounts, "ig", "b1");
    assert.equal(explicit.ok && explicit.account?.id, "ig");
    assert.deepEqual(chooseHandoffAccount(accounts, "other-brand", "b1"), { ok: false, reason: "account_unavailable" });
    assert.deepEqual(chooseHandoffAccount(accounts, "expired", "b1"), { ok: false, reason: "account_unavailable" });
    assert.deepEqual(chooseHandoffAccount(accounts, "missing", null), { ok: false, reason: "account_unavailable" });
    const none = chooseHandoffAccount([], null, null);
    assert.deepEqual(none, { ok: true, account: null });
  });

  await check("capability profile reports honest states per provider", () => {
    const base = {
      status: "connected",
      hasCredential: true,
      accessTokenExpiresAt: new Date(NOW.getTime() + 30 * 24 * 3_600_000).toISOString(),
      refreshTokenExpiresAt: null,
      lastErrorCode: null,
      externalSubjectId: "subject",
      now: NOW,
    };
    const page = { platform: "facebook", status: "connected", accessStatus: "selected", accountType: "facebook_page", canPublish: true };
    const meta = describeConnectionCapabilities({ ...base, provider: "meta", scopes: ["public_profile", "pages_show_list", "pages_read_engagement", "pages_manage_posts", "read_insights"], accounts: [page] });
    assert.equal(meta.tokenHealth, "healthy");
    assert.equal(meta.capabilities.find((c) => c.key === "publish")?.state, "available");
    assert.equal(meta.capabilities.find((c) => c.key === "analytics")?.state, "available");
    assert.equal(meta.capabilities.find((c) => c.key === "inbox")?.state, "not_built");
    assert.equal(meta.reconnectRequired, false);
    const noScope = describeConnectionCapabilities({ ...base, provider: "meta", scopes: ["pages_read_engagement"], accounts: [page] });
    const publish = noScope.capabilities.find((c) => c.key === "publish");
    assert.equal(publish?.state, "missing_scope");
    assert.deepEqual(publish?.missingScopes, ["pages_manage_posts"]);
    assert.equal(noScope.reconnectRequired, true);
    const noPage = describeConnectionCapabilities({ ...base, provider: "meta", scopes: ["pages_manage_posts", "pages_read_engagement", "read_insights"], accounts: [] });
    assert.equal(noPage.capabilities.find((c) => c.key === "publish")?.action, "select_account");
    const noTask = describeConnectionCapabilities({ ...base, provider: "meta", scopes: ["pages_manage_posts", "pages_read_engagement", "read_insights"], accounts: [{ ...page, canPublish: false }] });
    assert.equal(noTask.capabilities.find((c) => c.key === "publish")?.state, "missing_scope");
    const igAccount = { platform: "instagram", status: "connected", accessStatus: "selected", accountType: "instagram_professional", canPublish: null };
    const ig = describeConnectionCapabilities({ ...base, provider: "instagram", scopes: ["instagram_business_basic", "instagram_business_manage_insights"], accounts: [igAccount] });
    const igPublish = ig.capabilities.find((c) => c.key === "publish");
    assert.equal(igPublish?.state, "missing_scope");
    assert.equal(igPublish?.action, "grant_scope");
    assert.equal(ig.reconnectRequired, false, "incremental authorization does not require a reconnect");
    assert.ok(ig.missingScopes.includes("instagram_business_content_publish"));
    const igGranted = describeConnectionCapabilities({ ...base, provider: "instagram", scopes: [...INSTAGRAM_OAUTH_PUBLISHING_SCOPES], accounts: [igAccount] });
    assert.equal(igGranted.capabilities.find((c) => c.key === "publish")?.state, "available");
    assert.equal(igGranted.capabilities.find((c) => c.key === "schedule")?.state, "available");
    const igNoAccount = describeConnectionCapabilities({ ...base, provider: "instagram", scopes: [...INSTAGRAM_OAUTH_PUBLISHING_SCOPES], accounts: [] });
    assert.equal(igNoAccount.capabilities.find((c) => c.key === "publish")?.action, "select_account");
    const x = describeConnectionCapabilities({ ...base, provider: "x", scopes: ["tweet.read", "users.read"], accounts: [] });
    assert.equal(x.capabilities.find((c) => c.key === "publish")?.state, "blocked_cost");
    const tiktok = describeConnectionCapabilities({ ...base, provider: "tiktok", scopes: ["user.info.stats", "video.list"], accounts: [] });
    assert.equal(tiktok.capabilities.find((c) => c.key === "media_video")?.state, "needs_app_review");
    const expired = describeConnectionCapabilities({ ...base, provider: "meta", accessTokenExpiresAt: new Date(NOW.getTime() - 1000).toISOString(), scopes: ["pages_manage_posts", "pages_read_engagement", "read_insights"], accounts: [page] });
    assert.equal(expired.tokenHealth, "expired");
    assert.equal(expired.capabilities.find((c) => c.key === "publish")?.state, "needs_reconnect");
    assert.equal(assessTokenHealth({ ...base, accessTokenExpiresAt: new Date(NOW.getTime() + 3_600_000).toISOString() }), "expiring_soon");
    assert.equal(assessTokenHealth({ ...base, status: "disconnected" }), "missing");
    assert.equal(assessTokenHealth({ ...base, lastErrorCode: "oauth_error" }), "error");
    assert.equal(describeConnectionCapabilities({ ...base, provider: "unknown_provider", scopes: [], accounts: [] }).capabilities.length, 0);
  });

  await check("source guards: no migration, no token in logs, cron and worker wired", () => {
  const jobs = readFileSync("src/lib/social/publishing/publication-jobs.ts", "utf8");
  const adapter = readFileSync("src/lib/social/publishing/facebook-page-publisher.ts", "utf8");
  const instagramAdapter = readFileSync("src/lib/social/publishing/instagram-publisher.ts", "utf8");
  const instagramOAuth = readFileSync("src/lib/social/providers/instagram-oauth.ts", "utf8");
  const grantRoute = readFileSync("src/app/api/social/connections/[connectionId]/instagram/publishing/route.ts", "utf8");
  const cron = readFileSync("src/app/api/cron/social-sync-jobs/route.ts", "utf8");
  const worker = readFileSync("scripts/run-social-sync-worker.ts", "utf8");
  const publishRoute = readFileSync("src/app/api/social/posts/[postId]/publish/route.ts", "utf8");
  const decisionRoute = readFileSync("src/app/api/social/posts/[postId]/decision/route.ts", "utf8");
  assert.doesNotMatch(jobs, /prisma\/migrations|\$executeRaw/);
  assert.match(jobs, /type = 'approve_post'/);
  assert.match(jobs, /FOR UPDATE SKIP LOCKED/);
  assert.match(jobs, /metadata->>'source' = /);
  assert.doesNotMatch(adapter, /console\./);
  assert.doesNotMatch(instagramAdapter, /console\./);
  assert.doesNotMatch(instagramAdapter, /searchParams\.set\("access_token"/, "Instagram token must never be a query parameter");
  assert.match(instagramOAuth, /scopeSet: InstagramOAuthScopeSet = "instagram_basic_insights"/, "default Instagram scope set must stay basic until app review");
  assert.match(grantRoute, /requireWorkspaceApiPermission\("manage_social_accounts"\)/);
  assert.match(grantRoute, /startInstagramPublishingAuthorization/);
  assert.doesNotMatch(jobs, /accessToken[^\n]*console/);
  assert.match(cron, /runSocialPublicationWorkerTick/);
  assert.match(worker, /runSocialPublicationWorkerTick/);
  assert.match(publishRoute, /requireWorkspaceApiPermission\("approve_content"\)/);
  assert.match(publishRoute, /assertClientCanScheduleSocialPost/);
  assert.match(decisionRoute, /requireWorkspaceApiPermission\("approve_content"\)/);
  assert.match(decisionRoute, /assertClientCanUseApprovals/);
});

  console.log(`
${passed} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
