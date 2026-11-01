import assert from "node:assert/strict";
import { enqueueCanonicalReviewRun } from "../src/lib/reputation/review-run-queue";
import type { PrismaClient } from "@prisma/client";
import {
  canonicalReviewReply,
  reviewRequiresHumanApproval,
  type ReviewDraftSource,
} from "../src/lib/reputation/review-target-model";
import {
  resolveReviewTarget,
  reviewReplyHash,
} from "../src/lib/reputation/review-target";
import {
  getReviewApprovals,
  decideReviewDraft,
} from "../src/lib/reputation/review-approval-service";

const tenant = "11111111-1111-4111-8111-111111111111";
const actor = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const reviewId = "44444444-4444-4444-8444-444444444444";
const locationId = "55555555-5555-4555-8555-555555555555";
const businessId = "66666666-6666-4666-8666-666666666666";
const sourceReviewId = "77777777-7777-4777-8777-777777777777";
const otherTenant = "88888888-8888-4888-8888-888888888888";
const when = new Date("2026-01-01T12:00:00.000Z");
const draft = "Thank you for your review. Our team appreciates your visit.";
type Data = Record<string, unknown>;
type Run = {
  id: string;
  clientId: string;
  agentKey: string;
  status: string;
  input: Data;
  output: Data;
  creditsDebited: number;
  createdAt: Date;
  updatedAt: Date;
  decidedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  decidedByProfileId?: string;
};
type Query = { table: string; args: Data; inTransaction: boolean };
const object = (value: unknown): Data =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Data)
    : {};
