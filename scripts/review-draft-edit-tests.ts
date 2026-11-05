import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  decideReviewDraft,
  getReviewApprovals,
  saveReviewDraft,
} from "../src/lib/reputation/review-approval-service";
import {
  resolveReviewTarget,
  reviewReplyHash,
} from "../src/lib/reputation/review-target";
import type { ReviewDraftSource } from "../src/lib/reputation/review-target-model";

const clientId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const reviewId = "44444444-4444-4444-8444-444444444444";
const locationId = "55555555-5555-4555-8555-555555555555";
const businessId = "66666666-6666-4666-8666-666666666666";
const remoteReviewId = "77777777-7777-4777-8777-777777777777";
const foreignId = "88888888-8888-4888-8888-888888888888";
const initialDate = new Date("2026-01-01T12:00:00.000Z");
const initialReply = "Thank you for visiting our fictional business.";
const editedReply = "Thank you. Our fictional team will follow up with you.";
type Data = Record<string, unknown>;
type Run = {
  id: string;
  clientId: string;
  agentKey: string;
  status: string;
  input: Data;
  output: unknown;
  creditsDebited: number;
  updatedAt: Date;
  createdAt: Date;
  decidedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
};
type Query = { name: string; args: Data; transaction: number | null };
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
    const actual = row[key];
    if (expected instanceof Date)
      return actual instanceof Date && actual.getTime() === expected.getTime();
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const operation = expected as Data;
      if ("in" in operation)
        return (operation.in as unknown[]).includes(actual);
      if ("notIn" in operation)
        return !(operation.notIn as unknown[]).includes(actual);
      if ("not" in operation) return actual !== operation.not;
      if ("path" in operation) {
        let value = actual;
        for (const part of operation.path as string[])
          value = object(value)[part];
        return value === operation.equals;
      }
      if ("equals" in operation)
        return operation.equals === Prisma.AnyNull
          ? actual === null
          : isDeepStrictEqual(actual, operation.equals);
      return matches(object(actual), operation);
    }
    return actual === expected;
  });
}

