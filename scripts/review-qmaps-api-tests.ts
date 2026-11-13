import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  fetchQmapsReviewPage,
  parseQmapsReviewPage,
  qmapsReviewCursor,
  qmapsTrackedReviewId,
  type QmapsSourceReview,
} from "../src/lib/qmaps/reviews-api";
import { syncQmapsReviews } from "../src/lib/qmaps/review-sync";
import { postQmaps } from "../src/lib/qmaps/remote";

const clientId = "11111111-1111-4111-8111-111111111111";
const listingId = "22222222-2222-4222-8222-222222222222";
const businessId = "33333333-3333-4333-8333-333333333333";
const reviewId = "44444444-4444-4444-8444-444444444444";
const otherId = "55555555-5555-4555-8555-555555555555";
const brandId = "66666666-6666-4666-8666-666666666666";
const createdAt = "2026-01-01T12:00:00.123456Z";
const updatedAt = "2026-01-02T12:00:00.000Z";
const sourceReview = (
  overrides: Partial<QmapsSourceReview> = {},
): QmapsSourceReview => ({
  id: reviewId,
  businessId,
  rating: 4,
  body: "Synthetic review body, not a customer record.",
  createdAt,
  updatedAt,
  ownerReply: null,
  ownerRepliedAt: null,
  ...overrides,
});
const envelope = (
  reviews: unknown[] = [sourceReview()],
  nextCursor: unknown = null,
) => ({
  ok: true,
  version: 1,
  clientId,
  businessId,
  reviews,
  nextCursor,
});
const response = (body: unknown = envelope()) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
const fakeFetch = (
  body: unknown = envelope(),
  calls: Array<{ url: string; options: RequestInit }> = [],
) =>
  (async (url: string | URL | Request, options?: RequestInit) => {
    calls.push({ url: String(url), options: options ?? {} });
    return response(body);
  }) as typeof fetch;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

