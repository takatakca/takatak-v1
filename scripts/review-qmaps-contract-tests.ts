import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fetchQmapsReviewPage } from "../src/lib/qmaps/reviews-api";
import { postQmaps } from "../src/lib/qmaps/remote";

async function main() {
  const checkout = process.env.REVEW_QMAPS_CHECKOUT;
  if (!checkout)
    throw new Error(
      "Set REVEW_QMAPS_CHECKOUT to the pinned QMAPS checkout; this contract test must not silently skip.",
    );
  const { createReviewFeedHandler, createReviewReplyHandler } = await import(
    pathToFileURL(
      join(checkout, "supabase/functions/_shared/takatak-reviews.ts"),
    ).href
  );
  const { integrationAuthorized } = await import(
    pathToFileURL(join(checkout, "supabase/functions/_shared/takatak-auth.ts"))
      .href
  );
  const clientId = "11111111-1111-4111-8111-111111111111",
    businessId = "22222222-2222-4222-8222-222222222222",
    otherId = "33333333-3333-4333-8333-333333333333";
  const secret = "synthetic-contract-secret-not-production-12345";
  const previousBase = process.env.QMAPS_FUNCTIONS_BASE_URL,
    previousSecret = process.env.QMAPS_INTEGRATION_SECRET;
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env: { get: (key: string) => string | undefined } };
  };
  const previousDeno = runtime.Deno;
  const reviews = Array.from({ length: 26 }, (_, index) => ({
    id: `44444444-4444-4444-8444-${String(index + 1).padStart(12, "0")}`,
    businessId,
    author: "QMAPS customer",
    rating: 4,
    body: `Synthetic contract review ${index}`,
    createdAt: new Date(
      Date.parse("2026-01-01T12:00:00Z") - index * 1000,
    ).toISOString(),
    updatedAt: "2026-01-02T12:00:00.000Z",
    ownerReply: null as string | null,
    ownerRepliedAt: null as string | null,
  }));
  let writes = 0,
    calls = 0;
  const store = {
    linkedBusiness: async (client: string, business: string) =>
      client === clientId && business === businessId,
    reviews: async (
      business: string,
      take: number,
      cursor: { id: string } | null,
    ) => {
      assert.equal(business, businessId);
      const start = cursor
        ? reviews.findIndex((row) => row.id === cursor.id) + 1
        : 0;
      return reviews.slice(start, start + take);
    },
    reply: async (business: string, id: string, body: string, now: string) => {
      assert.equal(business, businessId);
      const row = reviews.find((review) => review.id === id);
      if (!row) return null;
      writes++;
      row.ownerReply = body;
      row.ownerRepliedAt = now;
      row.updatedAt = now;
      return { id, ownerReply: body, ownerRepliedAt: now };
    },
  };
  const deps = {
    authorize: integrationAuthorized,
    store: () => store,
    now: () => new Date("2026-01-03T12:00:00Z"),
  };
  const read = createReviewFeedHandler(deps),
    reply = createReviewReplyHandler(deps);
  const transport: typeof fetch = async (input, init) => {
    calls++;
    const request = new Request(String(input), init);
    if (request.url.endsWith("/takatak-list-reviews")) return read(request);
    if (request.url.endsWith("/takatak-reply-review-v2")) return reply(request);
    throw new Error("Unexpected old or external endpoint");
  };
  try {
    process.env.QMAPS_FUNCTIONS_BASE_URL = "https://qmaps.example/functions/v1";
    process.env.QMAPS_INTEGRATION_SECRET = secret;
    runtime.Deno = {
      env: {
        get: (key) =>
          key === "QMAPS_TAKATAK_INTEGRATION_SECRET" ? secret : undefined,
      },
    };
    const first = await fetchQmapsReviewPage(
      clientId,
      businessId,
      null,
      transport,
    );
    assert.equal(first.ok, true);
    if (!first.ok) throw Error("first page failed");
    assert.equal(first.reviews.length, 25);
    assert.ok(first.nextCursor);
    const second = await fetchQmapsReviewPage(
      clientId,
      businessId,
      first.nextCursor,
      transport,
    );
    assert.equal(second.ok, true);
    if (!second.ok) throw Error("second page failed");
    assert.equal(second.reviews.length, 1);
    assert.equal(second.nextCursor, null);
    console.log(
      "PASS actual V1 reader -> QMAPS authenticated handler -> bounded pagination",
    );
    const denied = await fetchQmapsReviewPage(
      otherId,
      businessId,
      null,
      transport,
    );
    assert.equal(denied.ok, false);
    assert.equal(writes, 0);
    console.log(
      "PASS actual handler refuses a different workspace using the same integration credential",
    );
    const deniedReply = await postQmaps(
      "takatak-reply-review-v2",
      {
        version: 1,
        clientId: otherId,
        businessId,
        reviewId: reviews[0].id,
        body: "Must not publish",
      },
      transport,
    );
    assert.equal(deniedReply.ok, false);
    assert.equal(writes, 0);
    const accepted = await postQmaps(
      "takatak-reply-review-v2",
      {
        version: 1,
        clientId,
        businessId,
        reviewId: reviews[0].id,
        body: "Synthetic approved owner reply",
      },
      transport,
    );
    assert.equal(accepted.ok, true);
    assert.equal(writes, 1);
    console.log(
      "PASS actual scoped V1 mutation -> QMAPS handler -> persisted exact reply acknowledgment",
    );
    const refreshed = await fetchQmapsReviewPage(
      clientId,
      businessId,
      null,
      transport,
    );
    assert.equal(refreshed.ok, true);
    if (!refreshed.ok) throw Error("refresh failed");
    assert.equal(
      refreshed.reviews[0].ownerReply,
      "Synthetic approved owner reply",
    );
    assert.equal(
      refreshed.reviews[0].ownerRepliedAt,
      "2026-01-03T12:00:00.000Z",
    );
    console.log(
      "PASS actual subsequent API read returns the source reply; round trip complete",
    );
    process.env.QMAPS_INTEGRATION_SECRET =
      "synthetic-wrong-key-long-enough-for-protocol";
    const unauth = await fetchQmapsReviewPage(
      clientId,
      businessId,
      null,
      transport,
    );
    assert.equal(unauth.ok, false);
    assert.equal(writes, 1);
    console.log(
      "PASS actual QMAPS authentication rejects a different integration secret",
    );
    console.log(
      `Cross-repository QMAPS contract: 5 workflows passed, ${calls} in-process calls, synthetic storage only. No live network/database/public review operation.`,
    );
  } finally {
    if (previousBase === undefined) delete process.env.QMAPS_FUNCTIONS_BASE_URL;
    else process.env.QMAPS_FUNCTIONS_BASE_URL = previousBase;
    if (previousSecret === undefined)
      delete process.env.QMAPS_INTEGRATION_SECRET;
    else process.env.QMAPS_INTEGRATION_SECRET = previousSecret;
    if (previousDeno === undefined) delete runtime.Deno;
    else runtime.Deno = previousDeno;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