function fixture(source: ReviewDraftSource = "google") {
  let run: Run = {
    id: runId,
    clientId,
    agentKey: "review_responder",
    status: "awaiting_approval",
    input: {
      source,
      reviewResponseId: reviewId,
      reviewWorkflowVersion: 2,
      generationContext: { preserve: ["synthetic context"] },
    },
    output: {
      reply: initialReply,
      summary: "Synthetic worker metadata must survive editing.",
      nested: { preserve: [1, 2] },
    },
    creditsDebited: 3,
    updatedAt: new Date(initialDate),
    createdAt: new Date(initialDate),
    decidedAt: null,
    completedAt: null,
    error: null,
  };
  const sourceRow: Data = {
    id: reviewId,
    clientId,
    source: "google",
    externalId: "synthetic-provider-review",
    rating: 4,
    comment: "Private synthetic customer experience.",
    reviewerName: "Synthetic customer",
    replyComment: null,
    replyUpdatedAt: null,
    location: {
      id: locationId,
      clientId,
      title: "Synthetic Quebec branch",
      resourceName: "accounts/synthetic/locations/synthetic",
    },
    feedback: "Private synthetic customer experience.",
    contactName: "Synthetic customer",
    profile: { id: locationId, clientId, name: "Synthetic Quebec branch" },
    provider: "qmaps",
    status: "needs_review",
    body: "Private synthetic customer experience.",
    metadata: { source: "qmaps", qmapsReviewId: remoteReviewId },
    localListing: {
      id: locationId,
      clientId,
      provider: "qmaps",
      status: "active_internal",
      businessBrandId: null,
      name: "Synthetic Quebec branch",
      metadata: { qmapsBusinessId: businessId },
    },
  };
  const queries: Query[] = [];
  const audits: Data[] = [];
  let transactions = 0;
  let timestamp = initialDate.getTime();
  let missingSource = false;
  let ambiguous = false;
  let failAudit = false;
  let forceConflict = false;
  let committedUpdates = 0;
  let keepTimestamp = false;
  let failReadback = false;
  let beforeWrite: (() => void) | undefined;
  let concurrencyBarrier:
    | { remaining: number; ready: Promise<void>; release: () => void }
    | undefined;
  const log = (name: string, args: unknown, transaction: number | null) => {
    const query = object(args);
    queries.push({ name, args: structuredClone(query), transaction });
    return query;
  };
  const noSideEffect = (name: string) => () => {
    throw new Error(`Unexpected provider or credit operation: ${name}`);
  };
  const models = (transaction: number | null) => {
    const sourceRead = (name: string) => async (args: unknown) => {
      const query = log(name, args, transaction);
      return !missingSource && matches(sourceRow, object(query.where))
        ? structuredClone(sourceRow)
        : null;
    };
    const runRead = async (args: unknown) => {
      const query = log("aiAgentRun.findFirst", args, transaction);
      if (transaction && failReadback && committedUpdates > 0) return null;
      const result = matches(run as unknown as Data, object(query.where))
        ? structuredClone(run)
        : null;
      // Two transaction reads deliberately receive the same persisted snapshot.
      // Their real CAS filters must choose a single winner when updates race.
      if (transaction && concurrencyBarrier?.remaining) {
        const barrier = concurrencyBarrier;
        if (--barrier.remaining === 0) barrier.release();
        await barrier.ready;
      }
      return result;
    };
    return {
      externalReview: { findFirst: sourceRead("externalReview.findFirst") },
      reviewResponse: { findFirst: sourceRead("reviewResponse.findFirst") },
      listingReview: { findFirst: sourceRead("listingReview.findFirst") },
      localListing: {
        findMany: async (args: unknown) => {
          log("localListing.findMany", args, transaction);
          return ambiguous
            ? [{ id: locationId }, { id: foreignId }]
            : [{ id: locationId }];
        },
      },
      aiAgentRun: {
        findFirst: runRead,
        findUnique: runRead,
        findMany: async (args: unknown) => {
          const query = log("aiAgentRun.findMany", args, transaction);
          return matches(run as unknown as Data, object(query.where))
            ? [structuredClone(run)]
            : [];
        },
        updateMany: async (args: unknown) => {
          assert.ok(transaction, "Every draft write must be transactional");
          const query = log("aiAgentRun.updateMany", args, transaction);
          const mutate = beforeWrite;
          beforeWrite = undefined;
          mutate?.();
          if (
            forceConflict ||
            !matches(run as unknown as Data, object(query.where))
          )
            return { count: 0 };
          Object.assign(run, structuredClone(object(query.data)));
          // Prisma @updatedAt is persisted by the database. Make its value
          // visibly differ from both the read snapshot and application clocks.
          run.updatedAt = new Date(keepTimestamp ? timestamp : ++timestamp);
          committedUpdates++;
          return { count: 1 };
        },
        create: noSideEffect("aiAgentRun.create"),
      },
      auditLog: {
        create: async (args: unknown) => {
          assert.ok(
            transaction,
            "Draft audit must share the write transaction",
          );
          const query = log("auditLog.create", args, transaction);
          if (failAudit) throw Error("synthetic_audit_failure");
          audits.push(structuredClone(object(query.data)));
          return { id: "synthetic-audit" };
        },
      },
      client: {
        update: noSideEffect("client.update"),
        updateMany: noSideEffect("client.updateMany"),
      },
      creditTransaction: { create: noSideEffect("creditTransaction.create") },
      aiCreditTransaction: {
        create: noSideEffect("aiCreditTransaction.create"),
      },
      $executeRaw: noSideEffect("executeRaw"),
      $queryRaw: noSideEffect("queryRaw"),
    };
  };
  const raw = {
    ...models(null),
    $transaction: async <T>(
      callback: (tx: ReturnType<typeof models>) => Promise<T>,
    ) => {
      const transaction = ++transactions;
      const snapshot = structuredClone(run);
      const auditCount = audits.length;
      const updateCount = committedUpdates;
      try {
        return await callback(models(transaction));
      } catch (error) {
        // This double models rollback for isolated failure checks. It is not
        // a claim about PostgreSQL integration or isolation behavior.
        run = snapshot;
        audits.splice(auditCount);
        committedUpdates = updateCount;
        throw error;
      }
    },
  };
  return {
    database: raw as unknown as PrismaClient,
    sourceRow,
    queries,
    audits,
    get run() {
      return run;
    },
    get transactions() {
      return transactions;
    },
    get updates() {
      return committedUpdates;
    },
    missing() {
      missingSource = true;
    },
    ambiguous() {
      ambiguous = true;
    },
    conflict() {
      forceConflict = true;
    },
    auditFailure() {
      failAudit = true;
    },
    sameMillisecond() {
      keepTimestamp = true;
    },
    mutateBeforeWrite(mutate: () => void) {
      beforeWrite = mutate;
    },
    readbackFailure() {
      failReadback = true;
    },
    concurrent() {
      let release!: () => void;
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      concurrencyBarrier = { remaining: 2, ready, release };
    },
  };
}
type Fixture = ReturnType<typeof fixture>;
async function prepare(source: ReviewDraftSource = "google") {
  const state = fixture(source);
  const target = await resolveReviewTarget(
    state.database,
    clientId,
    source,
    reviewId,
  );
  assert.ok(target);
  state.run.input.reviewContentHash = target.fingerprint;
  return state;
}
async function currentHash(state: Fixture): Promise<string> {
  const projected = await getReviewApprovals(clientId, state.database);
  assert.equal(projected.length, 1);
  assert.ok(projected[0].draftHash);
  return projected[0].draftHash;
}
async function edit(state: Fixture, text: string, expectedHash?: string) {
  return saveReviewDraft(
    clientId,
    profileId,
    runId,
    expectedHash ?? (await currentHash(state)),
    text,
    state.database,
  );
}
let checks = 0;
async function check(name: string, run: () => Promise<void>) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}

