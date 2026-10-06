// QMAPS → TAKATAK listings/reviews sync — signature, parser and in-memory
// apply checks (no network, no database). Run: npm run qa:qmaps-sync
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  applyQmapsEvent,
  QmapsEventConflictError,
  sentimentForRating,
  type QmapsApplyDb,
} from "../src/lib/integrations/qmaps/apply-event";
import { parseQmapsEvent, type QmapsEvent } from "../src/lib/integrations/qmaps/parser";
import { signQmapsBody, verifyQmapsRequest } from "../src/lib/integrations/qmaps/signature";

const SECRET = "qmaps-test-secret-abcdefghijklmnopqrstuvwxyz0123";
const ENV = {
  QMAPS_SYNC_ENABLED: "true",
  QMAPS_SYNC_CLIENT_ID: "qmaps-production",
  QMAPS_SYNC_WEBHOOK_SECRET: SECRET,
};
const BUSINESS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_BUSINESS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REVIEW = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLIENT = "11111111-1111-4111-8111-111111111111";

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

let eventCounter = 0;
function eventId(): string {
  eventCounter += 1;
  return `dddddddd-dddd-4ddd-8ddd-${String(eventCounter).padStart(12, "0")}`;
}

function businessEvent(overrides: Record<string, unknown> = {}, business: Record<string, unknown> = {}) {
  return {
    eventId: eventId(),
    eventType: "BUSINESS_UPSERTED",
    sourceApplication: "QMAPS",
    schemaVersion: 1,
    occurredAt: "2026-10-06T12:00:00Z",
    business: {
      id: BUSINESS, name: "Boulangerie Exemple", category: "Boulangerie",
      phone: "+1 514 555 0100", website: "https://example.test", address: "1 rue Exemple",
      city: "Montréal", region: "QC", postalCode: "H2X 1Y1", country: "CA",
      avgRating: 4.5, reviewsCount: 12, isActive: true, isClaimed: true,
      ...business,
    },
    ...overrides,
  };
}

function reviewEvent(eventType = "REVIEW_UPSERTED", review: Record<string, unknown> = {}) {
  return {
    eventId: eventId(),
    eventType,
    sourceApplication: "QMAPS",
    schemaVersion: 1,
    occurredAt: "2026-10-06T12:00:00Z",
    review: {
      id: REVIEW, businessId: BUSINESS, rating: 2, body: "Service lent.",
      reviewerDisplayName: "Marie T.", createdAt: "2026-10-05T18:30:00Z",
      ...review,
    },
  };
}

function parsed(body: unknown): { event: QmapsEvent; raw: string } {
  const raw = JSON.stringify(body);
  const result = parseQmapsEvent(raw);
  assert.ok(result.valid, result.valid ? "" : result.error);
  if (!result.valid) throw new Error("unreachable");
  return { event: result.event, raw };
}

type Row = Record<string, unknown> & { id: string };

