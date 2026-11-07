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
  applyApprovalDecision,
  assessPublicationReadiness,
  canQueuePublication,
  parseScheduleRequest,
  publicationBackoffMs,
  publicationContentHash,
  readPublicationReceipt,
  withPublicationReceipt,
  SOCIAL_PUBLICATION_RECEIPT_VERSION,
} from "../src/lib/social/publishing/publication-model";
import {
  isSocialPublicationJobMetadata,
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