type StoredReview = {
  id: string;
  metadata: Record<string, unknown>;
  [field: string]: unknown;
};
type ReadArgs = {
  where: Record<string, unknown>;
  select?: unknown;
  take?: number;
};
function fixture(
  options: {
    missing?: boolean;
    ambiguous?: boolean;
    disappear?: boolean;
    becomeAmbiguous?: boolean;
    metadata?: Record<string, unknown>;
    reviews?: StoredReview[];
  } = {},
) {
  let inTransaction = false;
  let transactions = 0;
  let metadata: Record<string, unknown> = {
    qmapsBusinessId: businessId,
    linkState: "confirmed_on_qmaps",
    internalNote: "keep local metadata",
    ...options.metadata,
  };
  const reviews = new Map<string, StoredReview>(
    (options.reviews ?? []).map((row): [string, StoredReview] => [
      String(row.metadata.qmapsReviewId),
      { ...row, metadata: { ...row.metadata } },
    ]),
  );
  const listingReads: Array<{ args: ReadArgs; transaction: boolean }> = [];
  const mappingReads: Array<{ args: ReadArgs; transaction: boolean }> = [];
  const reviewReads: ReadArgs[] = [];
  const writes: Array<{ kind: string; args: unknown }> = [];
  const localListing = {
    async findFirst(args: ReadArgs) {
      listingReads.push({ args, transaction: inTransaction });
      if (options.missing || (options.disappear && inTransaction)) return null;
      return {
        id: listingId,
        businessBrandId: brandId,
        metadata: { ...metadata },
      };
    },
    async findMany(args: ReadArgs) {
      mappingReads.push({ args, transaction: inTransaction });
      return options.ambiguous || (options.becomeAmbiguous && inTransaction)
        ? [{ id: listingId }, { id: otherId }]
        : [{ id: listingId }];
    },
    async update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) {
      assert.equal(inTransaction, true);
      assert.equal(args.where.id, listingId);
      writes.push({ kind: "listing.update", args });
      metadata = record(args.data.metadata);
      return { id: listingId };
    },
  };
  const listingReview = {
    async findFirst(args: ReadArgs) {
      assert.equal(inTransaction, true);
      assert.equal(args.where.clientId, clientId);
      assert.equal(args.where.localListingId, listingId);
      assert.equal(args.where.provider, "qmaps");
      reviewReads.push(args);
      const id = String(record(args.where.metadata).equals);
      return reviews.get(id) ?? null;
    },
    async create(args: { data: Record<string, unknown> }) {
      assert.equal(inTransaction, true);
      assert.equal(args.data.clientId, clientId);
      assert.equal(args.data.localListingId, listingId);
      const nextMetadata = record(args.data.metadata);
      const sourceId = String(nextMetadata.qmapsReviewId);
      assert.equal(reviews.has(sourceId), false);
      const row: StoredReview = {
        ...args.data,
        id: String(args.data.id),
        metadata: nextMetadata,
      };
      reviews.set(sourceId, row);
      writes.push({ kind: "review.create", args });
      return { id: row.id };
    },
    async update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) {
      assert.equal(inTransaction, true);
      const existing = Array.from(reviews.entries()).find(
        ([, row]) => row.id === args.where.id,
      );
      assert.ok(existing);
      reviews.set(existing[0], {
        ...existing[1],
        ...args.data,
        id: existing[1].id,
        metadata: record(args.data.metadata),
      });
      writes.push({ kind: "review.update", args });
      return { id: existing[1].id };
    },
  };
  const auditLog = {
    async create(args: { data: Record<string, unknown> }) {
      assert.equal(inTransaction, true);
      writes.push({ kind: "audit.create", args });
      return { id: otherId };
    },
  };
  const tx = { localListing, listingReview, auditLog };
  const db = {
    ...tx,
    async $transaction<T>(run: (transaction: typeof tx) => Promise<T>) {
      assert.equal(inTransaction, false);
      transactions++;
      inTransaction = true;
      try {
        return await run(tx);
      } finally {
        inTransaction = false;
      }
    },
  } as unknown as PrismaClient;
  return {
    db,
    reviews,
    writes,
    listingReads,
    mappingReads,
    reviewReads,
    transactions: () => transactions,
    metadata: () => metadata,
  };
}

