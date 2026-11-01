import assert from "node:assert/strict";
import {
  readCockpit,
  normalizeFeedback,
  normalizeExternal,
  normalizeListing,
  cockpitStats,
  filterCockpit,
  cockpitCSV,
  cockpitPage,
  sourceLocationKey,
  sourceLocationGroups,
  type CockpitReaders,
  type ListingRow,
} from "../src/lib/reputation/cockpit-model";
import { REVIEW_SOURCES, observedSource } from "../src/lib/reputation/sources";
import { getReviewCockpit } from "../src/lib/reputation/cockpit";
import { postQmaps } from "../src/lib/qmaps/remote";
import { matchesTrackedQmapsReview } from "../src/lib/qmaps/bridge";
const tenant = "11111111-1111-4111-8111-111111111111";
const reviewId = "22222222-2222-4222-8222-222222222222";
const date = new Date("2026-10-31T12:00:00.000Z");
const listing: ListingRow = {
  id: reviewId,
  provider: "qmaps",
  reviewerName: "Synthetic reviewer",
  rating: 4,
  title: null,
  body: "A fictional test experience.",
  status: "needs_review",
  replyStatus: "draft_reply",
  reviewedAt: date,
  createdAt: date,
  metadata: {
    source: "qmaps",
    qmapsReviewId: reviewId,
    replyState: "not_sent",
    replyText: "Unpublished draft",
    privateEmail: "must-not-leak@example.com",
  },
  localListing: { name: "Test location" },
};
let count = 0;
async function check(name: string, run: () => unknown | Promise<unknown>) {
  await run();
  count++;
  console.log("PASS", name);
}
const empty = (): CockpitReaders => ({
  feedback: async () => [],
  external: async () => [],
  listing: async () => [],
});

