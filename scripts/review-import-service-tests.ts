import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { importReviewedReviews } from "../src/lib/reputation/import-service";
import { stableReviewImportId } from "../src/lib/reputation/import-id";

const tenant = "11111111-1111-4111-8111-111111111111";
const actor = "22222222-2222-4222-8222-222222222222";
const listingId = "33333333-3333-4333-8333-333333333333";
const brandId = "44444444-4444-4444-8444-444444444444";
const otherTenant = "55555555-5555-4555-8555-555555555555";
const otherListing = "66666666-6666-4666-8666-666666666666";
const reviewedAt = "2026-01-01T12:00:00.000Z";
const input = () => ({
  listingId,
  provenance: "email",
  rows: [
    {
      source: "google",
      externalId: "synthetic-google-1",
      author: "Synthetic reviewer",
      text: "A fictional experience for a local test.",
      rating: 4,
      reviewedAt,
      url: "https://www.google.com/maps/reviews/test",
    },
    {
      source: "yelp",
      externalId: "synthetic-yelp-2",
      author: null,
      text: "Another fictional experience.",
      rating: 2,
      reviewedAt,
      url: "https://www.yelp.ca/biz/test",
    },
  ],
});
type StoredReview = {
  id: string;
  clientId: string;
  businessBrandId: string | null;
  localListingId: string;
  provider: string;
  reviewerName: string | null;
  rating: number | null;
  body: string;
  reviewedAt: Date;
  status: string;
  replyStatus: string;
  metadata: Record<string, unknown>;
};
type Audit = {
  data: {
    clientId: string;
    profileId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  };
};
function fixture(
  options: {
    missing?: boolean;
    insertError?: boolean;
    auditError?: boolean;
    brand?: string | null;
  } = {},
) {
  let transactionCalls = 0,
    inTransaction = false;
  const lookups: unknown[] = [],
    inserts: Array<{ data: StoredReview[]; skipDuplicates: boolean }> = [],
    audits: Audit[] = [];
  const ids = new Set<string>();
  const tx = {
    localListing: {
      findFirst: async (args: unknown) => {
        assert.equal(inTransaction, true);
        lookups.push(args);
        return options.missing
          ? null
          : {
              id: listingId,
              businessBrandId:
                options.brand === undefined ? brandId : options.brand,
            };
      },
    },
    listingReview: {
      createMany: async (args: {
        data: StoredReview[];
        skipDuplicates: boolean;
      }) => {
        assert.equal(inTransaction, true);
        inserts.push(args);
        if (options.insertError) throw new Error("synthetic_insert_failure");
        let count = 0;
        for (const row of args.data) {
          if (!ids.has(row.id)) {
            ids.add(row.id);
            count++;
          }
        }
        return { count };
      },
    },
    auditLog: {
      create: async (args: Audit) => {
        assert.equal(inTransaction, true);
        audits.push(args);
        if (options.auditError) throw new Error("synthetic_audit_failure");
        return { id: "synthetic-audit" };
      },
    },
  };
  const database = {
    $transaction: async (run: (database: typeof tx) => Promise<unknown>) => {
      transactionCalls++;
      assert.equal(inTransaction, false);
      inTransaction = true;
      try {
        return await run(tx);
      } finally {
        inTransaction = false;
      }
    },
  } as unknown as PrismaClient;
  return {
    database,
    lookups,
    inserts,
    audits,
    get transactionCalls() {
      return transactionCalls;
    },
  };
}
let count = 0;
async function check(name: string, run: () => unknown | Promise<unknown>) {
  await run();
  count++;
  console.log("PASS", name);
}
async function main() {
  const oldFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    throw new Error(
      "Imports must never fetch an evidence link or provider API.",
    );
  };
  try {
    await check(
      "imports recheck tenant, related brand ownership and active real listing inside the write transaction",
      async () => {
        const db = fixture();
        assert.deepEqual(
          await importReviewedReviews(tenant, actor, input(), db.database),
          { ok: true, created: 2, skipped: 0 },
        );
        assert.equal(db.transactionCalls, 1);
        assert.deepEqual(db.lookups, [
          {
            where: {
              id: listingId,
              clientId: tenant,
              status: { notIn: ["archived", "planned"] },
              provider: { not: "internal_demo" },
              OR: [
                { businessBrandId: null },
                { businessBrand: { clientId: tenant } },
              ],
            },
            select: { id: true, businessBrandId: true },
          },
        ]);
        assert.equal(db.inserts[0].skipDuplicates, true);
        for (const row of db.inserts[0].data) {
          assert.equal(row.clientId, tenant);
          assert.equal(row.localListingId, listingId);
          assert.equal(row.businessBrandId, brandId);
        }
      },
    );
    await check(
      "a foreign, archived, demo or foreign-brand listing returned as absent causes no writes",
      async () => {
        const db = fixture({ missing: true });
        const result = await importReviewedReviews(
          tenant,
          actor,
          input(),
          db.database,
        );
        assert.equal(result.ok, false);
        assert.equal(db.lookups.length, 1);
        assert.equal(db.inserts.length, 0);
        assert.equal(db.audits.length, 0);
      },
    );
    await check(
      "retries use stable tenant/listing/source IDs and accurately count skipped duplicates",
      async () => {
        const db = fixture();
        assert.deepEqual(
          await importReviewedReviews(tenant, actor, input(), db.database),
          { ok: true, created: 2, skipped: 0 },
        );
        assert.deepEqual(
          await importReviewedReviews(tenant, actor, input(), db.database),
          { ok: true, created: 0, skipped: 2 },
        );
        assert.deepEqual(
          db.inserts[0].data.map((row) => row.id),
          db.inserts[1].data.map((row) => row.id),
        );
        assert.equal(
          db.inserts[0].data[0].id,
          stableReviewImportId(
            tenant,
            listingId,
            "google",
            "synthetic-google-1",
          ),
        );
        assert.notEqual(
          db.inserts[0].data[0].id,
          stableReviewImportId(
            otherTenant,
            listingId,
            "google",
            "synthetic-google-1",
          ),
        );
        assert.notEqual(
          db.inserts[0].data[0].id,
          stableReviewImportId(
            tenant,
            otherListing,
            "google",
            "synthetic-google-1",
          ),
        );
        assert.deepEqual(db.audits[1].data.metadata, {
          provenance: "email",
          submitted: 2,
          created: 0,
          skipped: 2,
        });
      },
    );
    await check(
      "one new row in a duplicate retry reports partial created/skipped counts",
      async () => {
        const db = fixture();
        await importReviewedReviews(tenant, actor, input(), db.database);
        const next = input();
        next.rows[1].externalId = "synthetic-yelp-3";
        assert.deepEqual(
          await importReviewedReviews(tenant, actor, next, db.database),
          { ok: true, created: 1, skipped: 1 },
        );
        assert.deepEqual(db.audits[1].data.metadata, {
          provenance: "email",
          submitted: 2,
          created: 1,
          skipped: 1,
        });
      },
    );
    await check(
      "reviewed email fields stay unverified and cannot become published replies or live rating evidence",
      async () => {
        const db = fixture();
        await importReviewedReviews(tenant, actor, input(), db.database);
        const row = db.inserts[0].data[0];
        assert.equal(row.provider, "future_provider");
        assert.equal(row.status, "needs_review");
        assert.equal(row.replyStatus, "not_replied");
        assert.equal(row.reviewedAt.toISOString(), reviewedAt);
        assert.deepEqual(row.metadata, {
          reputationProvider: "google",
          source: "reviewed_import",
          ingestion: "email",
          externalId: "synthetic-google-1",
          sourceUrl: "https://www.google.com/maps/reviews/test",
          importedBy: actor,
          recommended: false,
          sourceVerified: false,
        });
        for (const key of [
          "providerReplyConfirmed",
          "replyText",
          "replyState",
          "publishConsent",
          "verified",
          "emailBody",
          "headers",
          "attachments",
        ])
          assert.equal(Object.hasOwn(row.metadata, key), false);
      },
    );
    await check(
      "audit contains workspace/actor/listing and counts without review text or contact information",
      async () => {
        const db = fixture();
        await importReviewedReviews(tenant, actor, input(), db.database);
        assert.deepEqual(db.audits, [
          {
            data: {
              clientId: tenant,
              profileId: actor,
              action: "reputation.import.reviewed",
              entityType: "local_listing",
              entityId: listingId,
              metadata: {
                provenance: "email",
                submitted: 2,
                created: 2,
                skipped: 0,
              },
            },
          },
        ]);
        const serialized = JSON.stringify(db.audits);
        assert.equal(serialized.includes(input().rows[0].text), false);
        assert.equal(serialized.includes("Synthetic reviewer"), false);
      },
    );
    await check(
      "malformed input and attempts to attach email body or provider status fail before database access",
      async () => {
        for (const candidate of [
          null,
          { ...input(), emailBody: "not allowed" },
          { ...input(), rows: [{ ...input().rows[0], sourceVerified: true }] },
          { ...input(), rows: [] },
        ]) {
          const db = fixture();
          const result = await importReviewedReviews(
            tenant,
            actor,
            candidate,
            db.database,
          );
          assert.equal(result.ok, false);
          assert.equal(db.transactionCalls, 0);
          assert.equal(db.lookups.length, 0);
          assert.equal(db.inserts.length, 0);
        }
      },
    );
    await check(
      "invalid workspace and actor identifiers reject before parsing or accessing the database",
      async () => {
        for (const [workspace, profile] of [
          ["invalid", actor],
          [tenant, "invalid"],
          [tenant, ""],
          ["", actor],
        ]) {
          const db = fixture();
          await assert.rejects(
            importReviewedReviews(workspace, profile, null, db.database),
            /invalid_workspace/,
          );
          assert.equal(db.transactionCalls, 0);
        }
      },
    );
    await check(
      "valid listings without a brand remain importable without fabricating a brand relationship",
      async () => {
        const db = fixture({ brand: null });
        assert.deepEqual(
          await importReviewedReviews(tenant, actor, input(), db.database),
          { ok: true, created: 2, skipped: 0 },
        );
        assert.equal(db.inserts[0].data[0].businessBrandId, null);
      },
    );
    await check(
      "insert and audit failures propagate rather than reporting a successful import",
      async () => {
        const failedInsert = fixture({ insertError: true });
        await assert.rejects(
          importReviewedReviews(tenant, actor, input(), failedInsert.database),
          /synthetic_insert_failure/,
        );
        assert.equal(failedInsert.audits.length, 0);
        const failedAudit = fixture({ auditError: true });
        await assert.rejects(
          importReviewedReviews(tenant, actor, input(), failedAudit.database),
          /synthetic_audit_failure/,
        );
        assert.equal(failedAudit.transactionCalls, 1);
      },
    );
    assert.equal(fetchCalls, 0);
    console.log(
      `Review import service: ${count} checks passed; no network calls.`,
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