function matches(row: Data, where: Data): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "AND")
      return (Array.isArray(expected) ? expected : [expected]).every((part) =>
        matches(row, object(part)),
      );
    if (key === "OR")
      return (expected as unknown[]).some((part) => matches(row, object(part)));
    const value = row[key];
    if (expected instanceof Date)
      return value instanceof Date && expected.getTime() === value.getTime();
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const op = expected as Data;
      if ("path" in op) {
        let nested: unknown = value;
        for (const part of op.path as string[]) nested = object(nested)[part];
        return nested === op.equals;
      }
      if ("equals" in op)
        return JSON.stringify(value) === JSON.stringify(op.equals);
      if ("in" in op) return (op.in as unknown[]).includes(value);
      if ("notIn" in op) return !(op.notIn as unknown[]).includes(value);
      if ("not" in op) return value !== op.not;
      return matches(object(value), op);
    }
    return value === expected;
  });
}
function fixture(source: ReviewDraftSource = "google") {
  const row: Data = {
    id: reviewId,
    clientId: tenant,
    source: "google",
    externalId: "synthetic-source-review",
    rating: 4,
    comment: "A fictional customer experience.",
    reviewerName: "Synthetic reviewer",
    replyComment: null,
    replyUpdatedAt: null,
    location: {
      id: locationId,
      clientId: tenant,
      title: "Synthetic Montreal branch",
      resourceName: "accounts/123/locations/456",
    },
    feedback: "A fictional customer experience.",
    contactName: "Synthetic reviewer",
    profile: {
      id: locationId,
      clientId: tenant,
      name: "Synthetic Montreal branch",
    },
    provider: "qmaps",
    status: "needs_review",
    body: "A fictional customer experience.",
    metadata: { source: "qmaps", qmapsReviewId: sourceReviewId },
    localListing: {
      id: locationId,
      clientId: tenant,
      provider: "qmaps",
      status: "active_internal",
      name: "Synthetic Montreal branch",
      businessBrandId: null,
      metadata: { qmapsBusinessId: businessId },
    },
  };
  const runs: Run[] = [
    {
      id: runId,
      clientId: tenant,
      agentKey: "review_responder",
      status: "awaiting_approval",
      input: { source, reviewResponseId: reviewId, reviewWorkflowVersion: 2 },
      output: { reply: draft, internalMetadata: "private-output-secret" },
      creditsDebited: 1,
      createdAt: new Date(when),
      updatedAt: new Date(when),
      decidedAt: null,
      completedAt: null,
      error: null,
    },
  ];
  const queries: Query[] = [],
    writes: Data[] = [],
    audits: Data[] = [];
  let inTransaction = false,
    transactions = 0,
    missingSource = false,
    ambiguous = false,
    failCAS = false,
    failAudit = false;
  const log = (table: string, args: unknown) => {
    const query = object(args);
    queries.push({ table, args: query, inTransaction });
    return query;
  };
  const sourceRead = (table: string) => async (args: unknown) => {
    const query = log(table, args);
    return !missingSource && matches(row, object(query.where)) ? row : null;
  };
  const runFind = async (args: unknown) => {
    const query = log("aiAgentRun.findFirst", args);
    return (
      runs.find((run) =>
        matches(run as unknown as Data, object(query.where)),
      ) ?? null
    );
  };
  const tx = {
    externalReview: { findFirst: sourceRead("externalReview.findFirst") },
    reviewResponse: { findFirst: sourceRead("reviewResponse.findFirst") },
    listingReview: { findFirst: sourceRead("listingReview.findFirst") },
    localListing: {
      findMany: async (args: unknown) => {
        log("localListing.findMany", args);
        return ambiguous
          ? [{ id: locationId }, { id: otherTenant }]
          : [{ id: locationId }];
      },
    },
    aiAgentRun: {
      findMany: async (args: unknown) => {
        const query = log("aiAgentRun.findMany", args);
        return runs
          .filter((run) => matches(run as unknown as Data, object(query.where)))
          .slice(0, Number(query.take ?? Infinity));
      },
      findFirst: runFind,
      findUnique: runFind,
      updateMany: async (args: unknown) => {
        assert.equal(inTransaction, true);
        const query = log("aiAgentRun.updateMany", args);
        writes.push(query);
        if (failCAS) return { count: 0 };
        let count = 0;
        for (const run of runs) {
          if (matches(run as unknown as Data, object(query.where))) {
            Object.assign(run, object(query.data));
            count++;
          }
        }
        return { count };
      },
    },
    auditLog: {
      create: async (args: unknown) => {
        assert.equal(inTransaction, true);
        const query = log("auditLog.create", args);
        if (failAudit) throw Error("synthetic_audit_failure");
        audits.push(object(query.data));
        return { id: "synthetic-audit" };
      },
    },
  };
  const raw = {
    ...tx,
    $transaction: async <T>(run: (db: typeof tx) => Promise<T>) => {
      transactions++;
      assert.equal(inTransaction, false);
      const before = structuredClone(runs),
        auditCount = audits.length;
      inTransaction = true;
      try {
        return await run(tx);
      } catch (error) {
        runs.splice(0, runs.length, ...before);
        audits.splice(auditCount);
        throw error;
      } finally {
        inTransaction = false;
      }
    },
  };
  return {
    database: raw as unknown as PrismaClient,
    row,
    runs,
    queries,
    writes,
    audits,
    get transactions() {
      return transactions;
    },
    missing() {
      missingSource = true;
    },
    ambiguous() {
      ambiguous = true;
    },
    race() {
      failCAS = true;
    },
    auditFailure() {
      failAudit = true;
    },
  };
}
async function prepare(source: ReviewDraftSource = "google") {
  const state = fixture(source);
  const target = await resolveReviewTarget(
    state.database,
    tenant,
    source,
    reviewId,
  );
  assert.ok(target);
  state.runs[0].input.reviewContentHash = target.fingerprint;
  return state;
}
async function decisionHash(state: ReturnType<typeof fixture>) {
  const rows = await getReviewApprovals(tenant, state.database);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].draftHash);
  return rows[0].draftHash!;
}
type QueueRow = {
  id: string;
  clientId: string;
  agentKey: string;
  status: string;
  input: Data;
  requestedByProfileId?: string | null;
  trigger?: string;
};
function queueFixture() {
  const rows: QueueRow[] = [],
    locks: Array<{
      text: string;
      values: unknown[];
      transaction: number;
    }> = [],
    reads: Data[] = [],
    creates: Data[] = [],
    audits: Data[] = [];
  const enabled = new Map<string, boolean | null>([
    [tenant, true],
    [otherTenant, true],
  ]);
  const tails = new Map<string, Promise<void>>();
  let transactionCount = 0,
    ledgerCalls = 0;
  const raw = {
    async $transaction<T>(run: (tx: unknown) => Promise<T>): Promise<T> {
      const transaction = ++transactionCount;
      let locked = false,
        release: (() => void) | null = null;
      const tx = {
        async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
          const text = strings.join("?");
          locks.push({ text, values, transaction });
          assert.match(text, /SELECT "enabled" FROM "ai_agent_settings"/);
          assert.match(text, /"clientId" = \?::uuid/);
          assert.match(text, /"agentKey" = 'review_responder' FOR UPDATE/);
          assert.equal(values.length, 1);
          const client = String(values[0]);
          const previous = tails.get(client) ?? Promise.resolve();
          let unlock: () => void = () => {};
          const held = new Promise<void>((resolve) => {
            unlock = resolve;
          });
          tails.set(
            client,
            previous.then(() => held),
          );
          await previous;
          locked = true;
          release = unlock;
          const setting = enabled.get(client);
          return setting === null || setting === undefined
            ? []
            : [{ enabled: setting }];
        },
        aiAgentRun: {
          async findMany(args: unknown) {
            assert.equal(
              locked,
              true,
              "pending work must be read after the existing agent row is locked",
            );
            const query = object(args);
            reads.push(query);
            return rows
              .filter((row) =>
                matches(row as unknown as Data, object(query.where)),
              )
              .slice(0, Number(query.take ?? Infinity));
          },
          async create(args: unknown) {
            assert.equal(
              locked,
              true,
              "creation must be under the existing agent row lock",
            );
            const query = object(args),
              data = structuredClone(object(query.data));
            creates.push(data);
            const id = `99999999-9999-4999-8999-${String(rows.length + 1).padStart(12, "0")}`;
            rows.push({ id, status: "queued", ...data } as QueueRow);
            return { id };
          },
        },
        auditLog: {
          async create(args: unknown) {
            audits.push(object(object(args).data));
            return { id: "synthetic-queue-audit" };
          },
        },
        aiCreditWallet: {
          async updateMany() {
            ledgerCalls++;
            throw Error("Queue creation must not debit credits.");
          },
        },
        aiCreditLedger: {
          async create() {
            ledgerCalls++;
            throw Error("Queue creation must not debit credits.");
          },
        },
      };
      try {
        return await run(tx);
      } finally {
        if (release) (release as () => void)();
      }
    },
  };
  return {
    database: raw as unknown as PrismaClient,
    rows,
    locks,
    reads,
    creates,
    audits,
    enabled,
    get transactions() {
      return transactionCount;
    },
    get ledgerCalls() {
      return ledgerCalls;
    },
  };
}
const queueInput = (
  source: ReviewDraftSource = "google",
  id = reviewId,
): Record<string, string | number> => ({
  reviewResponseId: id,
  source,
  reviewWorkflowVersion: 2,
  reviewContentHash: "a".repeat(64),
  feedback: "Synthetic queue test feedback",
});

