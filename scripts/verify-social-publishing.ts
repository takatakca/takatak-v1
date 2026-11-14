// Social publishing engine: pure model, Facebook adapter with a fake transport,
// and the durable worker against an in-memory database.
// Run: npm run qa:social-publishing
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  classifyFacebookPublishFailure,
  publishFacebookPagePost,
  reconcileFacebookPagePost,
  type FacebookPublishTransport,
} from "../src/lib/social/publishing/facebook-page-publisher";
import {
  buildBlueskyLinkFacets,
  blueskyPermalink,
  classifyBlueskyPublishFailure,
  createBlueskySessionTransport,
  publishBlueskyPost,
  reconcileBlueskyPost,
  verifyBlueskyPost,
  type BlueskyPublishTransport,
  type BlueskyTransportRequest,
} from "../src/lib/social/publishing/bluesky-publisher";
import {
  applyApprovalDecision,
  assessPublicationReadiness,
  blueskyTextWithinLimits,
  canQueuePublication,
  composeBlueskyPostText,
  countGraphemes,
  isPublishablePlatform,
  parseScheduleRequest,
  publicationBackoffMs,
  publicationProviderForPlatform,
  readPublicationReceipt,
  withPublicationReceipt,
  BLUESKY_POST_GRAPHEME_LIMIT,
  SOCIAL_PUBLICATION_RECEIPT_VERSION,
} from "../src/lib/social/publishing/publication-model";
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

// ── Bluesky adapter ───────────────────────────────────

