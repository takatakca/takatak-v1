import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  publishReviewRunReply,
  type ReviewPublisherDependencies,
} from "../src/lib/reputation/review-publisher";
import {
  canonicalReviewReply,
  type ReviewDraftSource,
} from "../src/lib/reputation/review-target-model";
import {
  reviewReplyHash,
  type ReviewTarget,
} from "../src/lib/reputation/review-target";

const runId = "11111111-1111-4111-8111-111111111111",
  clientId = "22222222-2222-4222-8222-222222222222",
  reviewId = "33333333-3333-4333-8333-333333333333",
  actorId = "44444444-4444-4444-8444-444444444444",
  sourceId = "55555555-5555-4555-8555-555555555555",
  businessId = "66666666-6666-4666-8666-666666666666";
const now = "2026-11-01T12:00:00.000Z",
  text = "Synthetic approved response. No real customer data.";
const clone = <T>(value: T): T => structuredClone(value);
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
type Row = {
  id: string;
  clientId: string;
  agentKey: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
};
type Args = {
  where: Record<string, unknown>;
  data?: Record<string, unknown>;
  select?: Record<string, unknown>;
};
function fixture(
  options: {
    source?: ReviewDraftSource;
    legacy?: boolean;
    status?: string;
    reply?: string;
    enabled?: boolean;
    requireApproval?: boolean;
    auditError?: boolean;
    receiptFailure?: boolean;
    targetMissing?: boolean;
    trackedMissing?: boolean;
  } = {},
) {
  const source = options.source ?? "google",
    reply = canonicalReviewReply(source, options.reply ?? text)!;
  let target: ReviewTarget | null = options.targetMissing
    ? null
    : {
        id: reviewId,
        source,
        author: "Synthetic author",
        location: "Synthetic location",
        rating: 4,
        text: "Synthetic source review.",
        fingerprint: reviewReplyHash(`synthetic-target:${source}`),
        replyText: null,
        replyAt: null,
        ...(source === "qmaps" ? { qmapsReviewId: sourceId, businessId } : {}),
      };
  const input: Record<string, unknown> = { source, reviewResponseId: reviewId };
  if (!options.legacy)
    Object.assign(input, {
      reviewWorkflowVersion: 2,
      reviewContentHash: target?.fingerprint ?? reviewReplyHash("missing"),
      reviewApproval: {
        replyHash: reviewReplyHash(reply),
        replyText: reply,
        targetHash: target?.fingerprint ?? reviewReplyHash("missing"),
        at: now,
        profileId: actorId,
      },
    });
  const state = {
    run: {
      id: runId,
      clientId,
      agentKey: "review_responder",
      status: options.status ?? "executing",
      input,
      output: { reply },
    } as Row,
    setting:
      options.enabled === false
        ? { enabled: false, requireApproval: options.requireApproval ?? true }
        : { enabled: true, requireApproval: options.requireApproval ?? true },
    target,
    audits: [] as Record<string, unknown>[],
    tracked: {
      id: reviewId,
      metadata: {
        source: "qmaps",
        qmapsReviewId: sourceId,
        preserved: "value",
      },
      updatedAt: new Date(now),
    } as {
      id: string;
      metadata: Record<string, unknown>;
      updatedAt: Date;
    } | null,
  };
  if (options.trackedMissing) state.tracked = null;
  let leases = 0,
    sourceCalls = 0,
    transactions = 0,
    localUpdates = 0;
  const queries: { kind: string; args: unknown }[] = [];
  const matches = (where: Record<string, unknown>) => {
    if (where.id !== state.run.id) return false;
    for (const key of ["clientId", "agentKey", "status"])
      if (
        where[key] !== undefined &&
        where[key] !== state.run[key as keyof Row]
      )
        return false;
    for (const key of ["input", "output"])
      if (
        where[key] !== undefined &&
        JSON.stringify(state.run[key as "input" | "output"]) !==
          JSON.stringify(object(where[key]).equals)
      )
        return false;
    return true;
  };
  const raw = {
    aiAgentRun: {
      findUnique: async (args: Args) => {
        queries.push({ kind: "run-read", args: clone(args) });
        return args.where.id === state.run.id ? clone(state.run) : null;
      },
      updateMany: async (args: Args) => {
        queries.push({ kind: "run-update", args: clone(args) });
        if (!matches(args.where)) return { count: 0 };
        const artifact = object(object(args.data?.input).reviewPublication);
        if (artifact.state === "sending") leases++;
        if (options.receiptFailure && artifact.state !== "sending")
          return { count: 0 };
        if (args.data?.input)
          state.run.input = clone(args.data.input as Record<string, unknown>);
        return { count: 1 };
      },
    },
    aiAgentSetting: {
      findUnique: async (args: unknown) => {
        queries.push({ kind: "setting", args: clone(args) });
        return clone(state.setting);
      },
    },
    listingReview: {
      findFirst: async (args: unknown) => {
        queries.push({ kind: "tracked-read", args: clone(args) });
        return clone(state.tracked);
      },
      updateMany: async (args: Args) => {
        queries.push({ kind: "tracked-update", args: clone(args) });
        if (!state.tracked) return { count: 0 };
        localUpdates++;
        state.tracked.metadata = clone(
          args.data!.metadata as Record<string, unknown>,
        );
        return { count: 1 };
      },
    },
    auditLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        if (options.auditError) throw Error("synthetic audit unavailable");
        state.audits.push(clone(args.data));
        return { id: "synthetic-audit" };
      },
    },
    $transaction: async <T>(work: (tx: unknown) => Promise<T>) => {
      transactions++;
      const snapshot = clone({
        run: state.run,
        tracked: state.tracked,
        audits: state.audits,
      });
      try {
        return await work(raw);
      } catch (error) {
        state.run = snapshot.run;
        state.tracked = snapshot.tracked;
        state.audits = snapshot.audits;
        throw error;
      }
    },
  };
  const db = new Proxy(raw, {
    get(target, property, receiver) {
      if (String(property).startsWith("aiCredit"))
        throw Error("Publisher must not debit credits");
      return Reflect.get(target, property, receiver);
    },
  }) as unknown as PrismaClient;
  const dependencies: ReviewPublisherDependencies = {
    database: db,
    now: () => new Date(now),
    hasFeature: async (tenant, key) => {
      assert.equal(tenant, clientId);
      assert.ok(["reputation", "ai_autopilot"].includes(key));
      return true;
    },
    resolveTarget: async (database, tenant, kind, id) => {
      assert.equal(database, db);
      assert.equal(tenant, clientId);
      assert.equal(kind, source);
      assert.equal(id, reviewId);
      return clone(state.target);
    },
    googleReply: async (tenant, id, body) => {
      assert.equal(tenant, clientId);
      assert.equal(id, reviewId);
      assert.equal(body, reply);
      sourceCalls++;
      return { ok: true };
    },
    qmapsReply: async (body) => {
      assert.deepEqual(body, {
        version: 1,
        clientId,
        businessId,
        reviewId: sourceId,
        body: reply,
      });
      sourceCalls++;
      return { ok: true };
    },
  };
  return {
    state,
    dependencies,
    queries,
    reply,
    counters: () => ({ leases, sourceCalls, transactions, localUpdates }),
    sourceCalled: () => {
      sourceCalls++;
    },
  };
}
let count = 0;
async function check(name: string, work: () => unknown | Promise<unknown>) {
  await work();
  count++;
  console.log("PASS", name);
}
async function main() {
  await check(
    "v2 source publication binds approved reply, current target and one server lease",
    async () => {
      const f = fixture();
      const result = await publishReviewRunReply(
        runId,
        `  ${text}  `,
        f.dependencies,
      );
      assert.deepEqual(result, {
        ok: true,
        runId,
        source: "google",
        reviewId,
        replayed: false,
        confirmedAt: now,
      });
      assert.equal(f.counters().sourceCalls, 1);
      assert.equal(f.counters().leases, 1);
      assert.equal(
        object(f.state.run.input.reviewPublication).state,
        "confirmed",
      );
      assert.equal(f.state.run.status, "executing");
      const lease = f.queries.find((q) => q.kind === "run-update")!
        .args as Args;
      assert.equal(lease.where.clientId, clientId);
      assert.equal(lease.where.agentKey, "review_responder");
      assert.equal(lease.where.status, "executing");
      assert.ok(object(lease.where.input).equals);
      assert.ok(object(lease.where.output).equals);
    },
  );
  await check(
    "confirmed receipts replay after terminal report even if output, source or configuration later changed",
    async () => {
      const f = fixture();
      await publishReviewRunReply(runId, text, f.dependencies);
      f.state.run.status = "completed";
      f.state.run.output = { summary: "Worker terminal report" };
      f.state.target = null;
      f.state.setting.enabled = false;
      f.dependencies.hasFeature = async () => false;
      const result = await publishReviewRunReply(runId, text, f.dependencies);
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.replayed, true);
      assert.equal(f.counters().sourceCalls, 1);
      assert.deepEqual(
        await publishReviewRunReply(runId, "Different text", f.dependencies),
        { ok: false, code: "draft_mismatch" },
      );
    },
  );
  await check(
    "unapproved, unknown, wrong-agent and malformed runs never reach a provider",
    async () => {
      for (const status of [
        "queued",
        "awaiting_approval",
        "approved",
        "completed",
        "rejected",
        "failed",
        "canceled",
      ]) {
        const f = fixture({ status });
        assert.equal(
          (await publishReviewRunReply(runId, text, f.dependencies)).ok,
          false,
        );
        assert.equal(f.counters().sourceCalls, 0);
      }
      const wrong = fixture();
      wrong.state.run.agentKey = "social_autopilot";
      assert.deepEqual(
        await publishReviewRunReply(runId, text, wrong.dependencies),
        { ok: false, code: "not_found" },
      );
      assert.deepEqual(
        await publishReviewRunReply("not-a-uuid", text, wrong.dependencies),
        { ok: false, code: "invalid_request" },
      );
      assert.deepEqual(
        await publishReviewRunReply(runId, "\u0000", fixture().dependencies),
        { ok: false, code: "invalid_request" },
      );
    },
  );
  await check(
    "v2 never publishes during generation even when approval is disabled",
    async () => {
      const f = fixture({ status: "running", requireApproval: false });
      assert.deepEqual(
        await publishReviewRunReply(runId, text, f.dependencies),
        { ok: false, code: "approval_required" },
      );
      assert.equal(f.counters().sourceCalls, 0);
    },
  );
  await check(
    "current setting and both paid-feature authorities are checked before leasing",
    async () => {
      const off = fixture({ enabled: false });
      assert.deepEqual(
        await publishReviewRunReply(runId, text, off.dependencies),
        { ok: false, code: "agent_disabled" },
      );
      assert.equal(off.counters().leases, 0);
      for (const denied of ["reputation", "ai_autopilot"]) {
        const f = fixture();
        f.dependencies.hasFeature = async (_, key) => key !== denied;
        assert.deepEqual(
          await publishReviewRunReply(runId, text, f.dependencies),
          { ok: false, code: "plan_required" },
        );
        assert.equal(f.counters().leases, 0);
      }
    },
  );
  await check(
    "changed, foreign, missing and remapped targets cannot publish approved stale content",
    async () => {
      const missing = fixture({ targetMissing: true });
      assert.deepEqual(
        await publishReviewRunReply(runId, text, missing.dependencies),
        { ok: false, code: "target_unavailable" },
      );
      const changed = fixture();
      changed.state.target!.fingerprint = reviewReplyHash("new review state");
      assert.deepEqual(
        await publishReviewRunReply(runId, text, changed.dependencies),
        { ok: false, code: "review_changed" },
      );
      for (const patch of [{ id: actorId }, { source: "qmaps" as const }]) {
        const f = fixture();
        Object.assign(f.state.target!, patch);
        assert.deepEqual(
          await publishReviewRunReply(runId, text, f.dependencies),
          { ok: false, code: "target_unavailable" },
        );
        assert.equal(f.counters().sourceCalls, 0);
      }
      const qmaps = fixture({ source: "qmaps" });
      delete qmaps.state.target!.businessId;
      assert.deepEqual(
        await publishReviewRunReply(runId, text, qmaps.dependencies),
        { ok: false, code: "target_unavailable" },
      );
    },
  );
  await check(
    "stored output, frozen text/hash, actor and target fingerprint must agree exactly",
    async () => {
      const mismatched = fixture();
      assert.deepEqual(
        await publishReviewRunReply(
          runId,
          "Unapproved body",
          mismatched.dependencies,
        ),
        { ok: false, code: "draft_mismatch" },
      );
      for (const patch of [
        { replyHash: reviewReplyHash("different") },
        { replyText: "Different approved text" },
        { profileId: "not-an-actor" },
        { at: "invalid" },
      ]) {
        const f = fixture();
        Object.assign(object(f.state.run.input.reviewApproval), patch);
        assert.deepEqual(
          await publishReviewRunReply(runId, text, f.dependencies),
          { ok: false, code: "invalid_approval" },
        );
        assert.equal(f.counters().leases, 0);
      }
      const version = fixture();
      version.state.run.input.reviewWorkflowVersion = 3;
      assert.deepEqual(
        await publishReviewRunReply(runId, text, version.dependencies),
        { ok: false, code: "invalid_request" },
      );
    },
  );
  await check(
    "legacy approvals created in the review center bind current target and frozen content too",
    async () => {
      const f = fixture({ legacy: true });
      f.state.run.input.reviewApproval = {
        replyHash: reviewReplyHash(text),
        replyText: text,
        targetHash: f.state.target!.fingerprint,
        at: now,
        profileId: actorId,
      };
      f.state.target!.fingerprint = reviewReplyHash(
        "colleague changed source reply",
      );
      assert.deepEqual(
        await publishReviewRunReply(runId, text, f.dependencies),
        { ok: false, code: "review_changed" },
      );
      assert.equal(f.counters().sourceCalls, 0);
      const valid = fixture({ legacy: true });
      valid.state.run.input.reviewApproval = {
        replyHash: reviewReplyHash(text),
        replyText: text,
        targetHash: valid.state.target!.fingerprint,
        at: now,
        profileId: actorId,
      };
      assert.equal(
        (await publishReviewRunReply(runId, text, valid.dependencies)).ok,
        true,
      );
      assert.equal(valid.state.audits[0].profileId, actorId);
    },
  );
  await check(
    "provider-specific normalization preserves Google paragraphs and collapses QMAPS whitespace without truncation",
    async () => {
      const google = fixture({
        reply: "First paragraph.\n\nSecond paragraph.",
      });
      assert.equal(
        (await publishReviewRunReply(runId, google.reply, google.dependencies))
          .ok,
        true,
      );
      const qmaps = fixture({ source: "qmaps", reply: "  First\n   second  " });
      assert.equal(qmaps.reply, "First second");
      assert.equal(
        (
          await publishReviewRunReply(
            runId,
            "First\tsecond",
            qmaps.dependencies,
          )
        ).ok,
        true,
      );
      assert.deepEqual(
        await publishReviewRunReply(
          runId,
          "a".repeat(4001),
          fixture().dependencies,
        ),
        { ok: false, code: "invalid_request" },
      );
      assert.deepEqual(
        await publishReviewRunReply(
          runId,
          "a".repeat(2001),
          fixture({ source: "qmaps" }).dependencies,
        ),
        { ok: false, code: "invalid_request" },
      );
    },
  );
  await check(
    "QMAPS uses current source/business IDs and updates only the scoped native reply projection",
    async () => {
      const f = fixture({ source: "qmaps" });
      assert.equal(
        (await publishReviewRunReply(runId, text, f.dependencies)).ok,
        true,
      );
      assert.equal(f.counters().localUpdates, 1);
      assert.equal(f.state.tracked!.metadata.preserved, "value");
      assert.equal(f.state.tracked!.metadata.replyState, "sent_to_qmaps");
      assert.equal(f.state.tracked!.metadata.replyText, text);
      const query = f.queries.find((q) => q.kind === "tracked-read")!
        .args as Args;
      assert.equal(query.where.clientId, clientId);
      assert.equal(query.where.provider, "qmaps");
      assert.equal(object(query.where.metadata).equals, sourceId);
      assert.ok(JSON.stringify(query.where).includes(businessId));
    },
  );
  await check(
    "legacy execution still requires exact stored output and legacy fast mode requires current explicit Google setting",
    async () => {
      const legacy = fixture({ legacy: true });
      assert.equal(
        (await publishReviewRunReply(runId, text, legacy.dependencies)).ok,
        true,
      );
      const mismatch = fixture({ legacy: true });
      assert.deepEqual(
        await publishReviewRunReply(runId, "Different", mismatch.dependencies),
        { ok: false, code: "draft_mismatch" },
      );
      const fast = fixture({
        legacy: true,
        status: "running",
        requireApproval: false,
      });
      fast.state.run.output = null;
      assert.equal(
        (await publishReviewRunReply(runId, text, fast.dependencies)).ok,
        true,
      );
      const guarded = fixture({
        legacy: true,
        status: "running",
        requireApproval: true,
      });
      assert.deepEqual(
        await publishReviewRunReply(runId, text, guarded.dependencies),
        { ok: false, code: "approval_required" },
      );
      const unowned = fixture({
        legacy: true,
        status: "running",
        source: "qmaps",
        requireApproval: false,
      });
      assert.deepEqual(
        await publishReviewRunReply(runId, text, unowned.dependencies),
        { ok: false, code: "approval_required" },
      );
    },
  );
  await check(
    "first-party feedback never causes an external publication",
    async () => {
      const f = fixture({ source: "takatak" });
      assert.deepEqual(
        await publishReviewRunReply(runId, text, f.dependencies),
        { ok: false, code: "unsupported_source" },
      );
      assert.equal(f.counters().sourceCalls, 0);
    },
  );
  await check(
    "concurrent requests acquire exactly one lease and never send two replies",
    async () => {
      const f = fixture();
      let ready!: () => void, release!: () => void;
      const started = new Promise<void>((resolve) => (ready = resolve)),
        held = new Promise<void>((resolve) => (release = resolve));
      f.dependencies.googleReply = async () => {
        f.sourceCalled();
        ready();
        await held;
        return { ok: true };
      };
      const first = publishReviewRunReply(runId, text, f.dependencies);
      await started;
      const second = await publishReviewRunReply(runId, text, f.dependencies);
      assert.deepEqual(second, { ok: false, code: "publication_pending" });
      release();
      assert.equal((await first).ok, true);
      assert.equal(f.counters().sourceCalls, 1);
      assert.equal(f.counters().leases, 1);
    },
  );
  await check(
    "receipt survives a simultaneous terminal worker report without overwriting its output",
    async () => {
      const f = fixture();
      f.dependencies.googleReply = async () => {
        f.sourceCalled();
        f.state.run.status = "completed";
        f.state.run.output = { summary: "Worker finished" };
        return { ok: true };
      };
      assert.equal(
        (await publishReviewRunReply(runId, text, f.dependencies)).ok,
        true,
      );
      assert.equal(f.state.run.status, "completed");
      assert.deepEqual(f.state.run.output, { summary: "Worker finished" });
      assert.equal(
        object(f.state.run.input.reviewPublication).state,
        "confirmed",
      );
    },
  );
  await check(
    "source errors and lost responses persist uncertainty and prevent automatic retries",
    async () => {
      for (const throwing of [false, true]) {
        const f = fixture();
        f.dependencies.googleReply = async () => {
          f.sourceCalled();
          if (throwing) throw Error("synthetic transport failure");
          return { ok: false, reason: "unreachable" };
        };
        assert.deepEqual(
          await publishReviewRunReply(runId, text, f.dependencies),
          { ok: false, code: "source_unconfirmed" },
        );
        assert.equal(
          object(f.state.run.input.reviewPublication).state,
          "uncertain",
        );
        assert.deepEqual(
          await publishReviewRunReply(runId, text, f.dependencies),
          { ok: false, code: "publication_uncertain" },
        );
        assert.equal(f.counters().sourceCalls, 1);
      }
    },
  );
  await check(
    "provably unconfigured attempts remain not-sent and cannot silently auto-retry",
    async () => {
      const f = fixture();
      f.dependencies.googleReply = async () => {
        f.sourceCalled();
        return { ok: false, reason: "not_configured" };
      };
      assert.deepEqual(
        await publishReviewRunReply(runId, text, f.dependencies),
        { ok: false, code: "not_configured" },
      );
      assert.equal(
        object(f.state.run.input.reviewPublication).state,
        "not_sent",
      );
      assert.deepEqual(
        await publishReviewRunReply(runId, text, f.dependencies),
        { ok: false, code: "not_configured" },
      );
      assert.equal(f.counters().sourceCalls, 1);
    },
  );
  await check(
    "receipt or audit failure keeps a blocking sending lease rather than reporting publication success",
    async () => {
      for (const options of [{ auditError: true }, { receiptFailure: true }]) {
        const f = fixture(options);
        assert.deepEqual(
          await publishReviewRunReply(runId, text, f.dependencies),
          { ok: false, code: "publication_uncertain" },
        );
        assert.equal(
          object(f.state.run.input.reviewPublication).state,
          "sending",
        );
        assert.equal(f.state.audits.length, 0);
        assert.deepEqual(
          await publishReviewRunReply(runId, text, f.dependencies),
          { ok: false, code: "publication_pending" },
        );
        assert.equal(f.counters().sourceCalls, 1);
      }
    },
  );
  await check(
    "audits retain counts and immutable target/hash without reply text and publisher never accesses credit ledger",
    async () => {
      const f = fixture();
      await publishReviewRunReply(runId, text, f.dependencies);
      assert.equal(f.state.audits.length, 1);
      const audit = f.state.audits[0];
      assert.equal(audit.clientId, clientId);
      assert.equal(audit.profileId, actorId);
      assert.equal(audit.action, "reputation.reply.confirmed");
      const data = object(audit.metadata);
      assert.equal(data.confirmed, 1);
      assert.equal(data.reviewId, reviewId);
      assert.equal(data.replyHash, reviewReplyHash(text));
      assert.equal(JSON.stringify(f.state.audits).includes(text), false);
    },
  );
  console.log(
    `Review publisher: ${count} checks passed. Synthetic stores/providers only; no publication or credit debit occurred.`,
  );
}
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw Error("No network allowed in publisher tests");
};
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