function approvalReceipt(
  state: ReturnType<typeof fixture>,
  text = draft,
): Data {
  return {
    replyText: text,
    replyHash: reviewReplyHash(text),
    targetHash: state.runs[0].input.reviewContentHash,
    at: when.toISOString(),
    profileId: actor,
  };
}
function publicationReceipt(
  state: ReturnType<typeof fixture>,
  overrides: Data = {},
): Data {
  const receipt: Data = {
    attemptId: sourceReviewId,
    state: "confirmed",
    replyHash: reviewReplyHash(draft),
    source: state.runs[0].input.source,
    reviewId,
    targetHash: state.runs[0].input.reviewContentHash ?? "b".repeat(64),
    at: when.toISOString(),
    confirmedAt: "2026-01-02T12:00:00.000Z",
    ...overrides,
  };
  if (receipt.state !== "confirmed") delete receipt.confirmedAt;
  return receipt;
}
let count = 0;
async function check(name: string, run: () => unknown | Promise<unknown>) {
  await run();
  count++;
  console.log("PASS", name);
}
async function main() {
  const oldFetch = globalThis.fetch;
  let network = 0;
  globalThis.fetch = async () => {
    network++;
    throw Error("Approval must not send a provider request.");
  };
  try {
    await check(
      "provider reply normalization preserves Google paragraphs and canonicalizes QMAPS without silent truncation",
      () => {
        assert.equal(
          canonicalReviewReply(
            "google",
            "  Thank you.\n\nWe will follow up.  ",
          ),
          "Thank you.\n\nWe will follow up.",
        );
        assert.equal(
          canonicalReviewReply(
            "qmaps",
            "  Thank you.\n\n We will follow up.  ",
          ),
          "Thank you. We will follow up.",
        );
        assert.equal(
          canonicalReviewReply("google", "x".repeat(4000)),
          "x".repeat(4000),
        );
        assert.equal(canonicalReviewReply("google", "x".repeat(4001)), null);
        assert.equal(
          canonicalReviewReply("qmaps", "x".repeat(2000)),
          "x".repeat(2000),
        );
        assert.equal(canonicalReviewReply("qmaps", "x".repeat(2001)), null);
        for (const value of [null, {}, 1, "", "   ", "text\u0000secret"])
          assert.equal(canonicalReviewReply("google", value), null);
      },
    );
    await check(
      "target resolution pins both record and related source ownership",
      async () => {
        for (const source of ["google", "qmaps", "takatak"] as const) {
          const state = await prepare(source);
          const target = await resolveReviewTarget(
            state.database,
            tenant,
            source,
            reviewId,
          );
          assert.equal(target?.source, source);
          const query = state.queries.find(
            (query) =>
              query.table ===
              {
                google: "externalReview.findFirst",
                qmaps: "listingReview.findFirst",
                takatak: "reviewResponse.findFirst",
              }[source],
          )!;
          const where = object(query.args.where);
          assert.equal(where.clientId, tenant);
          assert.equal(where.id, reviewId);
          assert.ok(
            JSON.stringify(where).includes('"clientId":"' + tenant + '"'),
          );
          const nested = object(
            where[
              source === "google"
                ? "location"
                : source === "qmaps"
                  ? "localListing"
                  : "profile"
            ],
          );
          assert.equal(nested.clientId, tenant);
          assert.equal(
            await resolveReviewTarget(
              state.database,
              otherTenant,
              source,
              reviewId,
            ),
            null,
          );
        }
      },
    );
    await check(
      "QMAPS targets reject archives, operator imports and ambiguous business mappings",
      async () => {
        const archived = fixture("qmaps");
        archived.row.status = "archived";
        assert.equal(
          await resolveReviewTarget(
            archived.database,
            tenant,
            "qmaps",
            reviewId,
          ),
          null,
        );
        const imported = fixture("qmaps");
        imported.row.metadata = {
          source: "reviewed_import",
          qmapsReviewId: sourceReviewId,
        };
        assert.equal(
          await resolveReviewTarget(
            imported.database,
            tenant,
            "qmaps",
            reviewId,
          ),
          null,
        );
        const ambiguous = fixture("qmaps");
        ambiguous.ambiguous();
        assert.equal(
          await resolveReviewTarget(
            ambiguous.database,
            tenant,
            "qmaps",
            reviewId,
          ),
          null,
        );
      },
    );
    await check(
      "target fingerprints bind source contents, rating and QMAPS source mapping",
      async () => {
        const state = await prepare("qmaps");
        const first = await resolveReviewTarget(
          state.database,
          tenant,
          "qmaps",
          reviewId,
        );
        state.row.body = "Changed source comment";
        const changed = await resolveReviewTarget(
          state.database,
          tenant,
          "qmaps",
          reviewId,
        );
        assert.notEqual(first?.fingerprint, changed?.fingerprint);
        state.row.body = "A fictional customer experience.";
        state.row.rating = 1;
        assert.notEqual(
          first?.fingerprint,
          (await resolveReviewTarget(state.database, tenant, "qmaps", reviewId))
            ?.fingerprint,
        );
      },
    );
    await check(
      "approval fingerprints bind provider locators and existing source reply state",
      async () => {
        const google = await prepare();
        const initial = (await resolveReviewTarget(
          google.database,
          tenant,
          "google",
          reviewId,
        ))!.fingerprint;
        object(google.row.location).id = businessId;
        assert.notEqual(
          (await resolveReviewTarget(
            google.database,
            tenant,
            "google",
            reviewId,
          ))!.fingerprint,
          initial,
        );
        object(google.row.location).id = locationId;
        object(google.row.location).resourceName = "accounts/987/locations/654";
        assert.notEqual(
          (await resolveReviewTarget(
            google.database,
            tenant,
            "google",
            reviewId,
          ))!.fingerprint,
          initial,
        );
        object(google.row.location).resourceName = "accounts/123/locations/456";
        google.row.externalId = "different-source-review";
        assert.notEqual(
          (await resolveReviewTarget(
            google.database,
            tenant,
            "google",
            reviewId,
          ))!.fingerprint,
          initial,
        );
        google.row.externalId = "synthetic-source-review";
        google.row.replyComment = "A reply recorded after generation.";
        google.row.replyUpdatedAt = new Date("2026-01-02T12:00:00.000Z");
        assert.notEqual(
          (await resolveReviewTarget(
            google.database,
            tenant,
            "google",
            reviewId,
          ))!.fingerprint,
          initial,
        );
        const local = await prepare("takatak");
        const localHash = (await resolveReviewTarget(
          local.database,
          tenant,
          "takatak",
          reviewId,
        ))!.fingerprint;
        object(local.row.profile).id = businessId;
        assert.notEqual(
          (await resolveReviewTarget(
            local.database,
            tenant,
            "takatak",
            reviewId,
          ))!.fingerprint,
          localHash,
        );
      },
    );
    await check(
      "approval list excludes foreign tenants and other agents before applying its fifty-run window",
      async () => {
        const state = await prepare();
        state.runs.unshift({
          ...structuredClone(state.runs[0]),
          id: otherTenant,
          clientId: otherTenant,
          output: { reply: "Foreign tenant secret" },
        });
        state.runs.unshift({
          ...structuredClone(state.runs[1]),
          id: businessId,
          agentKey: "social_autopilot",
          output: { reply: "Other agent private output" },
        });
        for (let index = 1; index < 60; index++)
          state.runs.push({
            ...structuredClone(state.runs[2]),
            id: `99999999-9999-4999-8999-${String(index).padStart(12, "0")}`,
          });
        const rows = await getReviewApprovals(tenant, state.database);
        assert.equal(rows.length, 50);
        assert.equal(
          rows.some((row) => row.id === otherTenant || row.id === businessId),
          false,
        );
        assert.equal(
          JSON.stringify(rows).includes("Foreign tenant secret"),
          false,
        );
        assert.equal(
          JSON.stringify(rows).includes("Other agent private output"),
          false,
        );
      },
    );
    await check(
      "approval projection reads a bounded canonical responder window and omits private inputs and worker errors",
      async () => {
        const state = await prepare();
        state.runs[0].input.privateCredential = "private-input-secret";
        state.runs[0].error = "private-worker-stack-or-token";
        const rows = await getReviewApprovals(tenant, state.database);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].draft, draft);
        assert.equal(rows[0].creditsDebited, 1);
        assert.equal(rows[0].publishedAt, null);
        assert.equal(rows[0].blockedReason, null);
        const select = state.queries.find(
          (query) => query.table === "aiAgentRun.findMany",
        )!;
        assert.equal(select.args.take, 50);
        assert.deepEqual(object(select.args.where), {
          clientId: tenant,
          agentKey: "review_responder",
        });
        for (const text of [
          "private-input-secret",
          "private-output-secret",
          "private-worker-stack-or-token",
          "contactEmail",
          "contactPhone",
        ]) {
          assert.equal(JSON.stringify(rows).includes(text), false);
        }
      },
    );
    await check(
      "queued or completed run status never invents a draft or a public publication",
      async () => {
        const state = await prepare();
        state.runs[0].output = {};
        state.runs[0].status = "queued";
        let rows = await getReviewApprovals(tenant, state.database);
        assert.equal(rows[0].draft, null);
        assert.equal(rows[0].publishedAt, null);
        state.runs[0].status = "completed";
        state.runs[0].output = { reply: draft };
        rows = await getReviewApprovals(tenant, state.database);
        assert.equal(rows[0].publishedAt, null);
      },
    );
    await check(
      "invalid or missing source data stays unavailable without exposing a target or enabling approval",
      async () => {
        const state = await prepare();
        state.missing();
        const rows = await getReviewApprovals(tenant, state.database);
        assert.equal(rows[0].reviewId, null);
        assert.equal(rows[0].reviewText, null);
        assert.ok(rows[0].blockedReason);
        const result = await decideReviewDraft(
          tenant,
          actor,
          runId,
          "approve",
          rows[0].draftHash!,
          state.database,
        );
        assert.equal(result.ok, false);
        assert.equal(state.writes.length, 0);
      },
    );
    await check(
      "an overlong generated draft is not truncated into an approvable text",
      async () => {
        const state = await prepare("qmaps");
        state.runs[0].output = { reply: "x".repeat(2001) };
        const rows = await getReviewApprovals(tenant, state.database);
        assert.equal(rows[0].draft, null);
        assert.ok(rows[0].blockedReason);
        assert.equal(
          (
            await decideReviewDraft(
              tenant,
              actor,
              runId,
              "approve",
              rows[0].draftHash!,
              state.database,
            )
          ).ok,
          false,
        );
        assert.equal(state.writes.length, 0);
      },
    );
    await check(
      "source changes invalidate version2 approval even if the displayed draft is unchanged",
      async () => {
        const state = await prepare();
        const hash = await decisionHash(state);
        state.row.comment = "The source changed after generation.";
        const rows = await getReviewApprovals(tenant, state.database);
        assert.ok(rows[0].blockedReason);
        const result = await decideReviewDraft(
          tenant,
          actor,
          runId,
          "approve",
          hash,
          state.database,
        );
        assert.equal(result.ok, false);
        assert.equal(state.writes.length, 0);
        assert.equal(state.audits.length, 0);
      },
    );
    await check(
      "approve freezes the exact canonical payload and actor under one scoped compare-and-set",
      async () => {
        const state = await prepare("qmaps");
        state.runs[0].output = { reply: "  Thank you.\n\nWe will improve.  " };
        const target = await resolveReviewTarget(
          state.database,
          tenant,
          "qmaps",
          reviewId,
        );
        const hash = await decisionHash(state);
        const result = await decideReviewDraft(
          tenant,
          actor,
          runId,
          "approve",
          hash,
          state.database,
        );
        assert.equal(result.ok, true);
        assert.equal(state.runs[0].status, "approved");
        assert.equal(state.runs[0].decidedByProfileId, actor);
        const approval = object(state.runs[0].input.reviewApproval);
        assert.equal(approval.replyText, "Thank you. We will improve.");
        assert.equal(
          approval.replyHash,
          reviewReplyHash("Thank you. We will improve."),
        );
        assert.equal(approval.targetHash, target!.fingerprint);
        assert.equal(approval.profileId, actor);
        assert.ok(Number.isFinite(Date.parse(String(approval.at))));
        const query = state.writes[0];
        assert.deepEqual(object(query.where), {
          id: runId,
          clientId: tenant,
          agentKey: "review_responder",
          status: "awaiting_approval",
          updatedAt: when,
        });
        assert.equal(state.transactions, 1);
        assert.equal(state.audits.length, 1);
        assert.equal(
          state.queries
            .filter(
              (q) =>
                q.table.startsWith("aiAgentRun.") &&
                q.table !== "aiAgentRun.findMany",
            )
            .every((q) => q.inTransaction),
          true,
        );
      },
    );
    await check(
      "Google approval preserves paragraphs and never reports publication from the decision",
      async () => {
        const state = await prepare();
        state.runs[0].output = {
          reply: "Thank you.\n\nWe appreciate the feedback.",
        };
        const result = await decideReviewDraft(
          tenant,
          actor,
          runId,
          "approve",
          await decisionHash(state),
          state.database,
        );
        assert.equal(result.ok, true);
        assert.equal(
          object(state.runs[0].input.reviewApproval).replyText,
          "Thank you.\n\nWe appreciate the feedback.",
        );
        assert.equal(
          (await getReviewApprovals(tenant, state.database))[0].publishedAt,
          null,
        );
      },
    );
    await check(
      "accepting a first-party draft completes internal review without scheduling a public reply",
      async () => {
        const state = await prepare("takatak");
        const result = await decideReviewDraft(
          tenant,
          actor,
          runId,
          "approve",
          await decisionHash(state),
          state.database,
        );
        assert.equal(result.ok, true);
        assert.equal(state.runs[0].status, "completed");
        assert.ok(state.runs[0].completedAt instanceof Date);
        assert.equal(
          (await getReviewApprovals(tenant, state.database))[0].publishedAt,
          null,
        );
        assert.equal(network, 0);
      },
    );
    await check(
      "reject remains possible for missing sources and invalid drafts but still requires a current decision hash",
      async () => {
        const state = await prepare();
        state.missing();
        state.runs[0].output = { reply: "" };
        const result = await decideReviewDraft(
          tenant,
          actor,
          runId,
          "reject",
          await decisionHash(state),
          state.database,
        );
        assert.equal(result.ok, true);
        assert.equal(state.runs[0].status, "rejected");
        assert.equal(state.runs[0].input.reviewApproval, undefined);
        assert.ok(state.runs[0].completedAt instanceof Date);
      },
    );
    await check(
      "foreign tenants, other agents and already-decided runs cannot receive review decisions",
      async () => {
        for (const variant of ["tenant", "agent", "status"]) {
          const state = await prepare();
          const hash = await decisionHash(state);
          if (variant === "tenant") state.runs[0].clientId = otherTenant;
          else if (variant === "agent")
            state.runs[0].agentKey = "social_autopilot";
          else state.runs[0].status = "approved";
          const result = await decideReviewDraft(
            tenant,
            actor,
            runId,
            "approve",
            hash,
            state.database,
          );
          assert.equal(result.ok, false);
          assert.equal(state.writes.length, 0);
          assert.equal(state.audits.length, 0);
        }
      },
    );
    await check(
      "stale hash, changed draft and changed input reject without a write",
      async () => {
        for (const variant of ["hash", "draft", "input", "timestamp"]) {
          const state = await prepare();
          let hash = await decisionHash(state);
          if (variant === "hash") hash = "0".repeat(64);
          else if (variant === "draft")
            state.runs[0].output.reply = "Another generated reply";
          else if (variant === "input") state.runs[0].input.source = "qmaps";
          else state.runs[0].updatedAt = new Date(when.getTime() + 1000);
          const result = await decideReviewDraft(
            tenant,
            actor,
            runId,
            "approve",
            hash,
            state.database,
          );
          assert.equal(result.ok, false);
          assert.equal(state.writes.length, 0);
          assert.equal(state.audits.length, 0);
        }
      },
    );
    await check(
      "concurrent decisions return conflict and never insert a success audit",
      async () => {
        const state = await prepare();
        state.race();
        const result = await decideReviewDraft(
          tenant,
          actor,
          runId,
          "approve",
          await decisionHash(state),
          state.database,
        );
        assert.equal(result.ok, false);
        assert.equal(state.runs[0].status, "awaiting_approval");
        assert.equal(state.audits.length, 0);
      },
    );
    await check(
      "a repeated approval is not applied twice and never charges again",
      async () => {
        const state = await prepare();
        const hash = await decisionHash(state);
        assert.equal(
          (
            await decideReviewDraft(
              tenant,
              actor,
              runId,
              "approve",
              hash,
              state.database,
            )
          ).ok,
          true,
        );
        assert.equal(
          (
            await decideReviewDraft(
              tenant,
              actor,
              runId,
              "approve",
              hash,
              state.database,
            )
          ).ok,
          false,
        );
        assert.equal(state.audits.length, 1);
        assert.equal(state.runs[0].creditsDebited, 1);
        assert.equal(network, 0);
      },
    );
    await check(
      "decision audit stores hashes and identifiers rather than response text or private review contents",
      async () => {
        const state = await prepare();
        await decideReviewDraft(
          tenant,
          actor,
          runId,
          "approve",
          await decisionHash(state),
          state.database,
        );
        const audit = state.audits[0];
        assert.equal(audit.clientId, tenant);
        assert.equal(audit.profileId, actor);
        assert.equal(audit.action, "reputation.draft.approve");
        for (const secret of [
          draft,
          "A fictional customer experience.",
          "private-output-secret",
        ]) {
          assert.equal(JSON.stringify(audit).includes(secret), false);
        }
        assert.equal(object(audit.metadata).replyHash, reviewReplyHash(draft));
      },
    );
    await check(
      "an audit failure propagates instead of returning a false successful decision",
      async () => {
        const state = await prepare();
        state.auditFailure();
        await assert.rejects(
          decideReviewDraft(
            tenant,
            actor,
            runId,
            "approve",
            await decisionHash(state),
            state.database,
          ),
          /synthetic_audit_failure/,
        );
        assert.equal(state.runs[0].status, "awaiting_approval");
        assert.equal(state.audits.length, 0);
      },
    );
    await check(
      "publication requires a matching approval hash and source evidence rather than a run status",
      async () => {
        const state = await prepare();
        const replyHash = reviewReplyHash(draft);
        state.runs[0].input.reviewApproval = approvalReceipt(state);
        state.runs[0].input.reviewPublication = publicationReceipt(state, {
          replyHash: "0".repeat(64),
        });
        assert.equal(
          (await getReviewApprovals(tenant, state.database))[0].publishedAt,
          null,
        );
        state.runs[0].input.reviewPublication = publicationReceipt(state);

        assert.equal(
          (await getReviewApprovals(tenant, state.database))[0].publishedAt,
          "2026-01-02T12:00:00.000Z",
        );
      },
    );
    await check(
      "uncertain publication reconciles only the exact approved text at an appropriate source time",
      async () => {
        const state = await prepare();
        state.runs[0].input.reviewApproval = approvalReceipt(state);
        state.runs[0].input.reviewPublication = publicationReceipt(state, {
          state: "uncertain",
          at: "2026-01-02T12:00:00.000Z",
        });
        state.row.replyComment = draft;
        state.row.replyUpdatedAt = new Date("2026-01-01T12:00:00.000Z");
        assert.equal(
          (await getReviewApprovals(tenant, state.database))[0].publishedAt,
          null,
        );
        state.row.replyUpdatedAt = new Date("2026-01-03T12:00:00.000Z");
        assert.equal(
          (await getReviewApprovals(tenant, state.database))[0].publishedAt,
          "2026-01-03T12:00:00.000Z",
        );
        state.row.replyComment = "A different public reply";
        assert.equal(
          (await getReviewApprovals(tenant, state.database))[0].publishedAt,
          null,
        );
      },
    );
    await check(
      "invalid identities and hashes fail before a database transaction",
      async () => {
        const state = await prepare();
        for (const args of [
          ["bad", actor, runId, "a".repeat(64)],
          [tenant, "bad", runId, "a".repeat(64)],
          [tenant, actor, "bad", "a".repeat(64)],
          [tenant, actor, runId, "not-a-hash"],
        ]) {
          const result = await decideReviewDraft(
            args[0],
            args[1],
            args[2],
            "approve",
            args[3],
            state.database,
          );
          assert.equal(result.ok, false);
        }
        assert.equal(state.transactions, 0);
        await assert.rejects(
          getReviewApprovals("bad", state.database),
          /invalid_workspace/,
        );
      },
    );
    await check(
      "version2 review generation always requires a human decision without changing legacy or other-agent policies",
      () => {
        assert.equal(
          reviewRequiresHumanApproval("review_responder", {
            reviewWorkflowVersion: 2,
          }),
          true,
        );
        for (const value of [
          null,
          undefined,
          [],
          {},
          { reviewWorkflowVersion: 1 },
          { reviewWorkflowVersion: "2" },
        ])
          assert.equal(
            reviewRequiresHumanApproval("review_responder", value),
            false,
          );
        assert.equal(
          reviewRequiresHumanApproval("chat_concierge", {
            reviewWorkflowVersion: 2,
          }),
          false,
        );
        assert.equal(
          reviewRequiresHumanApproval("social_autopilot", {
            reviewWorkflowVersion: 2,
          }),
          false,
        );
      },
    );
    await check(
      "the approved snapshot remains visible when execution replaces the worker output",
      async () => {
        const state = await prepare();
        assert.equal(
          (
            await decideReviewDraft(
              tenant,
              actor,
              runId,
              "approve",
              await decisionHash(state),
              state.database,
            )
          ).ok,
          true,
        );
        const frozen = object(state.runs[0].input.reviewApproval);
        state.runs[0].status = "completed";
        state.runs[0].output = {
          summary: "Execution finished without repeating the draft",
        };
        state.runs[0].input.reviewPublication = publicationReceipt(state, {
          replyHash: frozen.replyHash,
        });

        const shown = (await getReviewApprovals(tenant, state.database))[0];
        assert.equal(shown.draft, draft);
        assert.equal(shown.publishedAt, "2026-01-02T12:00:00.000Z");
        assert.equal(shown.blockedReason, null);
      },
    );
    await check(
      "confirmed version2 receipts remain visible after the source disappears or changes",
      async () => {
        const missing = await prepare();
        missing.runs[0].input.reviewApproval = approvalReceipt(missing);
        missing.runs[0].input.reviewPublication = publicationReceipt(missing);
        missing.runs[0].status = "completed";
        missing.runs[0].output = { summary: "Source action finished" };
        missing.missing();
        const historical = (
          await getReviewApprovals(tenant, missing.database)
        )[0];
        assert.equal(historical.publishedAt, "2026-01-02T12:00:00.000Z");
        assert.equal(historical.draft, draft);
        assert.equal(historical.reviewId, null);
        assert.equal(historical.reviewText, null);
        assert.equal(historical.blockedReason, null);
        const changed = await prepare();
        changed.runs[0].input.reviewApproval = approvalReceipt(changed);
        changed.runs[0].input.reviewPublication = publicationReceipt(changed);
        changed.runs[0].status = "completed";
        changed.row.comment = "A later edit on the source";
        changed.row.replyComment = "A later different owner reply";
        changed.row.replyUpdatedAt = new Date("2026-01-03T12:00:00.000Z");
        assert.equal(
          (await getReviewApprovals(tenant, changed.database))[0].publishedAt,
          "2026-01-02T12:00:00.000Z",
        );
      },
    );
    await check(
      "legacy source receipts survive missing approval metadata and summary-only terminal reports",
      async () => {
        for (const source of ["google", "qmaps"] as const) {
          const state = await prepare(source);
          const receipt = publicationReceipt(state);
          delete state.runs[0].input.reviewWorkflowVersion;
          delete state.runs[0].input.reviewContentHash;
          state.runs[0].input.reviewPublication = receipt;
          state.runs[0].status = "completed";
          state.runs[0].output = { summary: "Legacy worker terminal report" };
          state.missing();
          const shown = (await getReviewApprovals(tenant, state.database))[0];
          assert.equal(shown.publishedAt, "2026-01-02T12:00:00.000Z");
          assert.equal(shown.draft, null);
          assert.equal(shown.blockedReason, null);
        }
      },
    );
    await check(
      "publication receipts reject source, review, attempt, time and hash mismatches",
      async () => {
        const mutations: Data[] = [
          { source: "qmaps" },
          { source: "takatak" },
          { reviewId: otherTenant },
          { reviewId: "invalid" },
          { attemptId: "invalid" },
          { attemptId: undefined },
          { replyHash: "not-a-hash" },
          { replyHash: "f".repeat(64) },
          { replyHash: "A".repeat(64) },
          { targetHash: "not-a-hash" },
          { targetHash: undefined },
          { targetHash: "f".repeat(64) },
          { targetHash: "A".repeat(64) },
          { at: "invalid" },
          { at: undefined },
          { confirmedAt: "invalid" },
          { confirmedAt: undefined },
          { state: "sending" },
          { state: "uncertain" },
        ];
        for (const mutation of mutations) {
          const state = await prepare();
          state.runs[0].input.reviewApproval = approvalReceipt(state);
          state.runs[0].input.reviewPublication = publicationReceipt(
            state,
            mutation,
          );
          state.runs[0].status = "completed";
          assert.equal(
            (await getReviewApprovals(tenant, state.database))[0].publishedAt,
            null,
            JSON.stringify(mutation),
          );
        }
      },
    );
    await check(
      "version2 receipts require the real frozen approved text while legacy hashes still bind available drafts",
      async () => {
        const absent = await prepare();
        absent.runs[0].input.reviewPublication = publicationReceipt(absent);
        assert.equal(
          (await getReviewApprovals(tenant, absent.database))[0].publishedAt,
          null,
        );
        const changed = await prepare();
        changed.runs[0].input.reviewApproval = {
          ...approvalReceipt(changed),
          replyText: "Different frozen text",
        };
        changed.runs[0].input.reviewPublication = publicationReceipt(changed);
        assert.equal(
          (await getReviewApprovals(tenant, changed.database))[0].publishedAt,
          null,
        );
        const legacy = await prepare();
        delete legacy.runs[0].input.reviewWorkflowVersion;
        legacy.runs[0].input.reviewPublication = publicationReceipt(legacy);
        legacy.runs[0].output = { reply: "A different available legacy draft" };
        assert.equal(
          (await getReviewApprovals(tenant, legacy.database))[0].publishedAt,
          null,
        );
        const internal = await prepare("takatak");
        internal.runs[0].input.reviewApproval = approvalReceipt(internal);
        internal.runs[0].input.reviewPublication = publicationReceipt(
          internal,
          { source: "takatak" },
        );
        assert.equal(
          (await getReviewApprovals(tenant, internal.database))[0].publishedAt,
          null,
        );
      },
    );
    await check(
      "review queue uses the existing client agent row lock and stores canonical actor/source metadata without debiting",
      async () => {
        const state = queueFixture();
        const result = await enqueueCanonicalReviewRun(
          state.database,
          tenant,
          queueInput(),
          actor,
          "review_cockpit_" + "x".repeat(80),
        );
        assert.equal(result.ok, true);
        assert.equal(state.creates.length, 1);
        assert.equal(state.locks[0].values[0], tenant);
        const stored = state.creates[0];
        assert.equal(stored.clientId, tenant);
        assert.equal(stored.agentKey, "review_responder");
        assert.equal(stored.requestedByProfileId, actor);
        assert.equal(String(stored.trigger).length, 40);
        assert.deepEqual(stored.input, queueInput());
        assert.deepEqual(object(state.reads[0].where), {
          clientId: tenant,
          agentKey: "review_responder",
          status: {
            in: [
              "queued",
              "running",
              "awaiting_approval",
              "approved",
              "executing",
            ],
          },
        });
        assert.equal(state.reads[0].take, 50);
        assert.equal(state.ledgerCalls, 0);
      },
    );
    await check(
      "two concurrent requests for one review serialize under the real lock call and create only one run",
      async () => {
        const state = queueFixture();
        const results = await Promise.all([
          enqueueCanonicalReviewRun(
            state.database,
            tenant,
            queueInput(),
            actor,
          ),
          enqueueCanonicalReviewRun(
            state.database,
            tenant,
            queueInput(),
            actor,
          ),
        ]);
        assert.equal(results.filter((result) => result.ok).length, 1);
        assert.equal(
          results.filter(
            (result) => !result.ok && result.error === "already_pending",
          ).length,
          1,
        );
        assert.equal(state.locks.length, 2);
        assert.equal(state.creates.length, 1);
        assert.equal(state.rows.length, 1);
        assert.equal(state.ledgerCalls, 0);
      },
    );
    await check(
      "pending work is deduplicated through generation, human approval and execution including legacy first-party input",
      async () => {
        for (const status of [
          "queued",
          "running",
          "awaiting_approval",
          "approved",
          "executing",
        ]) {
          const state = queueFixture();
          state.rows.push({
            id: runId,
            clientId: tenant,
            agentKey: "review_responder",
            status,
            input: { reviewResponseId: reviewId },
          });
          const result = await enqueueCanonicalReviewRun(
            state.database,
            tenant,
            queueInput("takatak"),
            actor,
          );
          assert.deepEqual(result, { ok: false, error: "already_pending" });
          assert.equal(state.creates.length, 0);
        }
      },
    );
    await check(
      "distinct source reviews and tenants retain separate queue identities",
      async () => {
        const state = queueFixture();
        assert.equal(
          (
            await enqueueCanonicalReviewRun(
              state.database,
              tenant,
              queueInput("google"),
              actor,
            )
          ).ok,
          true,
        );
        assert.equal(
          (
            await enqueueCanonicalReviewRun(
              state.database,
              tenant,
              queueInput("qmaps"),
              actor,
            )
          ).ok,
          true,
        );
        assert.equal(
          (
            await enqueueCanonicalReviewRun(
              state.database,
              tenant,
              queueInput("google", businessId),
              actor,
            )
          ).ok,
          true,
        );
        assert.equal(
          (
            await enqueueCanonicalReviewRun(
              state.database,
              otherTenant,
              queueInput("google"),
              actor,
            )
          ).ok,
          true,
        );
        assert.equal(state.creates.length, 4);
        assert.equal(
          state.locks.filter((lock) => lock.values[0] === otherTenant).length,
          1,
        );
      },
    );
    await check(
      "disabled or missing agent configuration never reads pending work or creates a run",
      async () => {
        for (const setting of [false, null]) {
          const state = queueFixture();
          state.enabled.set(tenant, setting);
          const result = await enqueueCanonicalReviewRun(
            state.database,
            tenant,
            queueInput(),
            actor,
          );
          assert.deepEqual(result, { ok: false, error: "agent_disabled" });
          assert.equal(state.reads.length, 0);
          assert.equal(state.creates.length, 0);
        }
      },
    );
    await check(
      "the per-client pending cap holds at fifty and completed history does not consume queue capacity",
      async () => {
        const state = queueFixture();
        for (let index = 0; index < 50; index++)
          state.rows.push({
            id: `old-${index}`,
            clientId: tenant,
            agentKey: "review_responder",
            status: "queued",
            input: { reviewResponseId: `different-${index}`, source: "google" },
          });
        assert.deepEqual(
          await enqueueCanonicalReviewRun(
            state.database,
            tenant,
            queueInput(),
            actor,
          ),
          { ok: false, error: "already_pending" },
        );
        assert.equal(state.creates.length, 0);
        state.rows[0].status = "completed";
        assert.equal(
          (
            await enqueueCanonicalReviewRun(
              state.database,
              tenant,
              queueInput(),
              null,
            )
          ).ok,
          true,
        );
        assert.equal(state.creates[0].requestedByProfileId, null);
        assert.equal(
          state.rows.filter((row) => row.status === "queued").length,
          50,
        );
      },
    );
    await check(
      "malformed review queue inputs reject before locking or touching the database",
      async () => {
        const state = queueFixture();
        const invalidPayloads: Array<Record<string, string | number>> = [
          { ...queueInput(), reviewResponseId: "invalid" },
          { ...queueInput(), source: "instagram" },
          { ...queueInput(), reviewWorkflowVersion: 1 },
          { ...queueInput(), reviewWorkflowVersion: "2" },
          { ...queueInput(), reviewContentHash: "not-a-hash" },
          { ...queueInput(), reviewContentHash: "A".repeat(64) },
        ];
        for (const input of invalidPayloads)
          assert.deepEqual(
            await enqueueCanonicalReviewRun(
              state.database,
              tenant,
              input,
              actor,
            ),
            { ok: false, error: "unknown_agent" },
          );
        assert.deepEqual(
          await enqueueCanonicalReviewRun(
            state.database,
            "invalid",
            queueInput(),
            actor,
          ),
          { ok: false, error: "unknown_agent" },
        );
        assert.equal(state.transactions, 0);
        assert.equal(state.locks.length, 0);
        assert.equal(state.ledgerCalls, 0);
      },
    );
    assert.equal(network, 0);
    console.log(
      `Review approval: ${count} checks passed. No provider operation, credit debit or production database call.`,
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
