import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  parseGoogleReviewReplyAck,
  replyToGoogleReview,
  type FetchLike,
} from "../src/lib/integrations/google-business/service";

const clientId = "11111111-1111-4111-8111-111111111111";
const reviewId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const sourceTime = "2026-01-02T12:34:56.123456789Z";
const comment = "Bonjour,\n\nMerci de votre visite.";
const syntheticToken = "synthetic-token-not-a-live-credential";
type StoredReview = {
  id: string;
  clientId: string;
  source: string;
  externalId: string;
  replyUpdatedAt: Date | null;
  location: { clientId: string; resourceName: string };
};
function fixture(overrides: Partial<StoredReview> = {}) {
  const row: StoredReview = {
    id: reviewId,
    clientId,
    source: "google",
    externalId: "synthetic/review id",
    replyUpdatedAt: null,
    location: { clientId, resourceName: "accounts/123/locations/456" },
    ...overrides,
  };
  const queries: Array<Record<string, unknown>> = [];
  const updates: Array<{
    where: Record<string, unknown>;
    data: { replyComment: string; replyUpdatedAt: Date };
  }> = [];
  let tokenCalls = 0,
    fetchCalls = 0;
  let forceRow = false,
    failUpdate = false;
  const database = {
    externalReview: {
      findFirst: async (query: Record<string, unknown>) => {
        queries.push(query);
        const where = query.where as Record<string, unknown>;
        const location = where.location as { clientId?: unknown };
        if (forceRow) return structuredClone(row);
        return where.id === row.id &&
          where.clientId === row.clientId &&
          where.source === row.source &&
          location?.clientId === row.location.clientId
          ? structuredClone(row)
          : null;
      },
      updateMany: async (input: {
        where: Record<string, unknown>;
        data: { replyComment: string; replyUpdatedAt: Date };
      }) => {
        if (failUpdate) throw new Error("synthetic local database failure");
        const where = input.where;
        const related = where.location as {
          clientId?: unknown;
          resourceName?: unknown;
        };
        const clock = where.OR as Array<{
          replyUpdatedAt: null | { lte: Date };
        }>;
        assert.equal(clock[0].replyUpdatedAt, null);
        const maximum = clock[1].replyUpdatedAt;
        assert.ok(maximum);
        if (
          where.id !== row.id ||
          where.clientId !== row.clientId ||
          where.source !== row.source ||
          where.externalId !== row.externalId ||
          related?.clientId !== row.location.clientId ||
          related?.resourceName !== row.location.resourceName ||
          (row.replyUpdatedAt && row.replyUpdatedAt > maximum.lte)
        )
          return { count: 0 };
        updates.push(input);
        row.replyUpdatedAt = input.data.replyUpdatedAt;
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  const dependencies = {
    database,
    accessToken: async (tenant: string) => {
      tokenCalls++;
      assert.equal(tenant, clientId);
      return {
        ok: true as const,
        token: syntheticToken,
      };
    },
  };
  const fetcher =
    (response: Response | (() => Response)): FetchLike =>
    async (url, init) => {
      fetchCalls++;
      assert.equal(
        url,
        "https://mybusiness.googleapis.com/v4/accounts/123/locations/456/reviews/synthetic%2Freview%20id/reply",
      );
      assert.equal(init?.method, "PUT");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.ok(init?.signal);
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        `Bearer ${syntheticToken}`,
      );
      assert.deepEqual(JSON.parse(String(init?.body)), { comment });
      return typeof response === "function" ? response() : response;
    };
  return {
    row,
    queries,
    updates,
    database,
    dependencies,
    fetcher,
    counters: () => ({ tokenCalls, fetchCalls }),
    forceRow: () => {
      forceRow = true;
    },
    failUpdate: () => {
      failUpdate = true;
    },
  };
}
const ack = (
  value: unknown = { comment, updateTime: sourceTime },
  status = 200,
) => new Response(status === 204 ? null : JSON.stringify(value), { status });
let count = 0;
async function check(name: string, run: () => unknown | Promise<unknown>) {
  await run();
  count++;
  console.log("PASS", name);
}
async function main() {
  await check(
    "acknowledgment requires exact persisted text and a real source timestamp",
    () => {
      assert.deepEqual(
        parseGoogleReviewReplyAck({ comment, updateTime: sourceTime }, comment),
        {
          comment,
          updateTime: new Date(sourceTime),
        },
      );
      for (const raw of [
        null,
        [],
        "ok",
        {},
        { comment },
        { comment: "changed", updateTime: sourceTime },
        { comment: `${comment} `, updateTime: sourceTime },
        { comment, updateTime: "2026-02-30T12:00:00Z" },
        { comment, updateTime: "2026-01-02T25:00:00Z" },
        { comment, updateTime: "2026-01-02" },
        { comment, updateTime: "not-a-date" },
      ]) {
        assert.equal(parseGoogleReviewReplyAck(raw, comment), null);
      }
    },
  );
  await check(
    "native Google reply is related-location and tenant scoped before credentials or publication",
    async () => {
      const f = fixture();
      const result = await replyToGoogleReview(
        clientId,
        reviewId,
        comment,
        f.fetcher(ack()),
        f.dependencies,
      );
      assert.deepEqual(result, { ok: true });
      const query = f.queries[0];
      assert.deepEqual(query.where, {
        id: reviewId,
        clientId,
        source: "google",
        location: { clientId },
      });
      assert.deepEqual(query.select, {
        id: true,
        externalId: true,
        location: { select: { clientId: true, resourceName: true } },
      });
      assert.deepEqual(f.counters(), { tokenCalls: 1, fetchCalls: 1 });
    },
  );
  await check(
    "empty and oversized replies never silently truncate or access storage",
    async () => {
      const f = fixture();
      assert.deepEqual(
        await replyToGoogleReview(
          clientId,
          reviewId,
          " \n ",
          f.fetcher(ack()),
          f.dependencies,
        ),
        { ok: false, reason: "empty_reply" },
      );
      assert.deepEqual(
        await replyToGoogleReview(
          clientId,
          reviewId,
          "x".repeat(4001),
          f.fetcher(ack()),
          f.dependencies,
        ),
        { ok: false, reason: "reply_too_long" },
      );
      assert.equal(f.queries.length, 0);
      assert.equal(f.updates.length, 0);
      assert.deepEqual(f.counters(), { tokenCalls: 0, fetchCalls: 0 });
    },
  );
  await check(
    "reply normalization trims edges while preserving approved paragraphs and exact payload",
    async () => {
      const f = fixture();
      assert.deepEqual(
        await replyToGoogleReview(
          clientId,
          reviewId,
          `  ${comment}\n `,
          f.fetcher(ack()),
          f.dependencies,
        ),
        { ok: true },
      );
      assert.equal(f.updates[0].data.replyComment, comment);
    },
  );
  await check(
    "a foreign row, foreign source or foreign related location cannot publish",
    async () => {
      for (const overrides of [
        { clientId: otherId },
        { source: "facebook" },
        {
          location: {
            clientId: otherId,
            resourceName: "accounts/123/locations/456",
          },
        },
      ]) {
        const f = fixture(overrides);
        assert.deepEqual(
          await replyToGoogleReview(
            clientId,
            reviewId,
            comment,
            f.fetcher(ack()),
            f.dependencies,
          ),
          { ok: false, reason: "not_found" },
        );
        assert.deepEqual(f.counters(), { tokenCalls: 0, fetchCalls: 0 });
        assert.equal(f.updates.length, 0);
      }
    },
  );
  await check(
    "unexpected row identity or invalid source resource refuses before OAuth even if storage returns it",
    async () => {
      for (const overrides of [
        { id: otherId },
        {
          location: {
            clientId: otherId,
            resourceName: "accounts/123/locations/456",
          },
        },
        {
          location: {
            clientId,
            resourceName: "accounts/123/locations/456?redirect=elsewhere",
          },
        },
      ]) {
        const f = fixture(overrides);
        f.forceRow();
        assert.deepEqual(
          await replyToGoogleReview(
            clientId,
            reviewId,
            comment,
            f.fetcher(ack()),
            f.dependencies,
          ),
          { ok: false, reason: "not_found" },
        );
        assert.deepEqual(f.counters(), { tokenCalls: 0, fetchCalls: 0 });
      }
    },
  );
  await check(
    "the source timestamp is stored instead of inventing local confirmation time",
    async () => {
      const f = fixture();
      await replyToGoogleReview(
        clientId,
        reviewId,
        comment,
        f.fetcher(ack()),
        f.dependencies,
      );
      assert.deepEqual(f.updates, [
        {
          where: {
            id: reviewId,
            clientId,
            source: "google",
            externalId: "synthetic/review id",
            location: { clientId, resourceName: "accounts/123/locations/456" },
            OR: [
              { replyUpdatedAt: null },
              { replyUpdatedAt: { lte: new Date(sourceTime) } },
            ],
          },
          data: { replyComment: comment, replyUpdatedAt: new Date(sourceTime) },
        },
      ]);
    },
  );
  await check(
    "a late older source acknowledgment never overwrites a newer confirmed local reply",
    async () => {
      const newer = new Date("2026-01-03T12:00:00.000Z");
      const f = fixture({ replyUpdatedAt: newer });
      assert.deepEqual(
        await replyToGoogleReview(
          clientId,
          reviewId,
          comment,
          f.fetcher(ack()),
          f.dependencies,
        ),
        { ok: true },
      );
      assert.equal(f.updates.length, 0);
      assert.equal(f.row.replyUpdatedAt, newer);
      assert.equal(f.counters().fetchCalls, 1);
    },
  );
  await check(
    "local confirmation cannot cross tenant or provider-identity changes during the remote request",
    async () => {
      for (const moved of [
        "review",
        "location",
        "externalId",
        "resourceName",
      ] as const) {
        const f = fixture();
        const transport: FetchLike = async (url, init) => {
          const response = await f.fetcher(ack())(url, init);
          if (moved === "review") f.row.clientId = otherId;
          else f.row.location.clientId = otherId;
          return response;
        };
        assert.deepEqual(
          await replyToGoogleReview(
            clientId,
            reviewId,
            comment,
            transport,
            f.dependencies,
          ),
          { ok: true },
        );
        assert.equal(f.updates.length, 0);
      }
    },
  );
  await check(
    "HTTP201, asynchronous202,204,redirects and failures are not source publication confirmation",
    async () => {
      for (const status of [201, 202, 204, 301, 400, 500]) {
        const f = fixture();
        assert.deepEqual(
          await replyToGoogleReview(
            clientId,
            reviewId,
            comment,
            f.fetcher(ack(undefined, status)),
            f.dependencies,
          ),
          { ok: false, reason: `reply_${status}` },
        );
        assert.equal(f.updates.length, 0);
      }
    },
  );
  await check(
    "malformed, missing, mismatched or impossible acknowledgment cannot update local source truth",
    async () => {
      for (const value of [
        {},
        { comment },
        { comment: "different", updateTime: sourceTime },
        { comment, updateTime: "2026-02-30T10:00:00Z" },
      ]) {
        const f = fixture();
        assert.deepEqual(
          await replyToGoogleReview(
            clientId,
            reviewId,
            comment,
            f.fetcher(ack(value)),
            f.dependencies,
          ),
          { ok: false, reason: "reply_unconfirmed" },
        );
        assert.equal(f.updates.length, 0);
      }
      const f = fixture();
      assert.deepEqual(
        await replyToGoogleReview(
          clientId,
          reviewId,
          comment,
          f.fetcher(new Response("not JSON")),
          f.dependencies,
        ),
        { ok: false, reason: "reply_unconfirmed" },
      );
      assert.equal(f.updates.length, 0);
    },
  );
  await check(
    "declared and streamed acknowledgment limits hold without trusting content-length",
    async () => {
      for (const response of [
        new Response(JSON.stringify({ comment, updateTime: sourceTime }), {
          headers: { "content-length": "32769" },
        }),
        new Response(
          JSON.stringify({
            comment,
            updateTime: sourceTime,
            padding: "x".repeat(32769),
          }),
        ),
      ]) {
        const f = fixture();
        assert.deepEqual(
          await replyToGoogleReview(
            clientId,
            reviewId,
            comment,
            f.fetcher(response),
            f.dependencies,
          ),
          { ok: false, reason: "reply_unconfirmed" },
        );
        assert.equal(f.updates.length, 0);
      }
    },
  );
  await check(
    "invalid UTF8 and aborted response streams remain uncertain without a false local receipt",
    async () => {
      for (const response of [
        new Response(new Uint8Array([255, 254, 253])),
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.error(new Error("synthetic stream failure"));
            },
          }),
        ),
      ]) {
        const f = fixture();
        assert.deepEqual(
          await replyToGoogleReview(
            clientId,
            reviewId,
            comment,
            f.fetcher(response),
            f.dependencies,
          ),
          { ok: false, reason: "reply_unconfirmed" },
        );
        assert.equal(f.updates.length, 0);
      }
    },
  );
  await check(
    "network failures cannot claim that the source definitely did not write",
    async () => {
      const f = fixture();
      let attempted = 0;
      const networkFailure: FetchLike = async () => {
        attempted++;
        throw new Error("synthetic transport failure after dispatch");
      };
      assert.deepEqual(
        await replyToGoogleReview(
          clientId,
          reviewId,
          comment,
          networkFailure,
          f.dependencies,
        ),
        { ok: false, reason: "reply_unconfirmed" },
      );
      assert.equal(attempted, 1);
      assert.equal(f.updates.length, 0);
    },
  );
  await check(
    "missing source authorization cannot dispatch a public reply",
    async () => {
      const f = fixture();
      const result = await replyToGoogleReview(
        clientId,
        reviewId,
        comment,
        f.fetcher(ack()),
        {
          ...f.dependencies,
          accessToken: async () => ({
            ok: false as const,
            reason: "not_connected",
          }),
        },
      );
      assert.deepEqual(result, { ok: false, reason: "not_connected" });
      assert.equal(f.counters().fetchCalls, 0);
      assert.equal(f.updates.length, 0);
    },
  );
  await check(
    "local persistence failure after source acknowledgment propagates instead of false success",
    async () => {
      const f = fixture();
      f.failUpdate();
      await assert.rejects(
        replyToGoogleReview(
          clientId,
          reviewId,
          comment,
          f.fetcher(ack()),
          f.dependencies,
        ),
        /synthetic local database failure/,
      );
      assert.equal(f.counters().fetchCalls, 1);
      assert.equal(f.updates.length, 0);
    },
  );
  console.log(
    `Google review publication: ${count} checks passed. No live Google/database operations.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
