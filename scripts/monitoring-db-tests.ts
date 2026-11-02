// Real ephemeral PostgreSQL + fake Stripe. Never contacts a payment provider.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { getPrisma } from "../src/lib/db/prisma";
import { applyMonitoringStripeEvent, startMonitoringCheckout, monitoringPortal } from "../src/lib/monitoring/billing";
import { getMonitoringRows, updateMonitoringMetadata } from "../src/lib/monitoring/store";
import { monitoringEntitled, record } from "../src/lib/monitoring/policy";
import { POST as ingest } from "../src/app/api/integrations/monitoring/snapshot/route";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  assert.ok(["127.0.0.1", "localhost"].includes(host), "ephemeral loopback database required");
  const db = getPrisma()!;
  process.env.STRIPE_SECRET_KEY = "sk_test_monitoring_fixture_only";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_monitoring_fixture_only";
  process.env.MONITORING_BILLING_ENABLED = "true";
  const a = await db.client.create({ data: { name: `monitor-test-${randomUUID()}`, status: "active", subscription: { create: { externalCustomerId: "cus_MONITORQA001", status: "active" } } } });
  const b = await db.client.create({ data: { name: `monitor-other-${randomUUID()}`, status: "active" } });
  const site = await db.domainAsset.create({ data: { clientId: a.id, domainName: "monitor.example.com", metadata: { preserved: "yes" } } });
  const foreign = await db.domainAsset.create({ data: { clientId: b.id, domainName: "foreign.example.com" } });
  const key = "1a".repeat(32), foreignKey = "2b".repeat(32);
  process.env.MONITORING_SYNC_KEYS = JSON.stringify({ [site.id]: key, [foreign.id]: foreignKey });
  const calls: Stripe.Checkout.SessionCreateParams[] = [];
  let providerSub: Record<string, unknown> = {};
  const fake = {
    customers: { retrieve: async () => ({ id: "cus_MONITORQA001" }) },
    checkout: { sessions: { create: async (params: Stripe.Checkout.SessionCreateParams) => { calls.push(params); return { id: "cs_monitoring", url: "https://checkout.stripe.com/c/pay/test" }; } } },
    subscriptions: { retrieve: async () => providerSub },
    billingPortal: { sessions: { create: async () => ({ url: "https://billing.stripe.com/p/session/test" }) } },
  };
  (globalThis as unknown as { socialStripe: Stripe }).socialStripe = fake as unknown as Stripe;
  async function send(payload: unknown, signingKey = key) {
    const raw = JSON.stringify(payload), timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", Buffer.from(signingKey, "hex")).update(`${timestamp}.${raw}`).digest("hex");
    return ingest(new Request("https://takatak.ca/api/integrations/monitoring/snapshot", { method: "POST", body: raw,
      headers: { "Content-Type": "application/json", "x-monitor-timestamp": timestamp, "x-monitor-signature": signature } }));
  }
  try {
    assert.deepEqual((await getMonitoringRows(a.id)).map(row => row.id), [site.id]);
    await assert.rejects(updateMonitoringMetadata(a.id, foreign.id, meta => ({ ...meta, changed: true })), /not found/);
    await assert.rejects(startMonitoringCheckout(b.id, site.id, true), /not found/);
    await assert.rejects(startMonitoringCheckout(a.id, site.id, false), /Confirm/);
    const clicks = await Promise.allSettled([startMonitoringCheckout(a.id, site.id, true), startMonitoringCheckout(a.id, site.id, true)]);
    assert.equal(clicks.filter(value => value.status === "fulfilled").length, 1);
    assert.equal(calls.length, 1, "concurrent clicks create exactly one checkout");
    const line = calls[0].line_items![0];
    assert.equal(line.price_data?.unit_amount, 500);
    assert.equal(line.price_data?.currency, "cad");
    assert.equal(calls[0].subscription_data?.metadata?.clientId, a.id);
    assert.equal(record((await db.domainAsset.findUniqueOrThrow({ where: { id: site.id } })).metadata).preserved, "yes");
    let row = (await getMonitoringRows(a.id))[0];
    assert.equal(monitoringEntitled(row.billing), false, "checkout never activates service");
    const authorization = { kind: "authorization", domainAssetId: site.id, hostname: site.domainName };
    assert.equal((await (await send(authorization)).json()).enabled, false);
    assert.equal((await send({ ...authorization, domainAssetId: foreign.id, hostname: foreign.domainName })).status, 401);
    assert.equal((await send({ ...authorization, hostname: foreign.domainName })).status, 403);
    console.log("PASS workspace isolation, explicit consent, concurrent checkout reservation, fixed price and per-domain HMAC scope");

    const seconds = Math.floor(Date.now() / 1000), paidUntil = seconds + 86400;
    providerSub = { id: "sub_MONITORQA001", customer: "cus_MONITORQA001", metadata: calls[0].subscription_data!.metadata!, status: "active", cancel_at_period_end: false,
      latest_invoice: { status: "open" }, items: { data: [{ quantity: 1, current_period_end: paidUntil, price: { currency: "cad", unit_amount: 500, recurring: { interval: "month", interval_count: 1 } } }] } };
    const event = (created = seconds) => ({ id: `evt_${created}`, type: "customer.subscription.updated", created, data: { object: providerSub } }) as unknown as Stripe.Event;
    assert.equal(await applyMonitoringStripeEvent(event()), true);
    assert.equal(monitoringEntitled((await getMonitoringRows(a.id))[0].billing), false, "unpaid invoice cannot enable checks");
    providerSub.latest_invoice = { status: "paid" };
    await applyMonitoringStripeEvent(event(seconds + 1));
    await applyMonitoringStripeEvent(event(seconds + 1));
    row = (await getMonitoringRows(a.id))[0];
    assert.equal(monitoringEntitled(row.billing), true);
    assert.equal((await (await send(authorization)).json()).enabled, true);
    await assert.rejects(startMonitoringCheckout(a.id, site.id, true), /already has/);
    await assert.rejects(monitoringPortal(b.id, site.id), /No monitoring/);
    assert.match(await monitoringPortal(a.id, site.id), /^https:\/\/billing.stripe.com/);
    const snapshot = { domainAssetId: site.id, hostname: site.domainName, observedAt: seconds, intervalSeconds: 300, stable: "up", ok: true, status: 200, latencyMs: 15, reason: "http", months: [{ month: new Date().toISOString().slice(0, 7), checks: 1, successes: 1, meanMs: 15 }] };
    assert.equal((await send(snapshot)).status, 200);
    assert.equal((await getMonitoringRows(a.id))[0].snapshot?.observedAt, seconds);
    assert.equal((await send({ ...snapshot, observedAt: seconds - 300, stable: "down" })).status, 200);
    assert.equal((await getMonitoringRows(a.id))[0].snapshot?.stable, "up", "older snapshot cannot regress state");
    assert.equal(record((await db.domainAsset.findUniqueOrThrow({ where: { id: site.id } })).metadata).preserved, "yes");
    console.log("PASS payment-before-activation, signed sync, replay safety, old snapshot rejection, private portal and metadata preservation");

    providerSub.status = "past_due";
    await applyMonitoringStripeEvent(event(seconds + 2));
    assert.equal((await (await send(authorization)).json()).enabled, false);
    assert.equal((await send({ ...snapshot, observedAt: seconds + 1 })).status, 403);
    providerSub.status = "active";
    await applyMonitoringStripeEvent(event(seconds + 1));
    assert.equal(monitoringEntitled((await getMonitoringRows(a.id))[0].billing), false, "older event cannot reactivate subscription");
    providerSub.status = "canceled";
    await applyMonitoringStripeEvent(event(seconds + 3));
    assert.equal((await (await send(authorization)).json()).enabled, false);
    console.log("PASS failed payment and cancellation disable checks; out-of-order events do not reactivate service");
  } finally {
    await db.client.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Monitoring DB tests failed"); process.exit(1); });