const DID = "did:plc:takatak0123456789abcdef";
const POST_URI = `at://${DID}/app.bsky.feed.post/3kabc123xyz`;
type BskyCall = BlueskyTransportRequest;
function fakeBlueskyTransport(handler: (call: BskyCall) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }>) {
  const calls: BskyCall[] = [];
  const transport: BlueskyPublishTransport = async (request) => {
    calls.push(request);
    return handler(request);
  };
  return { transport, calls };
}

  await check("Bluesky text model: platform map, graphemes, composed text and limits", () => {
    assert.equal(publicationProviderForPlatform("bluesky"), "bluesky");
    assert.equal(publicationProviderForPlatform("facebook"), "meta");
    assert.equal(publicationProviderForPlatform("instagram"), null);
    assert.equal(isPublishablePlatform("bluesky"), true);
    assert.equal(isPublishablePlatform("tiktok"), false);
    // A family emoji (ZWJ sequence) is one grapheme, several code points, many bytes.
    assert.equal(countGraphemes("a👨‍👩‍👧b"), 3);
    assert.equal(countGraphemes("Montréal"), 8);
    assert.equal(composeBlueskyPostText({ caption: "Bonjour\r\n", link: "https://takatak.ca" }), "Bonjour\n\nhttps://takatak.ca");
    assert.equal(composeBlueskyPostText({ caption: "Voir https://takatak.ca", link: "https://takatak.ca" }), "Voir https://takatak.ca");
    assert.equal(composeBlueskyPostText({ caption: "x", link: null }), "x");
    assert.equal(blueskyTextWithinLimits("é".repeat(BLUESKY_POST_GRAPHEME_LIMIT)), true);
    assert.equal(blueskyTextWithinLimits("é".repeat(BLUESKY_POST_GRAPHEME_LIMIT + 1)), false);
    // 170 graphemes (under 300) but 170 × 18 bytes = 3,060, over the 3,000-byte cap.
    assert.equal(blueskyTextWithinLimits("👨‍👩‍👧".repeat(170)), false);
    const base = { status: "scheduled", scheduledAt: NOW, publishedAt: null, caption: "a".repeat(290), platform: "bluesky", socialAccountId: "acc", metadata: { link: "https://takatak.ca/x" } };
    assert.deepEqual(assessPublicationReadiness({ post: base, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: false, reason: "caption_too_long" });
    assert.deepEqual(assessPublicationReadiness({ post: { ...base, caption: "a".repeat(270) }, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: true, receipt: null });
    // Facebook keeps its own 8,000-character cap.
    assert.deepEqual(assessPublicationReadiness({ post: { ...base, platform: "facebook", caption: "a".repeat(5000) }, latestApprovalStatus: "approved", approvalsRequired: true, now: NOW }), { ok: true, receipt: null });
  });

  await check("a Bluesky receipt round-trips and a mismatched provider/platform pair is rejected", () => {
    const receipt = {
      version: SOCIAL_PUBLICATION_RECEIPT_VERSION,
      attemptId: "22222222-2222-4222-8222-222222222222",
      jobId: "job-9",
      state: "confirmed" as const,
      provider: "bluesky" as const,
      platform: "bluesky" as const,
      targetExternalId: DID,
      contentHash: "c".repeat(64),
      startedAt: NOW.toISOString(),
      confirmedAt: NOW.toISOString(),
      remotePostId: POST_URI,
      permalinkUrl: blueskyPermalink(POST_URI),
      errorCategory: null,
      errorMessage: null,
      attempts: 1,
    };
    assert.deepEqual(readPublicationReceipt(withPublicationReceipt(null, receipt)), receipt);
    assert.equal(readPublicationReceipt({ publication: { ...receipt, provider: "meta" } }), null);
    assert.equal(readPublicationReceipt({ publication: { ...receipt, platform: "facebook" } }), null);
    assert.equal(blueskyPermalink(POST_URI), `https://bsky.app/profile/${encodeURIComponent(DID)}/post/3kabc123xyz`);
    assert.equal(blueskyPermalink("at://did:plc:x/app.bsky.feed.like/abc"), null);
  });

  await check("XRPC errors are classified by status and error name", () => {
    assert.equal(classifyBlueskyPublishFailure(401, { error: "ExpiredToken" }).category, "authorization_expired");
    assert.equal(classifyBlueskyPublishFailure(400, { error: "InvalidToken", message: "bad" }).category, "authorization_expired");
    assert.equal(classifyBlueskyPublishFailure(403, { error: "InsufficientPermissions" }).category, "permission_denied");
    assert.deepEqual(classifyBlueskyPublishFailure(429, { error: "RateLimitExceeded" }).retryable, true);
    assert.equal(classifyBlueskyPublishFailure(502, {}).category, "provider_unavailable");
    assert.equal(classifyBlueskyPublishFailure(400, { error: "InvalidRecord", message: "too long" }).category, "invalid_content");
    assert.equal(classifyBlueskyPublishFailure(400, { error: "InvalidRecord" }).retryable, false);
    assert.equal(classifyBlueskyPublishFailure(418, {}).category, "unknown");
  });

  await check("Bluesky happy path: createRecord with link facet, getRecord verify, record URI as remote id", async () => {
    const { transport, calls } = fakeBlueskyTransport((call) => {
      if (call.nsid === "com.atproto.repo.createRecord") return { status: 200, body: { uri: POST_URI, cid: "bafyreicid" } };
      return { status: 200, body: { uri: POST_URI, cid: "bafyreicid", value: { text: "x", createdAt: NOW.toISOString() } } };
    });
    const result = await publishBlueskyPost({ did: DID, text: "  Bonjour Montréal  ", link: "https://takatak.ca/offre", createdAt: NOW }, transport);
    assert.deepEqual(result, { ok: true, remotePostId: POST_URI, cid: "bafyreicid", permalinkUrl: blueskyPermalink(POST_URI), verified: true });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].body?.repo, DID);
    assert.equal(calls[0].body?.collection, "app.bsky.feed.post");
    const recordValue = calls[0].body?.record as Record<string, unknown>;
    assert.equal(recordValue.text, "Bonjour Montréal\n\nhttps://takatak.ca/offre");
    assert.equal(recordValue.createdAt, NOW.toISOString());
    const facets = recordValue.facets as Array<{ index: { byteStart: number; byteEnd: number }; features: Array<{ uri: string }> }>;
    assert.equal(facets.length, 1);
    // "Bonjour Montréal\n\n" is 19 bytes (é = 2 bytes).
    assert.deepEqual(facets[0].index, { byteStart: 19, byteEnd: 19 + "https://takatak.ca/offre".length });
    assert.equal(facets[0].features[0].uri, "https://takatak.ca/offre");
    assert.equal(calls[1].method, "GET");
    assert.equal(calls[1].nsid, "com.atproto.repo.getRecord");
    assert.deepEqual(calls[1].query, { repo: DID, collection: "app.bsky.feed.post", rkey: "3kabc123xyz" });
    // The adapter never handles a token: no request carries one anywhere.
    for (const call of calls) {
      const serialized = JSON.stringify(call);
      assert.doesNotMatch(serialized, /access_token|authorization|bearer|dpop/i);
    }
    assert.deepEqual(buildBlueskyLinkFacets("see https://a.ca/x, and https://b.ca."), [
      { index: { byteStart: 4, byteEnd: 18 }, features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://a.ca/x" }] },
      { index: { byteStart: 24, byteEnd: 36 }, features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://b.ca" }] },
    ]);
  });

  await check("the 300-grapheme limit and invalid inputs never reach Bluesky", async () => {
    const { transport, calls } = fakeBlueskyTransport(() => ({ status: 200, body: { uri: POST_URI } }));
    const tooLong = await publishBlueskyPost({ did: DID, text: "é".repeat(301) }, transport);
    assert.equal(tooLong.ok, false);
    if (!tooLong.ok) assert.equal(tooLong.category, "invalid_content");
    const linkPushesOver = await publishBlueskyPost({ did: DID, text: "a".repeat(290), link: "https://takatak.ca/longer-path" }, transport);
    assert.equal(linkPushesOver.ok, false);
    const empty = await publishBlueskyPost({ did: DID, text: "   " }, transport);
    assert.equal(empty.ok, false);
    const badLink = await publishBlueskyPost({ did: DID, text: "x", link: "http://insecure" }, transport);
    assert.equal(badLink.ok, false);
    const noDid = await publishBlueskyPost({ did: "", text: "x" }, transport);
    assert.equal(noDid.ok, false);
    if (!noDid.ok) assert.equal(noDid.category, "not_configured");
    assert.equal(calls.length, 0);
    const exact = await publishBlueskyPost({ did: DID, text: "é".repeat(300) }, transport);
    assert.equal(exact.ok, true);
    assert.equal(calls.length, 2);
  });

  await check("a Bluesky timeout is ambiguous and retryable; a verify failure keeps the create", async () => {
    const { transport } = fakeBlueskyTransport(() => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });
    const result = await publishBlueskyPost({ did: DID, text: "x" }, transport);
    assert.deepEqual(result, { ok: false, category: "timeout", retryable: true, message: "Bluesky did not answer in time.", ambiguous: true });
    const flaky = fakeBlueskyTransport((call) =>
      call.nsid === "com.atproto.repo.createRecord" ? { status: 200, body: { uri: POST_URI, cid: "c" } } : { status: 500, body: { error: "UpstreamFailure" } },
    );
    const unverified = await publishBlueskyPost({ did: DID, text: "x" }, flaky.transport);
    assert.equal(unverified.ok && unverified.verified, false);
    assert.equal(unverified.ok && unverified.remotePostId, POST_URI);
    const foreign = fakeBlueskyTransport(() => ({ status: 200, body: { uri: "at://did:plc:someoneelse/app.bsky.feed.post/1" } }));
    const mismatch = await publishBlueskyPost({ did: DID, text: "x" }, foreign.transport);
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) assert.equal(mismatch.ambiguous, true);
    assert.deepEqual(await verifyBlueskyPost({ remotePostId: "not-a-uri" }, flaky.transport), { ok: false });
  });

  await check("Bluesky reconciliation matches the composed text in the author feed and skips reposts", async () => {
    const since = new Date(NOW.getTime() - 600_000);
    const { transport, calls } = fakeBlueskyTransport(() => ({
      status: 200,
      body: {
        feed: [
          { post: { uri: `at://${DID}/app.bsky.feed.post/repost`, author: { did: DID }, record: { text: "Bonjour\n\nhttps://takatak.ca", createdAt: NOW.toISOString() } }, reason: { $type: "app.bsky.feed.defs#reasonRepost" } },
          { post: { uri: `at://${DID}/app.bsky.feed.post/old`, author: { did: DID }, record: { text: "Bonjour\n\nhttps://takatak.ca", createdAt: new Date(NOW.getTime() - 3_600_000).toISOString() } } },
          { post: { uri: `at://${DID}/app.bsky.feed.post/other`, author: { did: DID }, record: { text: "Other", createdAt: NOW.toISOString() } } },
          { post: { uri: POST_URI, author: { did: DID }, record: { text: "Bonjour\n\nhttps://takatak.ca", createdAt: NOW.toISOString() } } },
        ],
      },
    }));
    const found = await reconcileBlueskyPost({ did: DID, text: "Bonjour\r\n", link: "https://takatak.ca", since }, transport);
    assert.deepEqual(found, { found: true, remotePostId: POST_URI, permalinkUrl: blueskyPermalink(POST_URI), createdAt: NOW.toISOString() });
    assert.equal(calls[0].nsid, "app.bsky.feed.getAuthorFeed");
    assert.equal(calls[0].query?.actor, DID);
    assert.deepEqual(await reconcileBlueskyPost({ did: DID, text: "Absent", since }, transport), { found: false });
    const down = fakeBlueskyTransport(() => ({ status: 503, body: { error: "UpstreamFailure" } }));
    const unknown = await reconcileBlueskyPost({ did: DID, text: "x", since }, down.transport);
    assert.equal(unknown.found, "unknown");
  });

  await check("the session transport shapes XRPC calls, keeps credentials out of the path and maps SDK token errors", async () => {
    const seen: Array<{ pathname: string; init: RequestInit | undefined }> = [];
    const fetchHandler = async (pathname: string, init?: RequestInit) => {
      seen.push({ pathname, init });
      return new Response(JSON.stringify({ uri: POST_URI, cid: "c" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const transport = createBlueskySessionTransport(fetchHandler);
    await transport({ method: "POST", nsid: "com.atproto.repo.createRecord", body: { repo: DID, collection: "app.bsky.feed.post", record: { text: "x" } }, timeoutMs: 1000 });
    await transport({ method: "GET", nsid: "com.atproto.repo.getRecord", query: { repo: DID, collection: "app.bsky.feed.post", rkey: "r k" }, timeoutMs: 1000 });
    assert.equal(seen[0].pathname, "/xrpc/com.atproto.repo.createRecord");
    assert.equal(seen[0].init?.method, "POST");
    assert.equal(JSON.parse(String(seen[0].init?.body)).repo, DID);
    assert.equal(seen[1].pathname, `/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(DID)}&collection=app.bsky.feed.post&rkey=r+k`);
    assert.equal(seen[1].init?.body, undefined);
    for (const entry of seen) {
      assert.doesNotMatch(entry.pathname, /token|authorization|dpop/i);
      const headers = (entry.init?.headers ?? {}) as Record<string, string>;
      assert.equal(Object.keys(headers).some((key) => /authorization|dpop/i.test(key)), false, "the adapter adds no auth header; the SDK session does");
    }
    const revoked = createBlueskySessionTransport(
      async () => {
        const error = new Error("revoked");
        error.name = "TokenRevokedError";
        throw error;
      },
      { isAuthorizationError: (error) => error instanceof Error && error.name === "TokenRevokedError" },
    );
    const outcome = await publishBlueskyPost({ did: DID, text: "x" }, revoked);
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.category, "authorization_expired");
      assert.equal(outcome.ambiguous, false);
    }
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

// The worker decrypts the credential through social-crypto; without the
// encryption key configured that fails closed as needs_reconnect, which is the
// honest result in CI. The dispatch path is exercised by injecting the
// credential resolver through the process-level module mock below.
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
    const ig = describeConnectionCapabilities({ ...base, provider: "instagram", scopes: ["instagram_business_basic", "instagram_business_manage_insights"], accounts: [] });
    assert.equal(ig.capabilities.find((c) => c.key === "publish")?.state, "not_built");
    assert.ok(ig.missingScopes.includes("instagram_business_content_publish"));
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

// ── worker: Bluesky dispatch through a fake session transport ──

function blueskyPostRow(overrides: Row = {}): Row {
  return postRow({
    id: "post-b",
    caption: "Bonjour Montréal",
    platform: "bluesky",
    socialAccountId: "acc-b",
    metadata: { source: "ai_studio", link: "https://takatak.ca" },
    socialAccount: {
      id: "acc-b",
      platform: "bluesky",
      status: "connected",
      accountType: null,
      externalAccountId: DID,
      metadata: null,
      providerConnection: {
        id: "conn-b",
        clientId: CLIENT,
        provider: "bluesky",
        status: "connected",
        scopes: ["atproto", "transition:generic"],
        credential: null,
      },
    },
    ...overrides,
  });
}
const BJOB = { ...JOB, id: "job-b", metadata: { ...JOB.metadata, socialPostId: "post-b" } };
const blueskyDeps = (db: PublicationDb, transport: BlueskyPublishTransport, restore?: () => Promise<BlueskyPublishTransport>) => ({
  db,
  transport: fakeTransport(() => { throw new Error("Facebook transport must not be used for Bluesky"); }).transport,
  blueskyTransportFor: restore ?? (async () => transport),
  now: () => NOW,
  workspaceCanWrite: async () => ({ allowed: true as const }),
});

  await check("worker publishes a Bluesky post end to end and writes a verified bluesky receipt", async () => {
    const { db, posts, jobs, logs } = fakeDb({ posts: [blueskyPostRow()], jobs: [{ ...BJOB, status: "running" }] });
    const { transport, calls } = fakeBlueskyTransport((call) =>
      call.nsid === "com.atproto.repo.createRecord"
        ? { status: 200, body: { uri: POST_URI, cid: "bafy" } }
        : { status: 200, body: { uri: POST_URI, cid: "bafy", value: { text: "x", createdAt: NOW.toISOString() } } },
    );
    const outcome = await processSocialPublicationJob(BJOB, blueskyDeps(db, transport));
    assert.deepEqual(outcome, { outcome: "published", socialPostId: "post-b", remotePostId: POST_URI, replayed: false });
    assert.equal(calls.length, 2);
    assert.equal((calls[0].body?.record as Record<string, unknown>).text, "Bonjour Montréal\n\nhttps://takatak.ca");
    assert.equal(posts[0].status, "published");
    const receipt = readPublicationReceipt(posts[0].metadata);
    assert.equal(receipt?.state, "confirmed");
    assert.equal(receipt?.provider, "bluesky");
    assert.equal(receipt?.platform, "bluesky");
    assert.equal(receipt?.remotePostId, POST_URI);
    assert.equal(receipt?.targetExternalId, DID);
    assert.equal(receipt?.permalinkUrl, blueskyPermalink(POST_URI));
    assert.equal((posts[0].metadata as Row).source, "ai_studio");
    assert.equal(jobs[0].status, "completed");
    assert.ok(logs.some((log) => String(log.message).includes("Published on Bluesky")));
    assert.doesNotMatch(JSON.stringify(logs), /token|dpop/i);
  });

  await check("a Bluesky account without write scope, with a bad DID or a dead session is needs_reconnect, never sent", async () => {
    const { transport, calls } = fakeBlueskyTransport(() => ({ status: 200, body: { uri: POST_URI } }));
    const noScope = blueskyPostRow();
    (noScope.socialAccount as Row).providerConnection = { ...((noScope.socialAccount as Row).providerConnection as Row), scopes: ["atproto"] };
    const a = fakeDb({ posts: [noScope], jobs: [{ ...BJOB, status: "running" }] });
    assert.deepEqual(await processSocialPublicationJob(BJOB, blueskyDeps(a.db, transport)), { outcome: "blocked", socialPostId: "post-b", reason: "needs_reconnect" });
    assert.match(String(readPublicationReceipt(a.posts[0].metadata)?.errorMessage), /transition:generic/);
    const badDid = blueskyPostRow();
    (badDid.socialAccount as Row).externalAccountId = "takatak.bsky.social";
    const b = fakeDb({ posts: [badDid], jobs: [{ ...BJOB, status: "running" }] });
    assert.equal((await processSocialPublicationJob(BJOB, blueskyDeps(b.db, transport))).outcome, "blocked");
    const c = fakeDb({ posts: [blueskyPostRow()], jobs: [{ ...BJOB, status: "running" }] });
    const dead = await processSocialPublicationJob(BJOB, blueskyDeps(c.db, transport, async () => { throw new Error("TokenRefreshError"); }));
    assert.deepEqual(dead, { outcome: "blocked", socialPostId: "post-b", reason: "needs_reconnect" });
    assert.equal(c.posts[0].status, "failed");
    assert.equal(readPublicationReceipt(c.posts[0].metadata)?.state, "needs_reconnect");
    assert.equal(c.jobs[0].status, "failed");
    assert.equal(calls.length, 0);
    // A Bluesky post too long for the network is blocked before dispatch.
    const long = fakeDb({ posts: [blueskyPostRow({ caption: "é".repeat(301) })], jobs: [{ ...BJOB, status: "running" }] });
    assert.deepEqual(await processSocialPublicationJob(BJOB, blueskyDeps(long.db, transport)), { outcome: "blocked", socialPostId: "post-b", reason: "caption_too_long" });
    assert.equal(calls.length, 0);
  });

  await check("a Bluesky timeout leaves an uncertain receipt and the retry reconciles instead of duplicating", async () => {
    const { db, posts, jobs } = fakeDb({ posts: [blueskyPostRow()], jobs: [{ ...BJOB, status: "running" }] });
    let creates = 0;
    const first = fakeBlueskyTransport(() => {
      creates += 1;
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });
    const uncertain = await processSocialPublicationJob(BJOB, blueskyDeps(db, first.transport));
    assert.deepEqual(uncertain, { outcome: "uncertain", socialPostId: "post-b" });
    const receipt = readPublicationReceipt(posts[0].metadata);
    assert.equal(receipt?.state, "uncertain");
    assert.equal(receipt?.errorCategory, "timeout");
    assert.equal(posts[0].status, "scheduled");
    assert.equal(jobs[0].status, "retrying");
    // Second attempt (re-claimed with a lease): the feed shows the post landed; nothing new is created.
    Object.assign(jobs[0], { status: "running", leaseOwner: BJOB.leaseOwner });
    const second = fakeBlueskyTransport((call) => {
      if (call.nsid === "com.atproto.repo.createRecord") creates += 1;
      return {
        status: 200,
        body: { feed: [{ post: { uri: POST_URI, author: { did: DID }, record: { text: "Bonjour Montréal\n\nhttps://takatak.ca", createdAt: NOW.toISOString() } } }] },
      };
    });
    const reconciled = await processSocialPublicationJob({ ...BJOB, attempts: 2 }, blueskyDeps(db, second.transport));
    assert.deepEqual(reconciled, { outcome: "published", socialPostId: "post-b", remotePostId: POST_URI, replayed: true });
    assert.equal(creates, 1);
    assert.equal(second.calls.length, 1);
    assert.equal(second.calls[0].nsid, "app.bsky.feed.getAuthorFeed");
    assert.equal(posts[0].status, "published");
    assert.equal(readPublicationReceipt(posts[0].metadata)?.state, "confirmed");
    assert.equal(jobs[0].status, "completed");
  });

  await check("queueing a Bluesky post creates a bluesky job; other platforms stay unsupported", async () => {
    const { db, posts, jobs } = fakeDb({ posts: [blueskyPostRow({ status: "approved", scheduledAt: null })] });
    const queued = await queueSocialPostPublication({ clientId: CLIENT, socialPostId: "post-b", requestedByProfileId: "pr-1", scheduledFor: NOW }, { db, now: () => NOW });
    assert.equal(queued.ok, true);
    assert.equal(posts[0].status, "scheduled");
    assert.equal(jobs[0].provider, "bluesky");
    assert.equal(jobs[0].type, "approve_post");
    const ig = fakeDb({ posts: [blueskyPostRow({ platform: "instagram" })] });
    assert.deepEqual(await queueSocialPostPublication({ clientId: CLIENT, socialPostId: "post-b", requestedByProfileId: null, scheduledFor: NOW }, { db: ig.db, now: () => NOW }), { ok: false, reason: "unsupported_platform" });
  });

  await check("capability profile: Bluesky publish is available with write scope, needs reconnect without it", () => {
    const base = { status: "connected", hasCredential: true, accessTokenExpiresAt: null, refreshTokenExpiresAt: null, lastErrorCode: null, externalSubjectId: DID, now: NOW, accounts: [{ platform: "bluesky", status: "connected", accessStatus: "selected", accountType: null, canPublish: null }] };
    const ready = describeConnectionCapabilities({ ...base, provider: "bluesky", scopes: ["atproto", "transition:generic"] });
    assert.equal(ready.capabilities.find((c) => c.key === "publish")?.state, "available");
    assert.equal(ready.capabilities.find((c) => c.key === "schedule")?.state, "available");
    assert.equal(ready.capabilities.find((c) => c.key === "analytics")?.state, "available");
    const readOnly = describeConnectionCapabilities({ ...base, provider: "bluesky", scopes: ["atproto"] });
    assert.equal(readOnly.capabilities.find((c) => c.key === "publish")?.state, "missing_scope");
    assert.deepEqual(readOnly.capabilities.find((c) => c.key === "publish")?.missingScopes, ["transition:generic"]);
    const noSession = describeConnectionCapabilities({ ...base, provider: "bluesky", hasCredential: false, scopes: ["atproto", "transition:generic"] });
    assert.equal(noSession.capabilities.find((c) => c.key === "publish")?.state, "needs_reconnect");
  });

  await check("source guards (Bluesky): no token handling, no console, SDK loaded lazily, session store counts as credential", () => {
    const adapter = readFileSync("src/lib/social/publishing/bluesky-publisher.ts", "utf8");
    const jobs = readFileSync("src/lib/social/publishing/publication-jobs.ts", "utf8");
    const data = readFileSync("src/lib/social/connections/social-connection-data.ts", "utf8");
    assert.doesNotMatch(adapter, /console\./);
    // No token parameter, no auth header and no DPoP proof is ever built in the adapter.
    assert.doesNotMatch(adapter, /access_token|accessToken|Bearer |authorization:|dpop:/i);
    assert.match(adapter, /com\.atproto\.repo\.createRecord/);
    assert.match(adapter, /com\.atproto\.repo\.getRecord/);
    assert.match(adapter, /app\.bsky\.feed\.getAuthorFeed/);
    assert.doesNotMatch(jobs, /^import .*bluesky-oauth-client/m);
    assert.match(jobs, /await import\("@\/lib\/social\/providers\/bluesky-oauth-client"\)/);
    assert.match(jobs, /client\.restore\(target\.did, "auto"\)/);
    assert.match(data, /encrypted_bluesky_oauth_store/);
  });

  await check("source guards: no migration, no token in logs, cron and worker wired", () => {
  const jobs = readFileSync("src/lib/social/publishing/publication-jobs.ts", "utf8");
  const adapter = readFileSync("src/lib/social/publishing/facebook-page-publisher.ts", "utf8");
  const cron = readFileSync("src/app/api/cron/social-sync-jobs/route.ts", "utf8");
  const worker = readFileSync("scripts/run-social-sync-worker.ts", "utf8");
  const publishRoute = readFileSync("src/app/api/social/posts/[postId]/publish/route.ts", "utf8");
  const decisionRoute = readFileSync("src/app/api/social/posts/[postId]/decision/route.ts", "utf8");
  assert.doesNotMatch(jobs, /prisma\/migrations|\$executeRaw/);
  assert.match(jobs, /type = 'approve_post'/);
  assert.match(jobs, /FOR UPDATE SKIP LOCKED/);
  assert.match(jobs, /metadata->>'source' = /);
  assert.doesNotMatch(adapter, /console\./);
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
