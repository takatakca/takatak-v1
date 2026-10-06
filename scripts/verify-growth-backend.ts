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
import { parseAudienceRule, parseCollectPayload } from "../src/lib/analytics/parse";
import {
  createAnalyticsSite,
  createAudience,
  dailyVisitorHash,
  getAnalyticsSummary,
  recordAnalyticsEvent,
} from "../src/lib/analytics/service";
import {
  convertConversationToLead,
  createChatWidget,
  getConversationThread,
  getInboxSnapshot,
  publicWidget,
  setConversationStatus,
  staffReply,
  visitorMessages,
  visitorSend,
} from "../src/lib/chat/service";

const PHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
function hdrs(origin: string | null, ip = "203.0.113.7", ua = PHONE_UA, extra: Record<string, string> = {}): Headers {
  const h = new Headers({ "user-agent": ua, "x-forwarded-for": ip, ...extra });
  if (origin) h.set("origin", origin);
  return h;
}

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

    // --------------------------------------------------------------- analytics
    const site = await createAnalyticsSite(a.id, { name: "Garage site", domain: "https://www.garage-qa.ca/", businessBrandId: null });
    assert.ok(!("error" in site));
    const otherSite = await createAnalyticsSite(b.id, { name: "B site", domain: "b-qa.ca", businessBrandId: null });
    assert.ok(!("error" in otherSite));
    const pv = (path: string, extra: Record<string, unknown> = {}) =>
      parseCollectPayload({ k: site.publicKey, u: `https://garage-qa.ca${path}`, ...extra })!;

    assert.equal((await recordAnalyticsEvent(pv("/"), hdrs("https://evil.example"))).ok, false, "foreign origin rejected");
    assert.equal((await recordAnalyticsEvent(pv("/"), hdrs(null))).ok, false, "missing origin rejected");
    const spoofHost = parseCollectPayload({ k: site.publicKey, u: "https://evil.example/" })!;
    assert.equal((await recordAnalyticsEvent(spoofHost, hdrs("https://garage-qa.ca"))).ok, false, "page on another host rejected");
    assert.equal((await recordAnalyticsEvent(pv("/"), hdrs("https://garage-qa.ca", "1.1.1.1", "Googlebot/2.1 (+http://www.google.com/bot.html)"))).ok, false, "bot ignored");
    assert.equal((await recordAnalyticsEvent(pv("/"), hdrs("https://garage-qa.ca", "1.1.1.1", PHONE_UA, { "sec-gpc": "1" }))).ok, false, "GPC honoured");

    for (const ip of ["198.51.100.1", "198.51.100.1", "198.51.100.2"]) {
      assert.ok((await recordAnalyticsEvent(pv("/pricing?utm_campaign=fall"), hdrs("https://www.garage-qa.ca", ip, PHONE_UA, { "cf-ipcountry": "CA" }))).ok);
    }
    assert.ok((await recordAnalyticsEvent(pv("/"), hdrs("https://garage-qa.ca", "198.51.100.3"))).ok);
    const call = parseCollectPayload({ k: site.publicKey, t: "conversion", n: "call_click", u: "https://garage-qa.ca/contact" })!;
    assert.ok((await recordAnalyticsEvent(call, hdrs("https://garage-qa.ca", "198.51.100.1"))).ok);
    const storedEvent = await prisma.analyticsEvent.findFirstOrThrow({ where: { siteId: site.id }, select: { visitorHash: true, path: true } });
    assert.equal(storedEvent.visitorHash.length, 32);
    assert.ok(!storedEvent.visitorHash.includes("198.51"), "raw IP never stored");
    assert.notEqual(
      dailyVisitorHash(site.id, "198.51.100.1", PHONE_UA, new Date("2026-01-01T12:00:00Z")),
      dailyVisitorHash(site.id, "198.51.100.1", PHONE_UA, new Date("2026-01-02T12:00:00Z")),
      "visitor id rotates daily",
    );
    pass("collection: origin-locked, bots and GPC skipped, IPs never stored, ids rotate daily");

    const summary = await getAnalyticsSummary(a.id, { days: 7 });
    assert.equal(summary.totals.pageviews, 4);
    assert.equal(summary.totals.visitors, 3, "3 distinct visitors today");
    assert.equal(summary.totals.conversions, 1);
    assert.equal(summary.totals.convertingVisitors, 1);
    assert.ok(summary.totals.convertingVisitors <= summary.totals.visitors, "conversion rate can never exceed 100%");
    assert.deepEqual(summary.topPages[0], { label: "/pricing", count: 3 });
    assert.deepEqual(summary.campaigns[0], { label: "fall", count: 3 });
    assert.deepEqual(summary.countries[0], { label: "CA", count: 3 });
    assert.deepEqual(summary.conversions[0], { label: "call_click", count: 1 });
    assert.equal(summary.daily.length, 7);
    const bSummary = await getAnalyticsSummary(b.id, { days: 7 });
    assert.equal(bSummary.totals.pageviews + bSummary.audiences.length, 0, "tenant B sees no A traffic");
    assert.equal((await getAnalyticsSummary(b.id, { siteId: site.id })).selectedSiteId, null, "B cannot select A's site");
    pass("analytics summary is accurate and tenant-isolated");

    const rule = parseAudienceRule({ name: "Pricing viewers", pathPrefixes: "/pricing", lookbackDays: "30" });
    assert.ok(rule.ok);
    assert.ok("error" in (await createAudience(b.id, site.id, rule.value)), "B cannot build audiences on A's site");
    assert.ok(!("error" in (await createAudience(a.id, site.id, rule.value))));
    const pctRule = parseAudienceRule({ name: "Literal percent", pathPrefixes: "/pri%", lookbackDays: "30" });
    assert.ok(pctRule.ok);
    assert.ok(!("error" in (await createAudience(a.id, site.id, pctRule.value))));
    const withAudiences = await getAnalyticsSummary(a.id, { days: 7 });
    assert.equal(withAudiences.audiences.find((x) => x.name === "Pricing viewers")?.reach, 2);
    assert.equal(withAudiences.audiences.find((x) => x.name === "Literal percent")?.reach, 0, "LIKE wildcards are escaped");
    pass("retargeting audiences estimate reach and escape wildcards");

    // ------------------------------------------------------------------- chat
    const widget = await createChatWidget(a.id, { name: "Garage chat", domain: "garage-qa.ca", greeting: "Bonjour", accentColor: "#112233", whatsappNumber: "+1 514 555 0123", businessBrandId: null });
    assert.ok(!("error" in widget));
    assert.equal(await publicWidget(widget.publicKey, "https://evil.example"), null, "widget locked to its domain");
    const pw = await publicWidget(widget.publicKey, "https://garage-qa.ca");
    assert.ok(pw && pw.whatsappNumber === "15145550123");
    const firstChat = await visitorSend(pw, { visitorToken: null, body: "Avez-vous des pneus d'hiver ?", name: "Luc", email: "luc@example.test", phone: null, pageUrl: "https://garage-qa.ca/" });
    assert.ok(!("error" in firstChat));
    const conv = await prisma.chatConversation.findFirstOrThrow({ where: { widgetId: pw.id }, select: { id: true, visitorTokenHash: true, unreadForStaff: true } });
    assert.notEqual(conv.visitorTokenHash, firstChat.visitorToken, "visitor token stored only as a hash");
    assert.equal(conv.unreadForStaff, 1);
    const again = await visitorSend(pw, { visitorToken: firstChat.visitorToken, body: "Pour une Civic 2019", name: null, email: null, phone: null, pageUrl: null });
    assert.ok(!("error" in again));
    assert.equal(await prisma.chatConversation.count({ where: { widgetId: pw.id } }), 1, "token continues the same conversation");
    pass("visitors chat on the right domain; token stored hashed and continues the thread");

    assert.equal(await staffReply(b.id, conv.id, "hijack", null), false, "B cannot reply in A's conversation");
    assert.equal(await getConversationThread(b.id, conv.id), null, "B cannot read A's conversation");
    assert.equal(await staffReply(a.id, conv.id, "Oui ! Passez nous voir.", null), true);
    const visible = await visitorMessages(pw, firstChat.visitorToken, null);
    assert.ok(visible && visible.messages.length === 3 && visible.messages[2].sender === "staff");
    const newer = await visitorMessages(pw, firstChat.visitorToken, visible.messages[1].createdAt);
    assert.equal(newer?.messages.length, 1, "polling with after= returns only new messages");
    assert.equal(await visitorMessages(pw, "x".repeat(43), null), null, "unknown token reads nothing");
    const thread = await getConversationThread(a.id, conv.id);
    assert.equal(thread?.messages.length, 3);
    assert.equal((await prisma.chatConversation.findUniqueOrThrow({ where: { id: conv.id } })).unreadForStaff, 0, "opening marks read");
    pass("staff replies reach the visitor; threads are tenant-isolated");

    const inbox = await getInboxSnapshot(a.id);
    assert.equal(inbox.totals.open, 1);
    assert.equal((await getInboxSnapshot(b.id)).conversations.length, 0);
    const lead1 = await convertConversationToLead(a.id, conv.id);
    const lead2 = await convertConversationToLead(a.id, conv.id);
    assert.ok(lead1 && lead2 && lead1.leadId === lead2.leadId, "lead hand-off happens once");
    assert.equal(await convertConversationToLead(b.id, conv.id), null);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: lead1.leadId }, select: { clientId: true, name: true, email: true, message: true } });
    assert.equal(lead.clientId, a.id);
    assert.equal(lead.name, "Luc");
    assert.ok(lead.message?.includes("pneus d'hiver"));
    pass("conversation converts into a real lead exactly once");

    assert.equal(await setConversationStatus(b.id, conv.id, "closed"), false);
    assert.equal(await setConversationStatus(a.id, conv.id, "closed"), true);
    const afterClose = await visitorSend(pw, { visitorToken: firstChat.visitorToken, body: "Allo?", name: null, email: null, phone: null, pageUrl: null });
    assert.deepEqual(afterClose, { error: "closed" });
    assert.equal(await staffReply(a.id, conv.id, "late", null), false, "no replies on closed threads");
    pass("closed conversations accept no new messages");

    await assert.rejects(
      prisma.chatMessage.create({ data: { conversationId: conv.id, clientId: a.id, sender: "visitor", body: "" } }),
      "database rejects empty chat messages",
    );
    pass("database check constraint rejects empty messages");
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