async function main() {
  await check(
    "all stores receive the canonical workspace and an overflow sentinel limit",
    async () => {
      const calls: Array<[string, number]> = [];
      const readers = empty();
      for (const key of ["feedback", "external", "listing"] as const)
        readers[key] = async (id, n) => {
          calls.push([id, n]);
          return [];
        };
      const data = await readCockpit(tenant, readers);
      assert.equal(data.records.length, 0);
      assert.deepEqual(calls, [
        [tenant, 201],
        [tenant, 201],
        [tenant, 201],
      ]);
      await assert.rejects(readCockpit("", readers), /invalid_workspace/);
      assert.equal(calls.length, 3);
    },
  );
  await check(
    "partial source failure preserves healthy records and reports the failed source",
    async () => {
      const data = await readCockpit(tenant, {
        ...empty(),
        feedback: async () => {
          throw new Error("db down");
        },
        listing: async () => [listing],
      });
      assert.equal(data.records.length, 1);
      assert.deepEqual(data.unavailable, ["feedback"]);
    },
  );
  await check(
    "a window overflow is explicit and never represented as a full export",
    async () => {
      const data = await readCockpit(tenant, {
        ...empty(),
        listing: async () =>
          Array.from({ length: 201 }, (_, i) => ({
            ...listing,
            id: `test-${i}`,
          })),
      });
      assert.equal(data.records.length, 200);
      assert.deepEqual(data.truncated, ["listing"]);
    },
  );
  await check(
    "demo rows are excluded and identical prose is never used to merge unrelated people",
    async () => {
      const data = await readCockpit(tenant, {
        ...empty(),
        listing: async () => [
          listing,
          { ...listing, id: "second" },
          { ...listing, id: "demo", provider: "internal_demo" },
        ],
      });
      assert.equal(data.records.length, 2);
    },
  );
  await check(
    "QMAPS draft and internal status do not count as source publication",
    () => {
      const row = normalizeListing({
        ...listing,
        replyStatus: "replied_internal",
      });
      assert.equal(row.response, null);
      assert.equal(row.state, "needs_reply");
      const confirmed = normalizeListing({
        ...listing,
        metadata: {
          source: "qmaps",
          qmapsReviewId: reviewId,
          replyState: "sent_to_qmaps",
          replyText: "Confirmed reply",
        },
      });
      assert.equal(confirmed.response, "Confirmed reply");
      assert.equal(confirmed.state, "answered");
      assert.equal("metadata" in confirmed, false);
      assert.equal(JSON.stringify(confirmed).includes("must-not-leak"), false);
    },
  );
  await check(
    "recommendations and social comments never become invented star ratings",
    () => {
      for (const source of ["facebook", "instagram"])
        assert.equal(
          normalizeListing({
            ...listing,
            provider: "future_provider",
            rating: 5,
            metadata: { reputationProvider: source },
          }).rating,
          null,
        );
      assert.equal(observedSource("unknown"), "other");
      assert.equal(observedSource("google_business"), "google");
    },
  );
  await check(
    "source-excluded reviews are visible but excluded from rating statistics",
    () => {
      const rows = [
        normalizeListing(listing),
        normalizeListing({
          ...listing,
          id: "excluded",
          rating: 1,
          metadata: { recommended: false },
        }),
      ];
      assert.equal(rows.length, 2);
      const stats = cockpitStats(rows);
      assert.equal(stats.total, 1);
      assert.equal(stats.average, 4);
    },
  );
  await check(
    "first-party contact information and operational metadata are not in the cockpit projection",
    () => {
      const row = normalizeFeedback({
        id: reviewId,
        rating: 2,
        feedback: "Needs improvement",
        contactName: "Synthetic customer",
        status: "new",
        createdAt: date,
        profile: { name: "Test profile" },
      });
      assert.equal(row.state, "follow_up");
      assert.equal(row.canDraft, true);
      assert.equal("contactEmail" in row, false);
      assert.equal("contactPhone" in row, false);
    },
  );
  await check(
    "external source mapping and reply rate use explicit publication state",
    () => {
      const row = normalizeExternal({
        id: reviewId,
        source: "google",
        reviewerName: "Test",
        rating: 5,
        comment: "Test",
        externalCreateAt: date,
        replyComment: "Published answer",
        location: { title: "Test" },
      });
      assert.equal(row.state, "answered");
      assert.equal(row.canDraft, true);
      const stats = cockpitStats([row, normalizeListing(listing)]);
      assert.equal(stats.responseRate, 50);
      assert.equal(stats.unanswered, 1);
    },
  );
  await check(
    "source, state, rating, text and date filters compose without data mutation",
    () => {
      const rows = [
        normalizeListing(listing),
        normalizeListing({
          ...listing,
          id: "old",
          rating: 1,
          reviewedAt: new Date("2020-01-01"),
        }),
      ];
      assert.equal(
        filterCockpit(
          rows,
          { source: "qmaps", query: "fictional", rating: 4, days: 30 },
          date.getTime(),
        ).length,
        1,
      );
      assert.equal(filterCockpit(rows, { state: "answered" }).length, 0);
      assert.equal(rows.length, 2);
    },
  );
  await check(
    "CSV escapes formula prefixes, quotes and embedded newlines",
    () => {
      const output = cockpitCSV([
        {
          ...normalizeListing(listing),
          author: ' =IMPORTXML("example")',
          text: 'a,"b"\nc',
        },
      ]);
      assert.match(output, /"' =IMPORTXML\(""example""\)"/);
      assert.match(output, /"a,""b""\nc"/);
      assert.equal(output.includes("must-not-leak"), false);
    },
  );
  await check(
    "tracked QMAPS reply target cannot be changed to an arbitrary source review",
    () => {
      assert.equal(
        matchesTrackedQmapsReview(
          { source: "qmaps", qmapsReviewId: reviewId },
          reviewId,
        ),
        true,
      );
      assert.equal(matchesTrackedQmapsReview({}, reviewId), false);
      assert.equal(
        matchesTrackedQmapsReview({ qmapsReviewId: tenant }, reviewId),
        false,
      );
      assert.equal(
        matchesTrackedQmapsReview({ qmapsReviewId: "bad" }, "bad"),
        false,
      );
    },
  );
  await check(
    "provider catalog has distinct capabilities and only fixed HTTPS documentation/module links",
    () => {
      assert.equal(
        new Set(REVIEW_SOURCES.map((s) => s.id)).size,
        REVIEW_SOURCES.length,
      );
      for (const s of REVIEW_SOURCES) {
        assert.equal(new URL(s.docs).protocol, "https:");
        assert.ok(s.route.startsWith("/dashboard/"));
        assert.ok(s.read && s.reply && s.publication);
      }
      assert.equal(
        REVIEW_SOURCES.find((s) => s.id === "instagram")?.kind,
        "social",
      );
      assert.equal(
        REVIEW_SOURCES.find((s) => s.id === "facebook")?.kind,
        "recommendations",
      );
      assert.equal(
        REVIEW_SOURCES.find((s) => s.id === "flexs")?.delivery,
        "counterpart_api",
      );
    },
  );
  await check(
    "real store adapter scopes every table and related record to the canonical tenant",
    async () => {
      const queries: Array<Record<string, unknown>> = [];
      const delegate = {
        findMany: async (args: Record<string, unknown>) => {
          queries.push(args);
          return [];
        },
      };
      const database = {
        reviewResponse: delegate,
        externalReview: delegate,
        listingReview: delegate,
      } as unknown as NonNullable<Parameters<typeof getReviewCockpit>[1]>;
      await getReviewCockpit(tenant, database);
      assert.equal(queries.length, 3);
      for (const q of queries)
        assert.equal((q.where as Record<string, unknown>).clientId, tenant);
      assert.deepEqual((queries[0].where as Record<string, unknown>).profile, {
        clientId: tenant,
      });
      assert.deepEqual((queries[1].where as Record<string, unknown>).location, {
        clientId: tenant,
      });
      assert.ok(JSON.stringify(queries[2].where).includes("internal_demo"));
      assert.ok(JSON.stringify(queries[2].where).includes("archived"));
      assert.equal(JSON.stringify(queries).includes("contactEmail"), false);
    },
  );
  await check(
    "QMAPS publication requires explicit matching acknowledgement and credentials never follow redirects",
    async () => {
      const oldBase = process.env.QMAPS_FUNCTIONS_BASE_URL,
        oldSecret = process.env.QMAPS_INTEGRATION_SECRET;
      try {
        process.env.QMAPS_FUNCTIONS_BASE_URL =
          "https://qmaps.example/functions/v1";
        process.env.QMAPS_INTEGRATION_SECRET = "test-only-key-".repeat(4);
        let calls = 0;
        const fake =
          (reply: unknown) =>
          async (_url: RequestInfo | URL, init?: RequestInit) => {
            calls++;
            assert.equal(init?.redirect, "error");
            return new Response(JSON.stringify(reply), { status: 200 });
          };
        const body = { reviewId, body: "Synthetic response" };
        assert.equal(
          (await postQmaps("takatak-reply-review", body, fake({ ok: false })))
            .ok,
          false,
        );
        assert.equal(
          (
            await postQmaps(
              "takatak-reply-review",
              body,
              fake({ ok: true, reviewId: tenant }),
            )
          ).ok,
          false,
        );
        assert.equal(
          (
            await postQmaps(
              "takatak-reply-review",
              body,
              fake({ ok: true, reviewId }),
            )
          ).ok,
          true,
        );
        process.env.QMAPS_FUNCTIONS_BASE_URL = "http://qmaps.example";
        assert.equal(
          (
            await postQmaps(
              "takatak-reply-review",
              body,
              fake({ ok: true, reviewId }),
            )
          ).ok,
          false,
        );
        assert.equal(calls, 3);
      } finally {
        if (oldBase === undefined) delete process.env.QMAPS_FUNCTIONS_BASE_URL;
        else process.env.QMAPS_FUNCTIONS_BASE_URL = oldBase;
        if (oldSecret === undefined)
          delete process.env.QMAPS_INTEGRATION_SECRET;
        else process.env.QMAPS_INTEGRATION_SECRET = oldSecret;
      }
    },
  );
  await check(
    "exact location filters compose with source and apply equally to export records",
    () => {
      const base = normalizeListing(listing);
      const records = [
        { ...base, key: "one", location: "Montreal" },
        { ...base, key: "two", location: "Laval" },
        { ...base, key: "three", location: "Montreal East" },
      ];
      const filtered = filterCockpit(records, {
        location: "Montreal",
        source: base.source,
      });
      assert.deepEqual(
        filtered.map((review) => review.key),
        ["one"],
      );
      assert.equal(filterCockpit(records, { location: "all" }).length, 3);
      assert.equal(filterCockpit(records, { location: "Missing" }).length, 0);
      assert.equal(cockpitCSV(filtered).includes("Laval"), false);
      assert.equal(records.length, 3);
    },
  );
  await check(
    "same-name source locations stay separate by persisted identity",
    () => {
      const first = normalizeListing({
        ...listing,
        localListing: { id: "branch-one", name: "Downtown" },
      });
      const sameBranch = normalizeListing({
        ...listing,
        id: "another-review",
        localListing: { id: "branch-one", name: "Downtown" },
      });
      const second = normalizeListing({
        ...listing,
        id: "second-review",
        localListing: { id: "branch-two", name: "Downtown" },
      });
      const records = [first, sameBranch, second];
      const groups = sourceLocationGroups(records);
      assert.equal(groups.length, 2);
      assert.ok(cockpitCSV(records).includes(`"${first.locationKey}"`));
      assert.ok(cockpitCSV(records).includes(`"${second.locationKey}"`));
      assert.notEqual(groups[0].label, groups[1].label);
      assert.equal(
        groups.find((group) => group.key === first.locationKey)?.records.length,
        2,
      );
      assert.deepEqual(
        filterCockpit(records, { locationKey: first.locationKey }).map(
          (review) => review.id,
        ),
        [first.id, sameBranch.id],
      );
      assert.equal(filterCockpit(records, { locationKey: "all" }).length, 3);
      assert.equal(
        filterCockpit(records, { locationKey: "missing" }).length,
        0,
      );
      assert.equal(filterCockpit(records, { location: "Downtown" }).length, 3);
      assert.equal(
        filterCockpit(records, {
          locationKey: first.locationKey,
          location: "Other",
        }).length,
        0,
      );
    },
  );
  await check(
    "normalization carries provider-scoped IDs and never joins unlinked records by name",
    () => {
      const profile = normalizeFeedback({
        id: "feedback",
        rating: 4,
        feedback: "Good",
        contactName: null,
        status: "new",
        createdAt: date,
        profile: { id: "source-location", name: "Same name" },
      });
      const external = normalizeExternal({
        id: "external",
        source: "google",
        reviewerName: null,
        rating: 4,
        comment: "Good",
        externalCreateAt: date,
        replyComment: null,
        location: { id: "source-location", title: "Same name" },
      });
      const local = normalizeListing({
        ...listing,
        localListing: { id: "source-location", name: "Same name" },
      });
      assert.equal(profile.locationKey, "feedback:takatak:source-location");
      assert.equal(external.locationKey, "external:google:source-location");
      assert.equal(local.locationKey, "listing:qmaps:source-location");
      assert.equal(sourceLocationGroups([profile, external, local]).length, 3);
      const unlinked = [
        normalizeListing({ ...listing, id: "one", localListing: null }),
        normalizeListing({ ...listing, id: "two", localListing: null }),
      ];
      assert.notEqual(
        sourceLocationKey(unlinked[0]),
        sourceLocationKey(unlinked[1]),
      );
      assert.equal(sourceLocationGroups(unlinked).length, 2);
    },
  );
  await check(
    "pagination clamps stale server-refresh pages while preserving valid selection windows",
    () => {
      assert.deepEqual(cockpitPage(30, 2), {
        page: 2,
        totalPages: 3,
        start: 12,
        end: 24,
      });
      assert.deepEqual(cockpitPage(5, 3), {
        page: 1,
        totalPages: 1,
        start: 0,
        end: 12,
      });
      assert.deepEqual(cockpitPage(0, 2), {
        page: 1,
        totalPages: 1,
        start: 0,
        end: 12,
      });
      assert.equal(cockpitPage(25, 3).start, 24);
      assert.equal(cockpitPage(25, -1).page, 1);
      assert.equal(cockpitPage(25, Number.NaN).page, 1);
    },
  );
  await check(
    "reviewed imports expose provenance but never source publication or source-verified averages",
    () => {
      const imported = normalizeListing({
        ...listing,
        provider: "future_provider",
        metadata: {
          source: "reviewed_import",
          reputationProvider: "qmaps",
          ingestion: "email",
          importedBy: "private-profile",
          externalId: "private-id",
          recommended: true,
          providerReplyConfirmed: true,
          replyState: "sent_to_qmaps",
          qmapsReviewId: reviewId,
          replyText: "Not a confirmed reply",
        },
      });
      assert.equal(imported.ingestion, "email");
      assert.equal(imported.source, "qmaps");
      assert.equal(imported.recommended, false);
      assert.equal(imported.response, null);
      assert.equal(imported.state, "tracked");
      assert.equal(imported.qmapsReviewId, null);
      assert.equal(imported.canDraft, false);
      assert.equal(cockpitStats([imported]).rated, 0);
      assert.equal(JSON.stringify(imported).includes("private-profile"), false);
      assert.equal(JSON.stringify(imported).includes("private-id"), false);
      assert.equal(
        normalizeListing({
          ...listing,
          metadata: { ...(listing.metadata as object), ingestion: "email" },
        }).ingestion,
        undefined,
      );
    },
  );
  await check(
    "operator evidence links are source-pinned and private import metadata stays private",
    () => {
      const imported = {
        ...listing,
        provider: "future_provider",
        metadata: {
          reputationProvider: "google",
          source: "reviewed_import",
          ingestion: "email",
          sourceUrl: "https://www.google.com/maps/reviews/example",
          importedBy: "private-actor",
          externalId: "private-source-id",
        },
      };
      const record = normalizeListing(imported);
      assert.equal(
        record.sourceUrl,
        "https://www.google.com/maps/reviews/example",
      );
      assert.equal(JSON.stringify(record).includes("private-actor"), false);
      assert.equal(JSON.stringify(record).includes("private-source-id"), false);
      assert.equal(
        normalizeListing({
          ...imported,
          metadata: {
            ...imported.metadata,
            sourceUrl: "https://evil.example/review",
          },
        }).sourceUrl,
        undefined,
      );
      assert.equal(
        normalizeListing({
          ...imported,
          metadata: { ...imported.metadata, sourceUrl: "javascript:alert(1)" },
        }).sourceUrl,
        undefined,
      );
    },
  );
  await check(
    "unmapped partner score scales never display as five-star ratings",
    () => {
      const record = normalizeListing({
        ...listing,
        provider: "future_provider",
        rating: 4,
        metadata: {
          reputationProvider: "booking",
          source: "reviewed_import",
          ingestion: "csv",
        },
      });
      assert.equal(record.rating, null);
      assert.equal(record.recommended, false);
    },
  );
  console.log(`Review cockpit: ${count} checks passed.`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
