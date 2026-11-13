import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { fetchQmapsReviewVisibility } from "../src/lib/qmaps/reviews-api";
import { reconcileQmapsReviewVisibility } from "../src/lib/qmaps/review-visibility";

const clientId = "11111111-1111-4111-8111-111111111111";
const listingId = "22222222-2222-4222-8222-222222222222";
const businessId = "33333333-3333-4333-8333-333333333333";
const otherId = "99999999-9999-4999-8999-999999999999";
const localId = (index: number) =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
const sourceId = (index: number) =>
  `10000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
const updatedAt = new Date("2026-01-01T12:00:00.000Z");
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
type SourceVisibility = { id: string; visible: boolean };
const envelope = (
  reviews: unknown[] = [{ id: sourceId(1), visible: true }],
) => ({ ok: true, version: 1, clientId, businessId, reviews });
const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
type FetchCall = {
  url: string;
  options: RequestInit;
  body: Record<string, unknown>;
};
function visibilityFetch(
  options: {
    unavailable?: string[];
    payload?: unknown;
    status?: number;
    fail?: boolean;
  } = {},
  calls: FetchCall[] = [],
) {
  return (async (url: string | URL | Request, optionsArg?: RequestInit) => {
    const body = JSON.parse(String(optionsArg?.body ?? "{}")) as Record<
      string,
      unknown
    >;
    calls.push({ url: String(url), options: optionsArg ?? {}, body });
    if (options.fail) throw new Error("Synthetic source unavailable");
    if (options.status && options.status !== 200)
      return new Response("Source unavailable", { status: options.status });
    const ids = Array.isArray(body.reviewIds)
      ? (body.reviewIds as string[])
      : [];
    return response(
      options.payload ??
        envelope(
          ids.map((id) => ({
            id,
            visible: !(options.unavailable ?? []).includes(id),
          })),
        ),
    );
  }) as typeof fetch;
}

type LocalRow = {
  id: string;
  metadata: Record<string, unknown>;
  updatedAt: Date;
  status: string;
  body: string;
};
function localRow(index: number, overrides: Partial<LocalRow> = {}): LocalRow {
  return {
    id: localId(index),
    metadata: { source: "qmaps", qmapsReviewId: sourceId(index) },
    updatedAt,
    status: "needs_review",
    body: "Synthetic private local review body",
    ...overrides,
  };
}
type Args = {
  where: Record<string, unknown>;
  select?: unknown;
  orderBy?: unknown;
  take?: number;
};
function fixture(
  options: {
    rows?: LocalRow[];
    metadata?: Record<string, unknown>;
    missing?: boolean;
    ambiguous?: boolean;
    disappear?: boolean;
    becomeAmbiguous?: boolean;
    changedIds?: string[];
  } = {},
) {
  let inTransaction = false,
    transactions = 0;
  let metadata: Record<string, unknown> = {
    qmapsBusinessId: businessId,
    internalNote: "Keep listing metadata",
    ...options.metadata,
  };
  const rows = new Map<string, LocalRow>(
    (options.rows ?? [localRow(1)]).map((row) => [
      row.id,
      { ...row, metadata: { ...row.metadata } },
    ]),
  );
  const listingReads: Array<{ args: Args; transaction: boolean }> = [];
  const mappingReads: Array<{ args: Args; transaction: boolean }> = [];
  const reviewReads: Args[] = [];
  const writes: Array<{ kind: string; args: unknown }> = [];
  const localListing = {
    async findFirst(args: Args) {
      listingReads.push({ args, transaction: inTransaction });
      if (options.missing || (options.disappear && inTransaction)) return null;
      return { id: listingId, metadata: { ...metadata } };
    },
    async findMany(args: Args) {
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
      metadata = object(args.data.metadata);
      return { id: listingId };
    },
  };
  const listingReview = {
    async findMany(args: Args) {
      assert.equal(inTransaction, false);
      assert.equal(args.where.clientId, clientId);
      assert.equal(args.where.localListingId, listingId);
      assert.equal(args.where.provider, "qmaps");
      assert.deepEqual(args.where.status, { not: "archived" });
      reviewReads.push(args);
      const after = object(args.where.id).gt;
      return Array.from(rows.values())
        .filter(
          (row) =>
            row.status !== "archived" &&
            (typeof after !== "string" || row.id > after),
        )
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, args.take)
        .map((row) => ({
          id: row.id,
          metadata: { ...row.metadata },
          updatedAt: row.updatedAt,
        }));
    },
    async updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) {
      assert.equal(inTransaction, true);
      assert.equal(args.where.clientId, clientId);
      assert.equal(args.where.localListingId, listingId);
      assert.equal(args.where.provider, "qmaps");
      assert.deepEqual(args.data, { status: "archived" });
      const row = rows.get(String(args.where.id));
      assert.ok(row);
      assert.deepEqual(args.where.metadata, {
        path: ["qmapsReviewId"],
        equals: row.metadata.qmapsReviewId,
      });
      assert.equal(args.where.updatedAt, row.updatedAt);
      writes.push({ kind: "review.archive", args });
      if ((options.changedIds ?? []).includes(row.id)) return { count: 0 };
      row.status = "archived";
      return { count: 1 };
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
    rows,
    listingReads,
    mappingReads,
    reviewReads,
    writes,
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
  const oldBase = process.env.QMAPS_FUNCTIONS_BASE_URL,
    oldSecret = process.env.QMAPS_INTEGRATION_SECRET;
  process.env.QMAPS_FUNCTIONS_BASE_URL = "https://qmaps.example/functions/v1";
  process.env.QMAPS_INTEGRATION_SECRET =
    "synthetic-test-secret-32-characters-minimum";
  try {
    await check(
      "visibility responses require exact scoped identity and return only explicit unavailable IDs",
      async () => {
        const result = await fetchQmapsReviewVisibility(
          clientId,
          businessId,
          [sourceId(1), sourceId(2)],
          visibilityFetch({
            payload: {
              ...envelope([
                {
                  id: sourceId(2),
                  visible: false,
                  userId: "private-source-member",
                },
                { id: sourceId(1), visible: true },
              ]),
              private: "not forwarded",
            },
          }),
        );
        assert.deepEqual(result, {
          ok: true,
          unavailableReviewIds: [sourceId(2)],
        });
        for (const payload of [
          { ...envelope(), clientId: otherId },
          { ...envelope(), businessId: otherId },
          { ...envelope(), version: 2 },
          { ...envelope(), ok: false },
        ])
          assert.deepEqual(
            await fetchQmapsReviewVisibility(
              clientId,
              businessId,
              [sourceId(1)],
              visibilityFetch({ payload }),
            ),
            { ok: false, reason: "invalid_response" },
          );
      },
    );
    await check(
      "partial, duplicate, foreign and non-boolean visibility coverage fail closed",
      async () => {
        for (const reviews of [
          [],
          [{ id: sourceId(1), visible: true }],
          [
            { id: sourceId(1), visible: true },
            { id: sourceId(1), visible: false },
          ],
          [
            { id: sourceId(1), visible: true },
            { id: otherId, visible: false },
          ],
          [
            { id: sourceId(1), visible: true },
            { id: sourceId(2), visible: "false" },
          ],
          [
            { id: sourceId(1), visible: true },
            { id: sourceId(2), visible: true },
            { id: sourceId(3), visible: false },
          ],
        ])
          assert.deepEqual(
            await fetchQmapsReviewVisibility(
              clientId,
              businessId,
              [sourceId(1), sourceId(2)],
              visibilityFetch({ payload: envelope(reviews) }),
            ),
            { ok: false, reason: "invalid_response" },
          );
      },
    );
    await check(
      "visibility requests bind exact IDs and forbid redirects or credential URLs",
      async () => {
        const calls: FetchCall[] = [];
        await fetchQmapsReviewVisibility(
          clientId,
          businessId,
          [sourceId(1)],
          visibilityFetch({}, calls),
        );
        assert.equal(calls.length, 1);
        assert.equal(
          calls[0].url,
          "https://qmaps.example/functions/v1/takatak-review-visibility",
        );
        assert.equal(calls[0].options.method, "POST");
        assert.equal(calls[0].options.redirect, "error");
        assert.equal(calls[0].options.cache, "no-store");
        assert.deepEqual(calls[0].body, {
          version: 1,
          clientId,
          businessId,
          reviewIds: [sourceId(1)],
        });
        assert.equal(
          new Headers(calls[0].options.headers).get(
            "x-qmaps-integration-secret",
          ),
          process.env.QMAPS_INTEGRATION_SECRET,
        );
      },
    );
    await check(
      "invalid IDs, duplicates, empty requests and batches above100 never fetch",
      async () => {
        const calls: FetchCall[] = [],
          fetcher = visibilityFetch({}, calls);
        for (const ids of [
          [],
          ["bad"],
          [sourceId(1), sourceId(1)],
          Array.from({ length: 101 }, (_, index) => sourceId(index + 1)),
        ])
          assert.deepEqual(
            await fetchQmapsReviewVisibility(
              clientId,
              businessId,
              ids,
              fetcher,
            ),
            { ok: false, reason: "refused" },
          );
        assert.deepEqual(
          await fetchQmapsReviewVisibility(
            "bad",
            businessId,
            [sourceId(1)],
            fetcher,
          ),
          { ok: false, reason: "refused" },
        );
        assert.deepEqual(
          await fetchQmapsReviewVisibility(
            clientId,
            "bad",
            [sourceId(1)],
            fetcher,
          ),
          { ok: false, reason: "refused" },
        );
        assert.equal(calls.length, 0);
        assert.equal(
          (
            await fetchQmapsReviewVisibility(
              clientId,
              businessId,
              Array.from({ length: 100 }, (_, index) => sourceId(index + 1)),
              fetcher,
            )
          ).ok,
          true,
        );
        assert.equal(calls.length, 1);
      },
    );
    await check(
      "missing or weak authentication and unsafe configured endpoints make no network request",
      async () => {
        const base = process.env.QMAPS_FUNCTIONS_BASE_URL,
          secret = process.env.QMAPS_INTEGRATION_SECRET,
          calls: FetchCall[] = [];
        try {
          delete process.env.QMAPS_INTEGRATION_SECRET;
          assert.deepEqual(
            await fetchQmapsReviewVisibility(
              clientId,
              businessId,
              [sourceId(1)],
              visibilityFetch({}, calls),
            ),
            { ok: false, reason: "not_configured" },
          );
          process.env.QMAPS_INTEGRATION_SECRET = "short";
          assert.deepEqual(
            await fetchQmapsReviewVisibility(
              clientId,
              businessId,
              [sourceId(1)],
              visibilityFetch({}, calls),
            ),
            { ok: false, reason: "not_configured" },
          );
          process.env.QMAPS_INTEGRATION_SECRET = secret;
          for (const url of [
            "http://qmaps.example",
            "https://user:pass@qmaps.example",
            "https://qmaps.example?secret=x",
            "https://qmaps.example/#fragment",
            "invalid",
          ]) {
            process.env.QMAPS_FUNCTIONS_BASE_URL = url;
            assert.deepEqual(
              await fetchQmapsReviewVisibility(
                clientId,
                businessId,
                [sourceId(1)],
                visibilityFetch({}, calls),
              ),
              { ok: false, reason: "not_configured" },
            );
          }
          assert.equal(calls.length, 0);
        } finally {
          process.env.QMAPS_FUNCTIONS_BASE_URL = base;
          process.env.QMAPS_INTEGRATION_SECRET = secret;
        }
      },
    );
    await check(
      "non200 status, invalid JSON and transport failures never establish unavailability",
      async () => {
        for (const status of [202, 403, 404, 503])
          assert.deepEqual(
            await fetchQmapsReviewVisibility(
              clientId,
              businessId,
              [sourceId(1)],
              visibilityFetch({ status }),
            ),
            { ok: false, reason: "refused" },
          );
        assert.deepEqual(
          await fetchQmapsReviewVisibility(
            clientId,
            businessId,
            [sourceId(1)],
            (async () => new Response("not JSON")) as typeof fetch,
          ),
          { ok: false, reason: "invalid_response" },
        );
        assert.deepEqual(
          await fetchQmapsReviewVisibility(
            clientId,
            businessId,
            [sourceId(1)],
            visibilityFetch({ fail: true }),
          ),
          { ok: false, reason: "unreachable" },
        );
      },
    );
    await check(
      "declared and streamed visibility bodies above64KB are refused",
      async () => {
        for (const fetcher of [
          (async () =>
            new Response("{}", {
              headers: { "content-length": "64001" },
            })) as typeof fetch,
          (async () => new Response("x".repeat(64001))) as typeof fetch,
        ])
          assert.deepEqual(
            await fetchQmapsReviewVisibility(
              clientId,
              businessId,
              [sourceId(1)],
              fetcher,
            ),
            { ok: false, reason: "invalid_response" },
          );
      },
    );
    await check(
      "reconciliation scopes listing and brand reads before fetch and inside the transaction",
      async () => {
        const f = fixture();
        const result = await reconcileQmapsReviewVisibility(
          clientId,
          listingId,
          f.db,
          visibilityFetch(),
        );
        assert.deepEqual(result, {
          ok: true,
          checked: 1,
          archived: 0,
          hasMore: false,
        });
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
        assert.deepEqual(f.listingReads[1].args.where.metadata, {
          path: ["qmapsBusinessId"],
          equals: businessId,
        });
        assert.deepEqual(
          f.mappingReads.map((read) => read.transaction),
          [false, true],
        );
        assert.deepEqual(f.reviewReads[0].select, {
          id: true,
          metadata: true,
          updatedAt: true,
        });
        assert.deepEqual(f.reviewReads[0].orderBy, { id: "asc" });
        assert.equal(f.reviewReads[0].take, 101);
      },
    );
    await check(
      "only explicit unavailable rows archive with tenant, mapping and optimistic-version guards",
      async () => {
        const f = fixture({ rows: [localRow(1), localRow(2)] });
        assert.deepEqual(
          await reconcileQmapsReviewVisibility(
            clientId,
            listingId,
            f.db,
            visibilityFetch({ unavailable: [sourceId(2)] }),
          ),
          { ok: true, checked: 2, archived: 1, hasMore: false },
        );
        assert.equal(f.rows.get(localId(1))?.status, "needs_review");
        assert.equal(f.rows.get(localId(2))?.status, "archived");
        const archives = f.writes.filter(
          (write) => write.kind === "review.archive",
        );
        assert.equal(archives.length, 1);
        assert.deepEqual(object(archives[0].args).where, {
          id: localId(2),
          clientId,
          localListingId: listingId,
          provider: "qmaps",
          updatedAt,
          metadata: { path: ["qmapsReviewId"], equals: sourceId(2) },
        });
        assert.deepEqual(object(archives[0].args).data, { status: "archived" });
      },
    );
    await check(
      "source outages and incomplete status coverage cause zero writes and no cursor advance",
      async () => {
        for (const remote of [
          { status: 503 },
          { fail: true },
          { payload: envelope([]) },
          { payload: envelope([{ id: otherId, visible: false }]) },
        ]) {
          const f = fixture();
          const result = await reconcileQmapsReviewVisibility(
            clientId,
            listingId,
            f.db,
            visibilityFetch(remote),
          );
          assert.equal(result.ok, false);
          assert.equal(f.transactions(), 0);
          assert.equal(f.writes.length, 0);
          assert.equal(f.rows.get(localId(1))?.status, "needs_review");
        }
      },
    );
    await check(
      "foreign or ambiguous business mappings refuse before source calls",
      async () => {
        for (const options of [{ missing: true }, { ambiguous: true }]) {
          const f = fixture(options),
            calls: FetchCall[] = [];
          assert.equal(
            (
              await reconcileQmapsReviewVisibility(
                clientId,
                listingId,
                f.db,
                visibilityFetch({}, calls),
              )
            ).ok,
            false,
          );
          assert.equal(calls.length, 0);
          assert.equal(f.transactions(), 0);
          assert.equal(f.reviewReads.length, 0);
          assert.equal(f.writes.length, 0);
        }
      },
    );
    await check(
      "post-fetch ownership or link ambiguity changes prevent archival and audits",
      async () => {
        for (const options of [
          { disappear: true },
          { becomeAmbiguous: true },
        ]) {
          const f = fixture(options),
            calls: FetchCall[] = [];
          assert.equal(
            (
              await reconcileQmapsReviewVisibility(
                clientId,
                listingId,
                f.db,
                visibilityFetch({ unavailable: [sourceId(1)] }, calls),
              )
            ).ok,
            false,
          );
          assert.equal(calls.length, 1);
          assert.equal(f.transactions(), 1);
          assert.equal(f.writes.length, 0);
          assert.equal(f.rows.get(localId(1))?.status, "needs_review");
        }
      },
    );
    await check(
      "101 local rows request100 IDs and persist only a server-side local-row cursor",
      async () => {
        const f = fixture({
            rows: Array.from({ length: 101 }, (_, index) =>
              localRow(index + 1),
            ),
          }),
          calls: FetchCall[] = [];
        assert.deepEqual(
          await reconcileQmapsReviewVisibility(
            clientId,
            listingId,
            f.db,
            visibilityFetch({}, calls),
          ),
          { ok: true, checked: 100, archived: 0, hasMore: true },
        );
        assert.equal((calls[0].body.reviewIds as string[]).length, 100);
        assert.equal(
          (calls[0].body.reviewIds as string[]).includes(sourceId(101)),
          false,
        );
        assert.equal(f.metadata().qmapsVisibilityCursor, localId(100));
        assert.deepEqual(
          await reconcileQmapsReviewVisibility(
            clientId,
            listingId,
            f.db,
            visibilityFetch({}, calls),
          ),
          { ok: true, checked: 1, archived: 0, hasMore: false },
        );
        assert.deepEqual(calls[1].body.reviewIds, [sourceId(101)]);
        assert.equal(f.metadata().qmapsVisibilityCursor, null);
        assert.deepEqual(f.reviewReads[1].where.id, { gt: localId(100) });
      },
    );
    await check(
      "persisted cursor reads only subsequent scoped local rows",
      async () => {
        const f = fixture({
            rows: [localRow(1), localRow(2), localRow(3)],
            metadata: { qmapsVisibilityCursor: localId(2) },
          }),
          calls: FetchCall[] = [];
        await reconcileQmapsReviewVisibility(
          clientId,
          listingId,
          f.db,
          visibilityFetch({}, calls),
        );
        assert.deepEqual(calls[0].body.reviewIds, [sourceId(3)]);
        assert.deepEqual(f.reviewReads[0].where.id, { gt: localId(2) });
        assert.equal(f.rows.get(localId(1))?.status, "needs_review");
        assert.equal(f.rows.get(localId(2))?.status, "needs_review");
      },
    );
    await check(
      "empty batches do not fetch or archive and reset completed cursors",
      async () => {
        const lastCheck = "2025-12-01T12:00:00.000Z";
        const f = fixture({
            rows: [],
            metadata: {
              qmapsVisibilityCursor: localId(100),
              qmapsVisibilityLastCheckedAt: lastCheck,
            },
          }),
          calls: FetchCall[] = [];
        assert.deepEqual(
          await reconcileQmapsReviewVisibility(
            clientId,
            listingId,
            f.db,
            visibilityFetch({}, calls),
          ),
          { ok: true, checked: 0, archived: 0, hasMore: false },
        );
        assert.equal(calls.length, 0);
        assert.equal(
          f.writes.some((write) => write.kind === "review.archive"),
          false,
        );
        assert.equal(f.metadata().qmapsVisibilityCursor, null);
        assert.equal(f.metadata().qmapsVisibilityLastCheckedAt, lastCheck);
        assert.deepEqual(
          object(
            object(
              f.writes.find((write) => write.kind === "audit.create")?.args,
            ).data,
          ).metadata,
          { checked: 0, archived: 0, hasMore: false },
        );
      },
    );
    await check(
      "malformed local source mappings fail closed without requesting unrelated reviews",
      async () => {
        for (const invalid of [
          undefined,
          null,
          123,
          "invalid-id",
          "https://unrelated.example/review",
        ]) {
          const f = fixture({
              rows: [localRow(1, { metadata: { qmapsReviewId: invalid } })],
            }),
            calls: FetchCall[] = [];
          assert.deepEqual(
            await reconcileQmapsReviewVisibility(
              clientId,
              listingId,
              f.db,
              visibilityFetch({}, calls),
            ),
            { ok: false, reason: "invalid_listing" },
          );
          assert.equal(calls.length, 0);
          assert.equal(f.transactions(), 0);
          assert.equal(f.writes.length, 0);
        }
      },
    );
    await check(
      "the fetched101st sentinel does not block the valid100-row batch",
      async () => {
        const rows = Array.from({ length: 101 }, (_, index) =>
          localRow(index + 1),
        );
        rows[100].metadata = { qmapsReviewId: "malformed sentinel" };
        const f = fixture({ rows });
        assert.deepEqual(
          await reconcileQmapsReviewVisibility(
            clientId,
            listingId,
            f.db,
            visibilityFetch(),
          ),
          { ok: true, checked: 100, archived: 0, hasMore: true },
        );
        const calls: FetchCall[] = [];
        assert.deepEqual(
          await reconcileQmapsReviewVisibility(
            clientId,
            listingId,
            f.db,
            visibilityFetch({}, calls),
          ),
          { ok: false, reason: "invalid_listing" },
        );
        assert.equal(calls.length, 0);
      },
    );
    await check(
      "legacy duplicate local mappings request one source status and count actual archived rows",
      async () => {
        const f = fixture({
            rows: [
              localRow(1),
              localRow(2, {
                metadata: { qmapsReviewId: sourceId(1), source: "qmaps" },
              }),
            ],
          }),
          calls: FetchCall[] = [];
        assert.deepEqual(
          await reconcileQmapsReviewVisibility(
            clientId,
            listingId,
            f.db,
            visibilityFetch({ unavailable: [sourceId(1)] }, calls),
          ),
          { ok: true, checked: 1, archived: 2, hasMore: false },
        );
        assert.deepEqual(calls[0].body.reviewIds, [sourceId(1)]);
        assert.equal(
          f.writes.filter((write) => write.kind === "review.archive").length,
          2,
        );
      },
    );
    await check(
      "optimistic guard failures report only rows actually archived",
      async () => {
        const f = fixture({
          rows: [localRow(1), localRow(2)],
          changedIds: [localId(1)],
        });
        assert.deepEqual(
          await reconcileQmapsReviewVisibility(
            clientId,
            listingId,
            f.db,
            visibilityFetch({ unavailable: [sourceId(1), sourceId(2)] }),
          ),
          { ok: true, checked: 2, archived: 1, hasMore: false },
        );
        assert.equal(f.rows.get(localId(1))?.status, "needs_review");
        assert.equal(f.rows.get(localId(2))?.status, "archived");
        assert.deepEqual(
          object(
            object(
              f.writes.find((write) => write.kind === "audit.create")?.args,
            ).data,
          ).metadata,
          { checked: 2, archived: 1, hasMore: false },
        );
      },
    );
    await check(
      "visibility audits store counts and scope without review IDs or private content",
      async () => {
        const f = fixture();
        await reconcileQmapsReviewVisibility(
          clientId,
          listingId,
          f.db,
          visibilityFetch({ unavailable: [sourceId(1)] }),
        );
        const audit = object(
          object(f.writes.find((write) => write.kind === "audit.create")?.args)
            .data,
        );
        assert.equal(audit.clientId, clientId);
        assert.equal(audit.entityId, listingId);
        assert.equal(audit.action, "reputation.qmaps.visibility");
        assert.deepEqual(audit.metadata, {
          checked: 1,
          archived: 1,
          hasMore: false,
        });
        for (const forbidden of [
          sourceId(1),
          "Synthetic private local review body",
          process.env.QMAPS_INTEGRATION_SECRET!,
          "ownerReply",
          "userId",
        ])
          assert.equal(JSON.stringify(audit).includes(forbidden), false);
        assert.equal(f.metadata().internalNote, "Keep listing metadata");
      },
    );
    await check(
      "absence from source status coverage never implies a deletion",
      async () => {
        const f = fixture({ rows: [localRow(1), localRow(2)] });
        assert.deepEqual(
          await reconcileQmapsReviewVisibility(
            clientId,
            listingId,
            f.db,
            visibilityFetch({
              payload: envelope([{ id: sourceId(1), visible: true }]),
            }),
          ),
          { ok: false, reason: "invalid_response" },
        );
        assert.equal(f.rows.get(localId(1))?.status, "needs_review");
        assert.equal(f.rows.get(localId(2))?.status, "needs_review");
        assert.equal(f.writes.length, 0);
      },
    );
    await check(
      "invalid tenant or listing IDs reject before any database or network access",
      async () => {
        const f = fixture(),
          calls: FetchCall[] = [];
        assert.deepEqual(
          await reconcileQmapsReviewVisibility(
            "invalid",
            listingId,
            f.db,
            visibilityFetch({}, calls),
          ),
          { ok: false, reason: "invalid_listing" },
        );
        assert.deepEqual(
          await reconcileQmapsReviewVisibility(
            clientId,
            "invalid",
            f.db,
            visibilityFetch({}, calls),
          ),
          { ok: false, reason: "invalid_listing" },
        );
        assert.equal(f.listingReads.length, 0);
        assert.equal(calls.length, 0);
        assert.equal(f.writes.length, 0);
      },
    );
    console.log(
      `QMAPS review visibility: ${count} checks passed; no live source or database operations.`,
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