async function main() {
  const previousFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls++;
    throw Error("Draft edits must never call a provider");
  };
  try {
    await check(
      "invalid client, actor, run identities and decision hashes fail before database access",
      async () => {
        for (const [client, actor, id, hash] of [
          ["invalid", profileId, runId, "a".repeat(64)],
          [clientId, "invalid", runId, "a".repeat(64)],
          [clientId, profileId, "invalid", "a".repeat(64)],
          [clientId, profileId, runId, "bad-hash"],
          [clientId, profileId, runId, "A".repeat(64)],
        ]) {
          const state = await prepare();
          state.queries.length = 0;
          const result = await saveReviewDraft(
            client,
            actor,
            id,
            hash,
            editedReply,
            state.database,
          );
          assert.equal(result.ok, false);
          assert.equal(state.transactions, 0);
          assert.deepEqual(state.queries, []);
        }
      },
    );
    await check(
      "edits require the owned review responder run to still await a human decision",
      async () => {
        for (const mutate of [
          (state: Fixture) => {
            state.run.clientId = foreignId;
          },
          (state: Fixture) => {
            state.run.agentKey = "content_writer";
          },
          ...[
            "queued",
            "running",
            "approved",
            "executing",
            "completed",
            "rejected",
            "failed",
          ].map((status) => (state: Fixture) => {
            state.run.status = status;
          }),
        ]) {
          const state = await prepare();
          const hash = await currentHash(state);
          mutate(state);
          assert.equal((await edit(state, editedReply, hash)).ok, false);
          assert.equal(state.updates, 0);
          assert.deepEqual(state.audits, []);
          const lookup = state.queries.find(
            (query) =>
              query.transaction && query.name === "aiAgentRun.findFirst",
          );
          assert.deepEqual(lookup?.args.where, {
            id: runId,
            clientId,
            agentKey: "review_responder",
            status: "awaiting_approval",
          });
        }
      },
    );
    await check(
      "all sources retain direct and related-record tenant ownership gates",
      async () => {
        for (const source of ["google", "takatak", "qmaps"] as const) {
          for (const related of [false, true]) {
            const state = await prepare(source);
            const hash = await currentHash(state);
            if (!related) state.sourceRow.clientId = foreignId;
            else
              object(
                state.sourceRow[
                  source === "google"
                    ? "location"
                    : source === "takatak"
                      ? "profile"
                      : "localListing"
                ],
              ).clientId = foreignId;
            assert.equal(
              (await edit(state, editedReply, hash)).ok,
              false,
              `${source}/${related}`,
            );
            assert.equal(state.updates, 0);
            assert.deepEqual(state.audits, []);
          }
        }
      },
    );
    await check(
      "missing, invalid, archived, imported and ambiguously mapped source targets cannot be edited",
      async () => {
        const mutations = [
          async () => {
            const state = await prepare();
            state.missing();
            return state;
          },
          async () => {
            const state = await prepare();
            state.run.input.source = "facebook";
            return state;
          },
          async () => {
            const state = await prepare();
            state.run.input.reviewResponseId = "invalid";
            return state;
          },
          async () => {
            const state = await prepare("qmaps");
            state.sourceRow.status = "archived";
            return state;
          },
          async () => {
            const state = await prepare("qmaps");
            object(state.sourceRow.localListing).status = "archived";
            return state;
          },
          async () => {
            const state = await prepare("qmaps");
            object(state.sourceRow.metadata).source = "reviewed_import";
            return state;
          },
          async () => {
            const state = await prepare("qmaps");
            state.ambiguous();
            return state;
          },
        ];
        for (const mutate of mutations) {
          const state = await mutate();
          assert.equal((await edit(state, editedReply)).ok, false);
          assert.equal(state.updates, 0);
        }
      },
    );
    await check(
      "version2 edits reject source contents, ratings, reply state and provider mapping changes",
      async () => {
        for (const mutate of [
          (state: Fixture) => {
            state.sourceRow.comment = "The customer changed their review.";
          },
          (state: Fixture) => {
            state.sourceRow.rating = 1;
          },
          (state: Fixture) => {
            state.sourceRow.replyComment =
              "A different owner reply already exists.";
          },
          (state: Fixture) => {
            state.sourceRow.externalId = "another-provider-review";
          },
          (state: Fixture) => {
            object(state.sourceRow.location).resourceName =
              "accounts/other/locations/other";
          },
        ]) {
          const state = await prepare();
          const hash = await currentHash(state);
          mutate(state);
          assert.equal((await edit(state, editedReply, hash)).ok, false);
          assert.equal(state.updates, 0);
        }
        const state = await prepare("qmaps");
        const hash = await currentHash(state);
        object(object(state.sourceRow.localListing).metadata).qmapsBusinessId =
          foreignId;
        assert.equal((await edit(state, editedReply, hash)).ok, false);
        assert.equal(state.updates, 0);
      },
    );
    await check(
      "Google and first-party edits preserve paragraphs while QMAPS edits use its canonical one-line payload",
      async () => {
        for (const source of ["google", "takatak", "qmaps"] as const) {
          const state = await prepare(source);
          const result = await edit(
            state,
            "  Thank you.\n\nOur team\t appreciates your visit.  ",
          );
          assert.equal(result.ok, true);
          if (result.ok !== true) throw Error("Edit failed");
          const expected =
            source === "qmaps"
              ? "Thank you. Our team appreciates your visit."
              : "Thank you.\n\nOur team\t appreciates your visit.";
          assert.equal(result.draft, expected);
          assert.equal(object(state.run.output).reply, expected);
          assert.equal(state.run.status, "awaiting_approval");
          assert.equal(state.run.decidedAt, null);
          assert.equal(state.run.completedAt, null);
        }
      },
    );
    await check(
      "source-specific limits accept full boundary text and reject overlength, empty and control-character edits without truncation",
      async () => {
        for (const source of ["google", "takatak", "qmaps"] as const) {
          const max = source === "qmaps" ? 2000 : 4000;
          const boundary = await prepare(source);
          const saved = await edit(boundary, "x".repeat(max));
          assert.equal(saved.ok, true);
          assert.equal(object(boundary.run.output).reply, "x".repeat(max));
          for (const text of [
            "x".repeat(max + 1),
            "   \n\t",
            "Bad\u0000text",
            "Bad\u0007text",
          ]) {
            const state = await prepare(source);
            assert.equal((await edit(state, text)).ok, false);
            assert.equal(state.updates, 0);
            assert.equal(object(state.run.output).reply, initialReply);
            assert.deepEqual(state.audits, []);
          }
        }
      },
    );
    await check(
      "a human may repair missing, malformed or overlength generated drafts using the projected decision hash",
      async () => {
        for (const output of [
          null,
          [],
          {},
          { reply: " " },
          { reply: { text: "wrong shape" } },
          { reply: "x".repeat(4001), preserve: true },
        ]) {
          const state = await prepare();
          state.run.output = output;
          const shown = (await getReviewApprovals(clientId, state.database))[0];
          assert.equal(shown.draft, null);
          assert.ok(shown.draftHash);
          const result = await edit(state, editedReply, shown.draftHash!);
          assert.equal(result.ok, true);
          assert.equal(object(state.run.output).reply, editedReply);
          if (object(output).preserve)
            assert.equal(object(state.run.output).preserve, true);
        }
      },
    );
    await check(
      "editing preserves source input, worker metadata and existing credit debit without creating approval or publication",
      async () => {
        const state = await prepare();
        state.run.input.internalMetadata = { secret: "private-input-sentinel" };
        const input = structuredClone(state.run.input);
        const output = object(structuredClone(state.run.output));
        const result = await edit(state, editedReply);
        assert.equal(result.ok, true);
        assert.deepEqual(state.run.input, input);
        assert.deepEqual(state.run.output, { ...output, reply: editedReply });
        assert.equal(state.run.creditsDebited, 3);
        assert.equal(state.run.status, "awaiting_approval");
        assert.equal(state.run.input.reviewApproval, undefined);
        assert.equal(state.run.input.reviewPublication, undefined);
        const write = state.queries.find(
          (query) => query.name === "aiAgentRun.updateMany",
        );
        assert.ok(write);
        assert.equal("status" in object(write.args.data), false);
        assert.equal("input" in object(write.args.data), false);
        assert.equal("creditsDebited" in object(write.args.data), false);
      },
    );
    await check(
      "frozen approvals and publication attempts remain immutable even if an anomalous run still awaits approval",
      async () => {
        for (const marker of ["reviewApproval", "reviewPublication"]) {
          for (const value of [
            {},
            [],
            false,
            "",
            0,
            {
              attemptId: remoteReviewId,
              state: "not_sent",
              source: "google",
              reviewId,
              replyHash: reviewReplyHash(initialReply),
              targetHash: "a".repeat(64),
              at: initialDate.toISOString(),
            },
          ]) {
            const state = await prepare();
            state.run.input[marker] = value;
            const before = structuredClone(state.run);
            assert.equal((await edit(state, editedReply)).ok, false);
            assert.equal(state.updates, 0);
            assert.deepEqual(state.audits, []);
            assert.deepEqual(state.run, before);
          }
        }
      },
    );
    await check(
      "unknown or malformed workflow versions are rejected rather than treated as editable legacy jobs",
      async () => {
        for (const version of [0, 3, -1, "2", "legacy", null, {}]) {
          const state = await prepare();
          state.run.input.reviewWorkflowVersion = version;
          assert.equal((await edit(state, editedReply)).ok, false);
          assert.equal(state.updates, 0);
          assert.deepEqual(state.audits, []);
        }
      },
    );
    await check(
      "the returned saved hash uses the persisted timestamp and invalidates the old decision",
      async () => {
        const state = await prepare();
        const oldHash = await currentHash(state);
        const result = await edit(state, editedReply, oldHash);
        assert.equal(result.ok, true);
        if (result.ok !== true) throw Error("Edit failed");
        assert.notEqual(result.draftHash, oldHash);
        assert.equal(result.draftHash, await currentHash(state));
        assert.ok(state.run.updatedAt > initialDate);
        assert.equal(
          (
            await decideReviewDraft(
              clientId,
              profileId,
              runId,
              "approve",
              oldHash,
              state.database,
            )
          ).ok,
          false,
        );
        assert.equal(state.run.status, "awaiting_approval");
        assert.equal(state.audits.length, 1);
        assert.equal(
          (
            await decideReviewDraft(
              clientId,
              profileId,
              runId,
              "approve",
              result.draftHash,
              state.database,
            )
          ).ok,
          true,
        );
        assert.equal(state.run.status, "approved");
        assert.equal(
          object(state.run.input.reviewApproval).replyText,
          editedReply,
        );
        assert.equal(
          object(state.run.input.reviewApproval).replyHash,
          reviewReplyHash(editedReply),
        );
        assert.equal(state.run.creditsDebited, 3);
      },
    );
    await check(
      "equivalent canonical text is a no-op with no update, audit or hash churn",
      async () => {
        for (const source of ["google", "takatak", "qmaps"] as const) {
          const state = await prepare(source);
          const before = structuredClone(state.run);
          const hash = await currentHash(state);
          const text =
            source === "qmaps"
              ? `  ${initialReply.replace(/ /g, "\n\t")}  `
              : `  ${initialReply}  `;
          const result = await edit(state, text, hash);
          assert.equal(result.ok, true);
          if (result.ok !== true) throw Error("No-op failed");
          assert.equal(result.draft, initialReply);
          assert.equal(result.draftHash, hash);
          assert.equal(state.updates, 0);
          assert.deepEqual(state.audits, []);
          assert.deepEqual(state.run, before);
        }
      },
    );
    await check(
      "stale output, changed input and changed persisted timestamp reject an old edit token without writing",
      async () => {
        for (const mutate of [
          (state: Fixture) => {
            object(state.run.output).reply = "A newer generated reply.";
          },
          (state: Fixture) => {
            state.run.input.privateRevision = "newer input";
          },
          (state: Fixture) => {
            state.run.updatedAt = new Date(initialDate.getTime() + 1000);
          },
        ]) {
          const state = await prepare();
          const hash = await currentHash(state);
          mutate(state);
          assert.equal((await edit(state, editedReply, hash)).ok, false);
          assert.equal(state.updates, 0);
          assert.deepEqual(state.audits, []);
        }
      },
    );
    await check(
      "compare-and-set conflicts never report success or create an edit audit",
      async () => {
        const state = await prepare();
        state.conflict();
        assert.equal((await edit(state, editedReply)).ok, false);
        assert.equal(state.updates, 0);
        assert.equal(object(state.run.output).reply, initialReply);
        assert.deepEqual(state.audits, []);
        const write = state.queries.find(
          (query) => query.name === "aiAgentRun.updateMany",
        );
        assert.deepEqual(write?.args.where, {
          id: runId,
          clientId,
          agentKey: "review_responder",
          status: "awaiting_approval",
          updatedAt: initialDate,
          input: { equals: state.run.input },
          output: { equals: state.run.output },
        });
      },
    );
    await check(
      "same-millisecond input or output changes refuse a stale edit even when its timestamp did not advance",
      async () => {
        for (const mutation of [
          (state: Fixture) => {
            state.run.input.privateRevision = "updated-by-another-operator";
          },
          (state: Fixture) => {
            object(state.run.output).reply = "A newer saved answer.";
          },
          (state: Fixture) => {
            object(state.run.output).summary = "A newer worker summary.";
          },
        ]) {
          const state = await prepare();
          const hash = await currentHash(state);
          state.sameMillisecond();
          state.mutateBeforeWrite(() => mutation(state));
          assert.equal((await edit(state, editedReply, hash)).ok, false);
          assert.equal(state.run.updatedAt.getTime(), initialDate.getTime());
          assert.equal(state.updates, 0);
          assert.deepEqual(state.audits, []);
        }
      },
    );
    await check(
      "a missing-output repair cannot overwrite a concurrent real output despite an unchanged timestamp",
      async () => {
        const state = await prepare();
        state.run.output = null;
        const hash = await currentHash(state);
        state.sameMillisecond();
        const newer = {
          reply: "A concurrently completed generation.",
          summary: "Keep this.",
        };
        state.mutateBeforeWrite(() => {
          state.run.output = newer;
        });
        assert.equal((await edit(state, editedReply, hash)).ok, false);
        assert.deepEqual(state.run.output, newer);
        assert.equal(state.run.updatedAt.getTime(), initialDate.getTime());
        assert.equal(state.updates, 0);
        assert.deepEqual(state.audits, []);
      },
    );
    await check(
      "two concurrent human editors sharing one snapshot produce exactly one saved text and audit even in the same millisecond",
      async () => {
        for (const sameMillisecond of [false, true]) {
          const state = await prepare();
          const hash = await currentHash(state);
          if (sameMillisecond) state.sameMillisecond();
          state.concurrent();
          const texts = [
            editedReply,
            "Another fictional operator wrote this reply.",
          ];
          const results = await Promise.all(
            texts.map((text) => edit(state, text, hash)),
          );
          const winner = results.findIndex((result) => result.ok === true);
          assert.ok(winner >= 0);
          assert.equal(
            results.filter((result) => result.ok === true).length,
            1,
          );
          assert.equal(
            results.filter((result) => result.ok === false).length,
            1,
          );
          assert.equal(state.updates, 1);
          assert.equal(state.audits.length, 1);
          assert.equal(object(state.run.output).reply, texts[winner]);
          const result = results[winner];
          if (result.ok !== true) throw Error("Expected one winner");
          assert.equal(result.draftHash, await currentHash(state));
        }
      },
    );
    await check(
      "a racing approval and edit cannot approve one text while saving a different text",
      async () => {
        const state = await prepare();
        const hash = await currentHash(state);
        state.concurrent();
        const [saved, approved] = await Promise.all([
          edit(state, editedReply, hash),
          decideReviewDraft(
            clientId,
            profileId,
            runId,
            "approve",
            hash,
            state.database,
          ),
        ]);
        assert.equal(
          Number(saved.ok === true) + Number(approved.ok === true),
          1,
        );
        assert.equal(state.updates, 1);
        assert.equal(state.audits.length, 1);
        if (approved.ok === true) {
          assert.equal(state.run.status, "approved");
          assert.equal(
            object(state.run.input.reviewApproval).replyText,
            initialReply,
          );
          assert.equal(object(state.run.output).reply, initialReply);
        } else {
          assert.equal(state.run.status, "awaiting_approval");
          assert.equal(object(state.run.output).reply, editedReply);
          assert.equal(state.run.input.reviewApproval, undefined);
        }
      },
    );
    await check(
      "same-millisecond edit and approval races require the exact stored JSON snapshot as well as the status",
      async () => {
        for (const editFirst of [true, false]) {
          const state = await prepare();
          const hash = await currentHash(state);
          state.sameMillisecond();
          state.concurrent();
          const save = () => edit(state, editedReply, hash);
          const approve = () =>
            decideReviewDraft(
              clientId,
              profileId,
              runId,
              "approve",
              hash,
              state.database,
            );
          const results = await Promise.all(
            editFirst ? [save(), approve()] : [approve(), save()],
          );
          assert.equal(
            results.filter((result) => result.ok === true).length,
            1,
          );
          assert.equal(
            results.filter((result) => result.ok === false).length,
            1,
          );
          assert.equal(state.run.updatedAt.getTime(), initialDate.getTime());
          assert.equal(state.updates, 1);
          assert.equal(state.audits.length, 1);
          if (state.run.status === "approved") {
            assert.equal(
              object(state.run.input.reviewApproval).replyText,
              initialReply,
            );
            assert.equal(object(state.run.output).reply, initialReply);
          } else {
            assert.equal(state.run.status, "awaiting_approval");
            assert.equal(object(state.run.output).reply, editedReply);
            assert.equal(state.run.input.reviewApproval, undefined);
          }
        }
      },
    );
    await check(
      "one privacy-safe audit identifies actor, run and hashes without copying private review or reply text",
      async () => {
        const state = await prepare();
        state.run.input.privateContact = {
          email: "private-synthetic@example.invalid",
        };
        assert.equal((await edit(state, editedReply)).ok, true);
        assert.equal(state.audits.length, 1);
        const audit = state.audits[0];
        assert.equal(audit.clientId, clientId);
        assert.equal(audit.profileId, profileId);
        assert.equal(audit.entityId, runId);
        assert.equal(audit.entityType, "ai_agent_run");
        assert.equal(audit.action, "reputation.draft.edit");
        const serialized = JSON.stringify(audit);
        for (const forbidden of [
          initialReply,
          editedReply,
          String(state.sourceRow.comment),
          "private-synthetic@example.invalid",
          "Synthetic customer",
        ])
          assert.equal(serialized.includes(forbidden), false, forbidden);
        assert.ok(serialized.includes(reviewReplyHash(editedReply)));
      },
    );
    await check(
      "audit failure rolls back the isolated edit and propagates instead of claiming a saved draft",
      async () => {
        const state = await prepare();
        const before = structuredClone(state.run);
        const hash = await currentHash(state);
        state.auditFailure();
        await assert.rejects(
          () => edit(state, editedReply, hash),
          /synthetic_audit_failure/,
        );
        assert.deepEqual(state.run, before);
        assert.equal(state.updates, 0);
        assert.deepEqual(state.audits, []);
      },
    );
    await check(
      "a failed persisted-version read rolls back the edit instead of returning an invented saved hash",
      async () => {
        const state = await prepare();
        const before = structuredClone(state.run);
        const hash = await currentHash(state);
        state.readbackFailure();
        await assert.rejects(
          () => edit(state, editedReply, hash),
          /review_draft_edit_not_persisted/,
        );
        assert.deepEqual(state.run, before);
        assert.equal(state.updates, 0);
        assert.deepEqual(state.audits, []);
      },
    );
    await check(
      "legacy first-party requests retain canonical source ownership and their missing source marker",
      async () => {
        const state = await prepare("takatak");
        delete state.run.input.source;
        delete state.run.input.reviewWorkflowVersion;
        delete state.run.input.reviewContentHash;
        const result = await edit(state, editedReply);
        assert.equal(result.ok, true);
        assert.equal(state.run.input.source, undefined);
        assert.equal(object(state.run.output).reply, editedReply);
        assert.equal(state.run.status, "awaiting_approval");
        assert.equal(object(state.audits[0].metadata).source, "takatak");
      },
    );
    assert.equal(providerCalls, 0);
    console.log(
      `Review draft editing: ${checks} checks passed. No provider, credit debit or production database call.`,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