function fakeDb(linked: boolean) {
  const listings: Row[] = linked
    ? [{ id: "listing-1", clientId: CLIENT, businessBrandId: null, provider: "qmaps", externalId: BUSINESS, metadata: { note: "linked" } }]
    : [];
  const reviews: Row[] = [];
  const events: Row[] = [];
  let seq = 0;

  const tx = {
    localListing: {
      async findUnique({ where }: { where: { provider_externalId: { provider: string; externalId: string } } }) {
        const key = where.provider_externalId;
        return listings.find((l) => l.provider === key.provider && l.externalId === key.externalId) ?? null;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const row = listings.find((l) => l.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    listingReview: {
      async upsert({ where, create, update }: { where: { provider_externalId: { provider: string; externalId: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) {
        const key = where.provider_externalId;
        const existing = reviews.find((r) => r.provider === key.provider && r.externalId === key.externalId);
        if (existing) {
          Object.assign(existing, update);
          return { id: existing.id, clientId: existing.clientId };
        }
        const row = { ...create, id: `review-${++seq}` } as Row;
        reviews.push(row);
        return { id: row.id, clientId: row.clientId };
      },
      async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        let count = 0;
        for (const r of reviews) {
          if (Object.entries(where).every(([k, v]) => r[k] === v)) {
            Object.assign(r, data);
            count += 1;
          }
        }
        return { count };
      },
    },
    sourceSynchronizationEvent: {
      async findUnique({ where }: { where: { eventId: string } }) {
        return events.find((e) => e.eventId === where.eventId) ?? null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row = { ...data, id: `event-${++seq}` } as Row;
        events.push(row);
        return row;
      },
    },
  };

  const db = {
    sourceSynchronizationEvent: tx.sourceSynchronizationEvent,
    async $transaction<T>(fn: (t: typeof tx) => Promise<T>) {
      return fn(tx);
    },
  } as unknown as QmapsApplyDb;

  return { db, listings, reviews, events };
}

async function main() {
  console.log("QMAPS sync checks");

  await check("signature accepts a fresh, correctly signed request", () => {
    const raw = JSON.stringify(businessEvent());
    const now = Date.UTC(2026, 9, 6, 12);
    const ts = String(Math.floor(now / 1000));
    const id = JSON.parse(raw).eventId;
    const headers = new Headers({
      "x-integration-id": "qmaps-production", "x-event-id": id, "x-timestamp": ts,
      "x-signature": `sha256=${signQmapsBody(SECRET, ts, id, raw)}`,
    });
    assert.deepEqual(verifyQmapsRequest(raw, headers, now, ENV), { valid: true, eventId: id });
  });

  await check("signature rejects disabled, unconfigured, forged, stale and tampered requests", () => {
    const raw = JSON.stringify(businessEvent());
    const now = Date.UTC(2026, 9, 6, 12);
    const ts = String(Math.floor(now / 1000));
    const id = JSON.parse(raw).eventId;
    const good = signQmapsBody(SECRET, ts, id, raw);
    const headers = (o: Record<string, string> = {}) => new Headers({
      "x-integration-id": "qmaps-production", "x-event-id": id, "x-timestamp": ts, "x-signature": good, ...o,
    });
    assert.equal(verifyQmapsRequest(raw, headers(), now, {}).valid, false);
    assert.equal(verifyQmapsRequest(raw, headers(), now, { ...ENV, QMAPS_SYNC_WEBHOOK_SECRET: "short" }).valid, false);
    for (const [label, h, body] of [
      ["wrong integration id", headers({ "x-integration-id": "rentauto" }), raw],
      ["missing event id", headers({ "x-event-id": "" }), raw],
      ["wrong secret", headers({ "x-signature": signQmapsBody(SECRET + "x", ts, id, raw) }), raw],
      ["stale timestamp", headers({ "x-timestamp": String(Number(ts) - 600) }), raw],
      ["tampered body", headers(), raw.replace("Boulangerie", "Boulangeri3")],
    ] as const) {
      const result = verifyQmapsRequest(body, h, now, ENV);
      assert.equal(result.valid, false, label);
      if (!result.valid) assert.equal(result.status, 401, label);
    }
  });

  await check("parser accepts the three v1 event types", () => {
    assert.equal(parsed(businessEvent()).event.eventType, "BUSINESS_UPSERTED");
    assert.equal(parsed(reviewEvent()).event.eventType, "REVIEW_UPSERTED");
    assert.equal(parsed(reviewEvent("REVIEW_DELETED")).event.eventType, "REVIEW_DELETED");
  });

  await check("parser rejects malformed or identity-leaking payloads", () => {
    const bad: unknown[] = [
      "not json",
      { ...businessEvent(), sourceApplication: "RENTAUTO" },
      { ...businessEvent(), schemaVersion: 2 },
      { ...businessEvent(), eventId: "not-a-uuid" },
      { ...businessEvent(), eventType: "BUSINESS_DELETED_EVERYTHING" },
      businessEvent({}, { avgRating: 7 }),
      businessEvent({}, { reviewsCount: -1 }),
      businessEvent({}, { name: "" }),
      businessEvent({}, { isActive: "yes" }),
      businessEvent({}, { owner_user_id: BUSINESS }),
      reviewEvent("REVIEW_UPSERTED", { rating: 6 }),
      reviewEvent("REVIEW_UPSERTED", { rating: 4.5 }),
      reviewEvent("REVIEW_UPSERTED", { user_id: BUSINESS }),
      reviewEvent("REVIEW_UPSERTED", { reviewerEmail: "a@example.test" }),
      reviewEvent("REVIEW_UPSERTED", { body: "x".repeat(5001) }),
      { ...reviewEvent(), access_token: "secret" },
    ];
    for (const body of bad) {
      const raw = typeof body === "string" ? body : JSON.stringify(body);
      assert.equal(parseQmapsEvent(raw).valid, false, raw.slice(0, 90));
    }
  });

  await check("rating maps to sentiment", () => {
    assert.equal(sentimentForRating(5), "positive");
    assert.equal(sentimentForRating(4), "positive");
    assert.equal(sentimentForRating(3), "neutral");
    assert.equal(sentimentForRating(2), "negative");
    assert.equal(sentimentForRating(1), "negative");
  });

  await check("events for an unlinked business change nothing", async () => {
    const fake = fakeDb(false);
    for (const body of [businessEvent(), reviewEvent()]) {
      const { event, raw } = parsed(body);
      const result = await applyQmapsEvent(fake.db, event, raw);
      assert.equal(result.status, "UNLINKED");
    }
    assert.equal(fake.reviews.length, 0);
    assert.equal(fake.events.length, 2);
    assert.ok(fake.events.every((e) => e.status === "UNLINKED"));
  });

  await check("business event refreshes the linked listing and keeps its metadata", async () => {
    const fake = fakeDb(true);
    const { event, raw } = parsed(businessEvent());
    const result = await applyQmapsEvent(fake.db, event, raw, new Date("2026-10-06T12:00:00Z"));
    assert.equal(result.status, "PROCESSED");
    const listing = fake.listings[0];
    assert.equal(listing.name, "Boulangerie Exemple");
    assert.equal(listing.city, "Montréal");
    assert.equal(listing.country, "Canada");
    assert.equal(listing.status, "active_internal");
    const metadata = listing.metadata as Record<string, Record<string, unknown>>;
    assert.equal(metadata.note as unknown, "linked");
    assert.equal(metadata.qmaps.avgRating, 4.5);
    assert.equal(metadata.qmaps.reviewsCount, 12);
    const inactive = parsed(businessEvent({}, { isActive: false }));
    await applyQmapsEvent(fake.db, inactive.event, inactive.raw);
    assert.equal(listing.status, "archived");
  });

  await check("review events upsert into the listing's workspace and archive on delete", async () => {
    const fake = fakeDb(true);
    const first = parsed(reviewEvent());
    await applyQmapsEvent(fake.db, first.event, first.raw);
    assert.equal(fake.reviews.length, 1);
    const review = fake.reviews[0];
    assert.equal(review.clientId, CLIENT);
    assert.equal(review.localListingId, "listing-1");
    assert.equal(review.provider, "qmaps");
    assert.equal(review.sentiment, "negative");
    assert.equal(review.status, "needs_review");
    assert.equal(review.reviewerName, "Marie T.");

    const edited = parsed(reviewEvent("REVIEW_UPSERTED", { rating: 5, body: "Finalement excellent." }));
    await applyQmapsEvent(fake.db, edited.event, edited.raw);
    assert.equal(fake.reviews.length, 1);
    assert.equal(review.rating, 5);
    assert.equal(review.sentiment, "positive");

    const deleted = parsed(reviewEvent("REVIEW_DELETED"));
    await applyQmapsEvent(fake.db, deleted.event, deleted.raw);
    assert.equal(review.status, "archived");
  });

  await check("review for another business is not applied to this workspace", async () => {
    const fake = fakeDb(true);
    const other = parsed(reviewEvent("REVIEW_UPSERTED", { businessId: OTHER_BUSINESS }));
    const result = await applyQmapsEvent(fake.db, other.event, other.raw);
    assert.equal(result.status, "UNLINKED");
    assert.equal(fake.reviews.length, 0);
  });

  await check("replays are idempotent; reused ids with new payloads conflict", async () => {
    const fake = fakeDb(true);
    const body = reviewEvent();
    const first = parsed(body);
    const a = await applyQmapsEvent(fake.db, first.event, first.raw);
    const b = await applyQmapsEvent(fake.db, first.event, first.raw);
    assert.equal(a.duplicate, false);
    assert.equal(b.duplicate, true);
    assert.equal(b.reviewId, a.reviewId);
    assert.equal(fake.events.length, 1);
    const tampered = parsed({ ...body, review: { ...body.review, rating: 1 } });
    await assert.rejects(applyQmapsEvent(fake.db, tampered.event, tampered.raw), QmapsEventConflictError);
  });

  await check("review text is not copied into the synchronization log", async () => {
    const fake = fakeDb(true);
    const { event, raw } = parsed(reviewEvent());
    await applyQmapsEvent(fake.db, event, raw);
    const stored = JSON.stringify(fake.events[0].payload);
    assert.doesNotMatch(stored, /Service lent|Marie/);
    assert.equal(fake.events[0].payloadHash, createHash("sha256").update(raw).digest("hex"));
  });

  await check("route verifies before parsing and bounds the body", () => {
    const route = readFileSync("src/app/api/integrations/qmaps/events/route.ts", "utf8");
    const verifyAt = route.indexOf("verifyQmapsRequest(rawBody");
    const parseAt = route.indexOf("parseQmapsEvent(rawBody)");
    assert.ok(verifyAt > 0 && parseAt > verifyAt);
    assert.match(route, /MAXIMUM_BODY_BYTES = 64_000/);
    assert.match(route, /Event ID header and body do not match/);
  });

  console.log(`\n${passed} QMAPS sync checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