let count = 0;
async function check(name: string, run: () => unknown | Promise<unknown>) {
  await run();
  count++;
  console.log("PASS", name);
}
async function main() {
  const oldBase = process.env.QMAPS_FUNCTIONS_BASE_URL;
  const oldSecret = process.env.QMAPS_INTEGRATION_SECRET;
  process.env.QMAPS_FUNCTIONS_BASE_URL = "https://qmaps.example/functions/v1";
  process.env.QMAPS_INTEGRATION_SECRET =
    "synthetic-test-secret-32-characters-minimum";
  try {
    await check(
      "page contract pins workspace and business and projects no private source identity",
      () => {
        const raw = {
          ...sourceReview(),
          userId: "private-user",
          reviewerEmail: "private@example.invalid",
        };
        const parsed = parseQmapsReviewPage(
          envelope([raw]),
          clientId,
          businessId,
        );
        assert.ok(parsed);
        assert.deepEqual(parsed.reviews, [sourceReview()]);
        assert.equal(JSON.stringify(parsed).includes("private"), false);
        assert.equal(
          parseQmapsReviewPage(
            { ...envelope(), clientId: otherId },
            clientId,
            businessId,
          ),
          null,
        );
        assert.equal(
          parseQmapsReviewPage(
            { ...envelope(), businessId: otherId },
            clientId,
            businessId,
          ),
          null,
        );
        assert.equal(
          parseQmapsReviewPage(
            envelope([sourceReview({ businessId: otherId })]),
            clientId,
            businessId,
          ),
          null,
        );
        assert.equal(
          parseQmapsReviewPage(
            { ...envelope(), ok: false },
            clientId,
            businessId,
          ),
          null,
        );
        assert.equal(
          parseQmapsReviewPage(
            { ...envelope(), version: 2 },
            clientId,
            businessId,
          ),
          null,
        );
      },
    );
    await check(
      "keyset cursor preserves source microseconds and must identify the page tail",
      () => {
        const cursor = { createdAt, id: reviewId };
        assert.deepEqual(qmapsReviewCursor(cursor), cursor);
        assert.deepEqual(
          parseQmapsReviewPage(
            envelope([sourceReview()], cursor),
            clientId,
            businessId,
          )?.nextCursor,
          cursor,
        );
        assert.equal(
          qmapsReviewCursor({
            createdAt: `${createdAt}),or(x.eq.y`,
            id: reviewId,
          }),
          null,
        );
        assert.equal(qmapsReviewCursor({ createdAt, id: "not-a-uuid" }), null);
        assert.equal(
          parseQmapsReviewPage(envelope([], cursor), clientId, businessId),
          null,
        );
        assert.equal(
          parseQmapsReviewPage(
            envelope([sourceReview()], { ...cursor, id: otherId }),
            clientId,
            businessId,
          ),
          null,
        );
        assert.equal(
          parseQmapsReviewPage(
            envelope([sourceReview()], { ...cursor, createdAt: updatedAt }),
            clientId,
            businessId,
          ),
          null,
        );
      },
    );
    await check(
      "duplicate source IDs, missing cursor fields and oversized pages reject atomically",
      () => {
        assert.equal(
          parseQmapsReviewPage(
            envelope([sourceReview(), sourceReview()]),
            clientId,
            businessId,
          ),
          null,
        );
        const missing = { ...envelope() } as Record<string, unknown>;
        delete missing.nextCursor;
        assert.equal(parseQmapsReviewPage(missing, clientId, businessId), null);
        assert.equal(
          parseQmapsReviewPage(
            envelope(Array.from({ length: 26 }, () => sourceReview())),
            clientId,
            businessId,
          ),
          null,
        );
        assert.equal(
          parseQmapsReviewPage(
            envelope([sourceReview()], {}),
            clientId,
            businessId,
          ),
          null,
        );
      },
    );
    await check(
      "source ratings, dates, text and owner replies obey the bounded wire contract",
      () => {
        for (const rating of [0, 6, 3.5, Number.NaN])
          assert.equal(
            parseQmapsReviewPage(
              envelope([sourceReview({ rating })]),
              clientId,
              businessId,
            ),
            null,
          );
        for (const row of [
          sourceReview({ createdAt: "not-a-date" }),
          sourceReview({ updatedAt: "2026-01-01" }),
          sourceReview({ body: "x".repeat(10001) }),
          sourceReview({ ownerReply: "x".repeat(2001) }),
          sourceReview({ ownerRepliedAt: "bad" }),
        ])
          assert.equal(
            parseQmapsReviewPage(envelope([row]), clientId, businessId),
            null,
          );
        assert.ok(
          parseQmapsReviewPage(
            envelope([sourceReview({ body: null, ownerReply: null })]),
            clientId,
            businessId,
          ),
        );
      },
    );
    await check(
      "tracked review identities are stable and isolated by tenant, listing and source review",
      () => {
        const id = qmapsTrackedReviewId(clientId, listingId, reviewId);
        assert.match(
          id,
          /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        assert.equal(
          id,
          qmapsTrackedReviewId(
            clientId.toUpperCase(),
            listingId.toUpperCase(),
            reviewId.toUpperCase(),
          ),
        );
        assert.notEqual(id, qmapsTrackedReviewId(otherId, listingId, reviewId));
        assert.notEqual(id, qmapsTrackedReviewId(clientId, otherId, reviewId));
        assert.notEqual(id, qmapsTrackedReviewId(clientId, listingId, otherId));
        assert.throws(
          () => qmapsTrackedReviewId("bad", listingId, reviewId),
          /invalid_qmaps_identity/,
        );
      },
    );
    await check(
      "read client sends explicit scope, bounded page size, no-store and no secret redirects",
      async () => {
        const calls: Array<{ url: string; options: RequestInit }> = [];
        const cursor = { createdAt, id: reviewId };
        assert.equal(
          (
            await fetchQmapsReviewPage(
              clientId,
              businessId,
              cursor,
              fakeFetch(envelope(), calls),
            )
          ).ok,
          true,
        );
        assert.equal(calls.length, 1);
        assert.equal(
          calls[0].url,
          "https://qmaps.example/functions/v1/takatak-list-reviews",
        );
        assert.equal(calls[0].options.method, "POST");
        assert.equal(calls[0].options.redirect, "error");
        assert.equal(calls[0].options.cache, "no-store");
        assert.equal(
          new Headers(calls[0].options.headers).get(
            "x-qmaps-integration-secret",
          ),
          process.env.QMAPS_INTEGRATION_SECRET,
        );
        assert.deepEqual(JSON.parse(String(calls[0].options.body)), {
          version: 1,
          clientId,
          businessId,
          limit: 25,
          cursor,
        });
      },
    );
    await check(
      "unconfigured, weak or unsafe transport and invalid identities make no network call",
      async () => {
        const calls: Array<{ url: string; options: RequestInit }> = [];
        const fetcher = fakeFetch(envelope(), calls);
        const base = process.env.QMAPS_FUNCTIONS_BASE_URL;
        const secret = process.env.QMAPS_INTEGRATION_SECRET;
        try {
          delete process.env.QMAPS_INTEGRATION_SECRET;
          assert.deepEqual(
            await fetchQmapsReviewPage(clientId, businessId, null, fetcher),
            { ok: false, reason: "not_configured" },
          );
          process.env.QMAPS_INTEGRATION_SECRET = "short";
          assert.deepEqual(
            await fetchQmapsReviewPage(clientId, businessId, null, fetcher),
            { ok: false, reason: "not_configured" },
          );
          process.env.QMAPS_INTEGRATION_SECRET = secret;
          for (const url of [
            "http://qmaps.example",
            "https://user:pass@qmaps.example",
            "https://qmaps.example?x=y",
            "https://qmaps.example/#fragment",
            "not-a-url",
          ]) {
            process.env.QMAPS_FUNCTIONS_BASE_URL = url;
            assert.deepEqual(
              await fetchQmapsReviewPage(clientId, businessId, null, fetcher),
              { ok: false, reason: "not_configured" },
            );
          }
          process.env.QMAPS_FUNCTIONS_BASE_URL = base;
          assert.deepEqual(
            await fetchQmapsReviewPage("bad", businessId, null, fetcher),
            { ok: false, reason: "refused" },
          );
          assert.deepEqual(
            await fetchQmapsReviewPage(
              clientId,
              businessId,
              { createdAt: "bad", id: reviewId },
              fetcher,
            ),
            { ok: false, reason: "refused" },
          );
          assert.equal(calls.length, 0);
        } finally {
          process.env.QMAPS_FUNCTIONS_BASE_URL = base;
          process.env.QMAPS_INTEGRATION_SECRET = secret;
        }
      },
    );
    await check(
      "refused, malformed or cross-tenant responses never count as accepted pages",
      async () => {
        assert.deepEqual(
          await fetchQmapsReviewPage(
            clientId,
            businessId,
            null,
            (async () =>
              new Response("refused", { status: 403 })) as typeof fetch,
          ),
          { ok: false, reason: "refused" },
        );
        assert.deepEqual(
          await fetchQmapsReviewPage(
            clientId,
            businessId,
            null,
            (async () => new Response("not JSON")) as typeof fetch,
          ),
          { ok: false, reason: "invalid_response" },
        );
        assert.deepEqual(
          await fetchQmapsReviewPage(
            clientId,
            businessId,
            null,
            fakeFetch({ ...envelope(), clientId: otherId }),
          ),
          { ok: false, reason: "invalid_response" },
        );
        assert.deepEqual(
          await fetchQmapsReviewPage(clientId, businessId, null, (async () => {
            throw new Error("synthetic network failure");
          }) as typeof fetch),
          { ok: false, reason: "unreachable" },
        );
      },
    );
    await check(
      "declared and streamed oversized response bodies are rejected",
      async () => {
        assert.deepEqual(
          await fetchQmapsReviewPage(
            clientId,
            businessId,
            null,
            (async () =>
              new Response("{}", {
                headers: { "content-length": "1048577" },
              })) as typeof fetch,
          ),
          { ok: false, reason: "invalid_response" },
        );
        assert.deepEqual(
          await fetchQmapsReviewPage(
            clientId,
            businessId,
            null,
            (async () => new Response("x".repeat(1048577))) as typeof fetch,
          ),
          { ok: false, reason: "invalid_response" },
        );
      },
    );
    await check(
      "sync rechecks canonical tenant and related brand ownership within the write transaction",
      async () => {
        const f = fixture();
        assert.equal(
          (
            await syncQmapsReviews(
              clientId,
              listingId,
              "latest",
              f.db,
              fakeFetch(),
            )
          ).ok,
          true,
        );
        assert.equal(f.transactions(), 1);
        assert.deepEqual(
          f.listingReads.map((read) => read.transaction),
          [false, true],
        );
        for (const read of f.listingReads) {
          assert.equal(read.args.where.id, listingId);
          assert.equal(read.args.where.clientId, clientId);
          assert.equal(read.args.where.provider, "qmaps");
          assert.deepEqual(read.args.where.status, { not: "archived" });
          assert.deepEqual(read.args.where.OR, [
            { businessBrandId: null },
            { businessBrand: { clientId } },
          ]);
        }
        assert.deepEqual(record(f.listingReads[1].args.where.metadata), {
          path: ["qmapsBusinessId"],
          equals: businessId,
        });
        assert.equal(f.reviewReads.length, 1);
      },
    );
    await check(
      "foreign or ambiguous listings refuse before fetching and never write",
      async () => {
        for (const options of [{ missing: true }, { ambiguous: true }]) {
          const f = fixture(options),
            calls: Array<{ url: string; options: RequestInit }> = [];
          const result = await syncQmapsReviews(
            clientId,
            listingId,
            "latest",
            f.db,
            fakeFetch(envelope(), calls),
          );
          assert.equal(result.ok, false);
          assert.equal(calls.length, 0);
          assert.equal(f.transactions(), 0);
          assert.equal(f.writes.length, 0);
        }
      },
    );
    await check(
      "post-fetch ownership and uniqueness changes refuse before writes",
      async () => {
        for (const options of [
          { disappear: true },
          { becomeAmbiguous: true },
        ]) {
          const f = fixture(options),
            calls: Array<{ url: string; options: RequestInit }> = [];
          const result = await syncQmapsReviews(
            clientId,
            listingId,
            "latest",
            f.db,
            fakeFetch(envelope(), calls),
          );
          assert.equal(result.ok, false);
          assert.equal(calls.length, 1);
          assert.equal(f.transactions(), 1);
          assert.equal(f.writes.length, 0);
        }
      },
    );
    await check(
      "invalid remote scope and row identities never reach a write transaction",
      async () => {
        for (const payload of [
          { ...envelope(), clientId: otherId },
          envelope([sourceReview({ businessId: otherId })]),
        ]) {
          const f = fixture();
          assert.deepEqual(
            await syncQmapsReviews(
              clientId,
              listingId,
              "latest",
              f.db,
              fakeFetch(payload),
            ),
            { ok: false, reason: "invalid_response" },
          );
          assert.equal(f.transactions(), 0);
          assert.equal(f.writes.length, 0);
        }
      },
    );
    await check(
      "older review pages use the stored cursor and never accept a browser cursor",
      async () => {
        const cursor = { createdAt, id: otherId };
        const f = fixture({ metadata: { qmapsReviewsNextCursor: cursor } }),
          calls: Array<{ url: string; options: RequestInit }> = [];
        assert.equal(
          (
            await syncQmapsReviews(
              clientId,
              listingId,
              "older",
              f.db,
              fakeFetch(envelope(), calls),
            )
          ).ok,
          true,
        );
        assert.deepEqual(
          JSON.parse(String(calls[0].options.body)).cursor,
          cursor,
        );
        const empty = fixture();
        assert.deepEqual(
          await syncQmapsReviews(
            clientId,
            listingId,
            "older",
            empty.db,
            fakeFetch(envelope(), calls),
          ),
          { ok: false, reason: "no_cursor" },
        );
        assert.equal(calls.length, 1);
        assert.equal(empty.writes.length, 0);
      },
    );
    await check(
      "retries retain immutable tracking IDs and update rather than duplicate reviews",
      async () => {
        const f = fixture();
        assert.deepEqual(
          await syncQmapsReviews(
            clientId,
            listingId,
            "latest",
            f.db,
            fakeFetch(),
          ),
          {
            ok: true,
            fetched: 1,
            created: 1,
            updated: 0,
            skipped: 0,
            hasMore: false,
          },
        );
        const id = f.reviews.get(reviewId)?.id;
        assert.equal(id, qmapsTrackedReviewId(clientId, listingId, reviewId));
        assert.deepEqual(
          await syncQmapsReviews(
            clientId,
            listingId,
            "latest",
            f.db,
            fakeFetch(),
          ),
          {
            ok: true,
            fetched: 1,
            created: 0,
            updated: 1,
            skipped: 0,
            hasMore: false,
          },
        );
        assert.equal(f.reviews.size, 1);
        assert.equal(f.reviews.get(reviewId)?.id, id);
      },
    );
    await check(
      "a partial page preserves unrelated reviews and existing listing metadata",
      async () => {
        const unrelated: StoredReview = {
          id: otherId,
          metadata: { qmapsReviewId: otherId, source: "qmaps" },
          body: "Unrelated synthetic review",
        };
        const f = fixture({ reviews: [unrelated] });
        const cursor = { createdAt, id: reviewId };
        const result = await syncQmapsReviews(
          clientId,
          listingId,
          "latest",
          f.db,
          fakeFetch(envelope([sourceReview()], cursor)),
        );
        assert.equal(result.ok, true);
        if (result.ok) assert.equal(result.hasMore, true);
        assert.equal(f.reviews.size, 2);
        assert.equal(f.reviews.get(otherId)?.body, unrelated.body);
        assert.equal(f.metadata().internalNote, "keep local metadata");
        assert.deepEqual(f.metadata().qmapsReviewsNextCursor, cursor);
        assert.equal(f.metadata().qmapsReviewsWindowSize, 1);
      },
    );
    await check(
      "source publication requires both public owner text and recorded reply time",
      async () => {
        const confirmed = fixture();
        await syncQmapsReviews(
          clientId,
          listingId,
          "latest",
          confirmed.db,
          fakeFetch(
            envelope([
              sourceReview({
                ownerReply: "Synthetic owner response",
                ownerRepliedAt: updatedAt,
              }),
            ]),
          ),
        );
        assert.equal(
          confirmed.reviews.get(reviewId)?.metadata.replyState,
          "sent_to_qmaps",
        );
        assert.equal(
          confirmed.reviews.get(reviewId)?.replyStatus,
          "replied_internal",
        );
        for (const row of [
          sourceReview({ ownerReply: "No source time" }),
          sourceReview({ ownerReply: "   ", ownerRepliedAt: updatedAt }),
        ]) {
          const f = fixture();
          await syncQmapsReviews(
            clientId,
            listingId,
            "latest",
            f.db,
            fakeFetch(envelope([row])),
          );
          assert.equal(
            f.reviews.get(reviewId)?.metadata.replyState,
            "not_sent",
          );
          assert.equal(f.reviews.get(reviewId)?.replyStatus, "not_replied");
        }
      },
    );
    await check(
      "newer local acknowledged replies survive an older source snapshot",
      async () => {
        const metadata = {
          source: "qmaps",
          qmapsReviewId: reviewId,
          replyText: "Newest local acknowledgement",
          replyState: "sent_to_qmaps",
          repliedAt: "2026-01-03T12:00:00Z",
        };
        const f = fixture({ reviews: [{ id: otherId, metadata }] });
        await syncQmapsReviews(
          clientId,
          listingId,
          "latest",
          f.db,
          fakeFetch(),
        );
        assert.equal(
          f.reviews.get(reviewId)?.metadata.replyText,
          metadata.replyText,
        );
        assert.equal(
          f.reviews.get(reviewId)?.metadata.replyState,
          "sent_to_qmaps",
        );
        assert.equal(f.reviews.get(reviewId)?.replyStatus, "replied_internal");
      },
    );
    await check(
      "stale source versions are counted as skipped and never overwrite newer records",
      async () => {
        const metadata = {
          source: "qmaps",
          qmapsReviewId: reviewId,
          qmapsSourceUpdatedAt: "2026-01-03T12:00:00Z",
        };
        const f = fixture({
          reviews: [{ id: otherId, metadata, body: "Newer local source body" }],
        });
        assert.deepEqual(
          await syncQmapsReviews(
            clientId,
            listingId,
            "latest",
            f.db,
            fakeFetch(),
          ),
          {
            ok: true,
            fetched: 1,
            created: 0,
            updated: 0,
            skipped: 1,
            hasMore: false,
          },
        );
        assert.equal(f.reviews.get(reviewId)?.body, "Newer local source body");
        assert.equal(
          f.writes.some((write) => write.kind.startsWith("review.")),
          false,
        );
      },
    );
    await check(
      "pull audits contain counts and scope without review text, response text or credentials",
      async () => {
        const f = fixture();
        await syncQmapsReviews(
          clientId,
          listingId,
          "latest",
          f.db,
          fakeFetch(),
        );
        const audit = record(
          record(f.writes.find((write) => write.kind === "audit.create")?.args)
            .data,
        );
        assert.equal(audit.clientId, clientId);
        assert.equal(audit.entityId, listingId);
        assert.deepEqual(audit.metadata, {
          mode: "latest",
          fetched: 1,
          created: 1,
          updated: 0,
          skipped: 0,
          hasMore: false,
        });
        const serialized = JSON.stringify(audit);
        assert.equal(serialized.includes(sourceReview().body!), false);
        assert.equal(
          serialized.includes(process.env.QMAPS_INTEGRATION_SECRET!),
          false,
        );
      },
    );
    await check(
      "invalid workspace, listing and operation reject before any database or fetch access",
      async () => {
        const f = fixture(),
          calls: Array<{ url: string; options: RequestInit }> = [];
        for (const [tenant, listing, mode] of [
          ["bad", listingId, "latest"],
          [clientId, "bad", "latest"],
          [clientId, listingId, "wrong"],
        ]) {
          assert.deepEqual(
            await syncQmapsReviews(
              tenant,
              listing,
              mode as "latest",
              f.db,
              fakeFetch(envelope(), calls),
            ),
            { ok: false, reason: "invalid_listing" },
          );
        }
        assert.equal(f.listingReads.length, 0);
        assert.equal(calls.length, 0);
      },
    );
    await check(
      "scoped replies use only the v2 mutation path and require all echoed scope IDs",
      async () => {
        const payload = {
          version: 1,
          clientId,
          businessId,
          reviewId,
          body: "Synthetic operator reply",
        };
        const calls: Array<{ url: string; options: RequestInit }> = [];
        const acknowledgment = {
          ok: true,
          version: 1,
          clientId,
          businessId,
          reviewId,
          ownerReply: payload.body,
          ownerRepliedAt: updatedAt,
        };
        assert.deepEqual(
          await postQmaps(
            "takatak-reply-review-v2",
            payload,
            fakeFetch(acknowledgment, calls),
          ),
          { ok: true },
        );
        assert.equal(calls.length, 1);
        assert.equal(
          calls[0].url,
          "https://qmaps.example/functions/v1/takatak-reply-review-v2",
        );
        assert.equal(calls[0].options.redirect, "error");
        assert.deepEqual(JSON.parse(String(calls[0].options.body)), payload);
        for (const output of [
          { ...acknowledgment, clientId: otherId },
          { ...acknowledgment, businessId: otherId },
          { ...acknowledgment, reviewId: otherId },
          { ...acknowledgment, version: 2 },
          { ...acknowledgment, ownerReply: "Different reply" },
          { ...acknowledgment, ownerRepliedAt: "invalid" },
          { ...acknowledgment, ownerRepliedAt: null },
          { ok: true, reviewId },
          { ok: true, version: 1 },
        ])
          assert.equal(
            (
              await postQmaps(
                "takatak-reply-review-v2",
                payload,
                fakeFetch(output),
              )
            ).ok,
            false,
          );
      },
    );
    await check(
      "reply publication does not treat asynchronous acceptance as a confirmed source write",
      async () => {
        const payload = {
          version: 1,
          clientId,
          businessId,
          reviewId,
          body: "Synthetic operator reply",
        };
        const accepted = (async () =>
          new Response(
            JSON.stringify({
              ok: true,
              version: 1,
              clientId,
              businessId,
              reviewId,
              ownerReply: payload.body,
              ownerRepliedAt: updatedAt,
            }),
            { status: 202 },
          )) as typeof fetch;
        assert.equal(
          (await postQmaps("takatak-reply-review-v2", payload, accepted)).ok,
          false,
        );
      },
    );
    await check(
      "missing or malformed reply scope refuses before network access",
      async () => {
        const calls: Array<{ url: string; options: RequestInit }> = [];
        for (const payload of [
          undefined,
          {},
          { version: 1 },
          { version: 1, clientId, businessId, reviewId: "bad", body: "Reply" },
          { version: 2, clientId, businessId, reviewId, body: "Reply" },
        ]) {
          assert.equal(
            (
              await postQmaps(
                "takatak-reply-review-v2",
                payload,
                fakeFetch({ ok: true, version: 1 }, calls),
              )
            ).ok,
            false,
          );
        }
        assert.equal(calls.length, 0);
      },
    );
    await check(
      "mutation acknowledgment bodies are bounded independently from review pages",
      async () => {
        const payload = {
          version: 1,
          clientId,
          businessId,
          reviewId,
          body: "Synthetic reply",
        };
        const oversized = (async () =>
          new Response("x".repeat(32769))) as typeof fetch;
        assert.equal(
          (await postQmaps("takatak-reply-review-v2", payload, oversized)).ok,
          false,
        );
      },
    );
    await check(
      "an undeployed v2 endpoint fails safely without falling back to the old global mutation",
      async () => {
        const calls: string[] = [];
        const absent = (async (url: string | URL | Request) => {
          calls.push(String(url));
          return new Response("not deployed", { status: 404 });
        }) as typeof fetch;
        assert.equal(
          (
            await postQmaps(
              "takatak-reply-review-v2",
              {
                version: 1,
                clientId,
                businessId,
                reviewId,
                body: "Synthetic reply",
              },
              absent,
            )
          ).ok,
          false,
        );
        assert.deepEqual(calls, [
          "https://qmaps.example/functions/v1/takatak-reply-review-v2",
        ]);
      },
    );
    console.log(
      `QMAPS review API: ${count} checks passed; no live network or database operations.`,
    );
  } finally {
    if (oldBase === undefined) delete process.env.QMAPS_FUNCTIONS_BASE_URL;
    else process.env.QMAPS_FUNCTIONS_BASE_URL = oldBase;
    if (oldSecret === undefined) delete process.env.QMAPS_INTEGRATION_SECRET;
    else process.env.QMAPS_INTEGRATION_SECRET = oldSecret;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
