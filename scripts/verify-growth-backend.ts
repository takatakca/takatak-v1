// Growth Suite backend integration checks against a real migrated database:
// review funnel end to end, tenant isolation, and AI credit ledger integrity
// (idempotency, no overdraft under concurrency, single refund).
//
// Requires DATABASE_URL pointing at a disposable, fully migrated database.
// Creates two synthetic clients and deletes them (cascade) at the end.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { disconnectPrisma, getPrisma } from "../src/lib/db/prisma";
import { debitCredits, getCreditSnapshot, grantCredits, refundDebit } from "../src/lib/ai-credits/ledger";
import {
  createReviewProfile,
  createReviewRequest,
  getPublicReviewPage,
  getReputationSnapshot,
  resolvePublicReviewDestination,
  setReviewProfileActive,
  submitPublicRating,
  updateFeedbackStatus,
} from "../src/lib/reputation/service";
import { parsePublicRatingInput, parseReviewProfileInput } from "../src/lib/reputation/validation";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

function rating(raw: Record<string, unknown>) {
  const parsed = parsePublicRatingInput(raw);
  assert.ok(parsed.ok, "rating input parses");
  return parsed.value;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (!url) {
    console.log("SKIP  DATABASE_URL not set — Growth Suite backend checks need a migrated database.");
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run against production.");

  const prisma = getPrisma();
  if (!prisma) throw new Error("Prisma is not available for DATABASE_URL.");
  const tag = `growth-qa-${randomUUID().slice(0, 8)}`;
  const a = await prisma.client.create({ data: { name: `${tag}-a` }, select: { id: true } });
  const b = await prisma.client.create({ data: { name: `${tag}-b` }, select: { id: true } });

  try {
    // ------------------------------------------------------------ reputation
    const brandB = await prisma.businessBrand.create({ data: { clientId: b.id, name: `${tag}-brand-b` }, select: { id: true } });
    const profileInput = parseReviewProfileInput({ name: "Garage Verdun", googlePlaceId: "ChIJN1t_tDeuEmsRUsoyG83frY4" });
    assert.ok(profileInput.ok);
    await assert.rejects(
      createReviewProfile(a.id, { ...profileInput.value, businessBrandId: brandB.id }),
      /brand_not_in_workspace/,
      "cannot attach another tenant's brand",
    );
    const profile = await createReviewProfile(a.id, profileInput.value);
    assert.match(profile.publicSlug, /^garage-verdun-[0-9a-f]{6}$/);
    pass("review page created with a public slug; cross-tenant brand rejected");

    assert.equal(await createReviewRequest(b.id, profile.id, { channel: "sms", recipientName: null }, null), null, "tenant B cannot create requests on A's page");
    const req = await createReviewRequest(a.id, profile.id, { channel: "sms", recipientName: "Marie" }, null);
    assert.ok(req);
    const page = await getPublicReviewPage(profile.publicSlug, req.token);
    assert.ok(page && page.requestToken === req.token && page.recipientName === "Marie" && page.hasGoogle);
    const stored = await prisma.reviewRequest.findFirstOrThrow({ where: { profileId: profile.id }, select: { status: true, tokenHash: true } });
    assert.equal(stored.status, "opened");
    assert.notEqual(stored.tokenHash, req.token, "raw token is never stored");
    pass("tracked request opens, stores only a token hash, and is tenant-scoped");

    const first = await submitPublicRating(profile.publicSlug, req.token, rating({ rating: "2", feedback: "Slow service", followUpConsent: "on", contactEmail: "marie@example.test" }));
    assert.ok(first.ok);
    const replay = await submitPublicRating(profile.publicSlug, req.token, rating({ rating: "5" }));
    assert.equal(replay.ok, false, "a request token can only be used once");
    const anon = await submitPublicRating(profile.publicSlug, null, rating({ rating: "5", contactEmail: "no-consent@example.test" }));
    assert.ok(anon.ok);
    const anonRow = await prisma.reviewResponse.findUniqueOrThrow({ where: { id: anon.responseId }, select: { contactEmail: true, requestId: true } });
    assert.equal(anonRow.contactEmail, null, "contact details dropped without consent");
    assert.equal(anonRow.requestId, null);
    pass("ratings saved; single-use tokens; contact kept only with consent");

    const dest = await resolvePublicReviewDestination(profile.publicSlug, anon.responseId, "google");
    assert.equal(dest, "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4");
    assert.equal(await resolvePublicReviewDestination(profile.publicSlug, null, "facebook"), null, "no facebook link configured");
    pass("public review redirect is built server-side and click is recorded");

    assert.equal(await updateFeedbackStatus(b.id, first.responseId, "resolved", null), false, "tenant B cannot resolve A's feedback");
    assert.equal(await updateFeedbackStatus(a.id, first.responseId, "resolved", null), true);
    const snapA = await getReputationSnapshot(a.id);
    assert.equal(snapA.stats.responses, 2);
    assert.equal(snapA.stats.averageRating, 3.5);
    assert.equal(snapA.stats.rated, 1);
    assert.equal(snapA.stats.publicClicks, 1);
    assert.equal(snapA.stats.openFeedback, 0);
    const snapB = await getReputationSnapshot(b.id);
    assert.equal(snapB.profiles.length + snapB.responses.length + snapB.stats.requests, 0, "tenant B sees nothing of A");
    pass("dashboard snapshot is accurate and isolated per tenant");

    assert.equal(await setReviewProfileActive(b.id, profile.id, false), false);
    assert.equal(await setReviewProfileActive(a.id, profile.id, false), true);
    assert.equal(await getPublicReviewPage(profile.publicSlug, null), null, "paused page is hidden");
    pass("paused review page is unavailable to the public");

    await assert.rejects(
      prisma.reviewResponse.create({ data: { clientId: a.id, profileId: profile.id, rating: 9 } }),
      "database rejects out-of-range ratings",
    );
    pass("database check constraint enforces 1–5 ratings");

    // ---------------------------------------------------------------- credits
    assert.deepEqual(await debitCredits({ clientId: a.id, actionKey: "social_caption", idempotencyKey: "qa-debit-0" }), {
      ok: false,
      code: "insufficient_credits",
      balance: 0,
    });
    const grant = await grantCredits({ clientId: a.id, credits: 10, reason: "grant", idempotencyKey: "qa-grant-1" });
    assert.ok(grant.ok && grant.balance === 10);
    const grantAgain = await grantCredits({ clientId: a.id, credits: 10, reason: "grant", idempotencyKey: "qa-grant-1" });
    assert.ok(grantAgain.ok && grantAgain.replayed && grantAgain.balance === 10, "duplicate grant is a no-op");
    pass("grants are idempotent");

    assert.equal((await debitCredits({ clientId: a.id, actionKey: "made_up", idempotencyKey: "qa-x-1" })).ok, false, "unknown action rejected");
    assert.equal((await debitCredits({ clientId: a.id, actionKey: "image", units: 0, idempotencyKey: "qa-x-2" })).ok, false, "zero units rejected");

    // 10 credits; 8 concurrent debits of 2 credits (ad_copy_set) → exactly 5 succeed.
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => debitCredits({ clientId: a.id, actionKey: "ad_copy_set", idempotencyKey: `qa-burst-${i}` })),
    );
    assert.equal(results.filter((r) => r.ok).length, 5);
    assert.equal(results.filter((r) => !r.ok && r.code === "insufficient_credits").length, 3);
    assert.equal((await getCreditSnapshot(a.id)).balance, 0, "balance never goes negative");
    pass("concurrent debits never overdraw the balance");

    const dupes = await Promise.all(
      Array.from({ length: 4 }, () => grantCredits({ clientId: a.id, credits: 7, reason: "purchase", idempotencyKey: "qa-race-1" })),
    );
    assert.ok(dupes.every((r) => r.ok));
    assert.equal((await getCreditSnapshot(a.id)).balance, 7, "same key raced 4× applies once");
    pass("idempotency holds under a concurrent race");

    const debit = await debitCredits({ clientId: a.id, actionKey: "image", idempotencyKey: "qa-img-1" });
    assert.ok(debit.ok && debit.balance === 3);
    assert.equal((await refundDebit({ clientId: b.id, debitIdempotencyKey: "qa-img-1" })).ok, false, "tenant B cannot refund A's debit");
    const refund = await refundDebit({ clientId: a.id, debitIdempotencyKey: "qa-img-1" });
    const refundAgain = await refundDebit({ clientId: a.id, debitIdempotencyKey: "qa-img-1" });
    assert.ok(refund.ok && !refund.replayed && refund.balance === 7);
    assert.ok(refundAgain.ok && refundAgain.replayed && refundAgain.balance === 7, "refund applies once");
    pass("refunds are tenant-scoped and apply exactly once");

    const conflict = await debitCredits({ clientId: b.id, actionKey: "image", idempotencyKey: "qa-img-1" });
    assert.deepEqual(conflict, { ok: false, code: "idempotency_conflict" }, "a key reused across tenants is refused");
    const ledger = await prisma.aiCreditEntry.findMany({ where: { clientId: a.id }, select: { delta: true } });
    assert.equal(ledger.reduce((sum, e) => sum + e.delta, 0), (await getCreditSnapshot(a.id)).balance, "ledger sums to balance");
    assert.equal((await getCreditSnapshot(b.id)).balance, 0);
    pass("ledger entries always sum to the balance; tenants never share credits");

    await assert.rejects(prisma.aiCreditAccount.update({ where: { clientId: a.id }, data: { balance: -1 } }), "database rejects negative balance");
    pass("database check constraint forbids negative balances");
  } finally {
    await prisma.client.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await disconnectPrisma();
  }
  console.log("\nGrowth Suite backend: all checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
