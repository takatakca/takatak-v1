// GROUPE TAKATAK Billing — "Payer" for Facturations invoices against a real
// database (ephemeral CI Postgres or local), with an in-memory fake Stripe
// and a fake Facturations issuance endpoint. Synthetic data only; refuses
// non-loopback databases. No network.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { getClientInvoices } from "@/lib/billing/client-invoices/client-invoice-service";
import { startFacturationsInvoiceCheckout } from "@/lib/billing/client-invoices/facturations-checkout";
import { ServiceError } from "@/lib/services/service-error";

const BUSINESS = "checkout-test-business";
const sessions: Array<{ params: any; key: string }> = [];
let nextStatus: "open" | "complete" | "expired" = "open";
(globalThis as any).socialStripe = {
  invoices: { list: async () => ({ data: [] }) },
  checkout: { sessions: { create: async (params: any, options: { idempotencyKey: string }) => {
    sessions.push({ params, key: options.idempotencyKey });
    const status = nextStatus;
    nextStatus = "open";
    return { id: `cs_test_${sessions.length}`, status, url: `https://checkout.stripe.com/c/pay/cs_test_${sessions.length}` };
  } } },
};

type Issued = { id: string; totalCents: string; balanceCents: string; financialState: string; proofScope: string };
const issuances = new Map<string, Issued>();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = new URL(String(input));
  const match = url.pathname.match(/^\/integration\/v1\/drafts\/([0-9a-f-]{36})\/issuance$/);
  if (url.origin !== "https://facturations.test" || !match || init?.method !== "GET") {
    return realFetch(input, init);
  }
  const invoice = issuances.get(match[1]);
  const data = invoice
    ? { draftId: match[1], issued: true, invoice: { id: invoice.id, officialInvoiceNumber: "TK-2026-0001", issuedAt: "2026-10-01T12:00:00.000Z",
        currency: "CAD", totalCents: invoice.totalCents, balanceCents: invoice.balanceCents, financialState: invoice.financialState, proofScope: invoice.proofScope } }
    : { draftId: match[1], issued: false, invoice: null };
  return new Response(JSON.stringify({ version: 1, businessId: BUSINESS, requestId: randomUUID(), data }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}) as typeof fetch;

async function expectServiceError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof ServiceError && error.code === code);
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  }
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: "sk_test_fake_for_local_test_only",
    NEXT_PUBLIC_APP_URL: "https://app.takatak.test",
    FACTURATIONS_INTEGRATION_ENABLED: "1",
    FACTURATIONS_ORIGIN: "https://facturations.test",
    FACTURATIONS_INTEGRATION_HMAC_SECRET: "x".repeat(48),
    FACTURATIONS_INTEGRATION_ISSUER: "takatak-test",
    FACTURATIONS_INTEGRATION_AUDIENCE: "facturations-test",
    FACTURATIONS_BUSINESS_ID: BUSINESS,
  });
  const prisma = getPrisma()!;
  const client = await prisma.client.create({ data: { name: `Checkout test ${randomUUID()}` } });
  const other = await prisma.client.create({ data: { name: `Other ${randomUUID()}` } });
  const customer = `cus_TEST${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  await prisma.clientSubscription.create({ data: { clientId: client.id, planCode: "social_pro", status: "active", provider: "stripe", externalCustomerId: customer } });

  async function submittedRequest(clientId: string, issued: Omit<Issued, "id"> | null) {
    const draftId = randomUUID();
    const row = await prisma.billingInvoiceRequest.create({ data: {
      sourceApp: "manual", sourceReference: `checkout-${randomUUID()}`, clientId, idempotencyKey: `tkb1_${randomUUID()}`,
      draft: { customerId: randomUUID(), issueDate: "2026-10-01", dueDate: "2099-01-01", lines: [{ description: "Service", quantity: 1, unitPriceCents: "13500" }] },
      draftHash: "a".repeat(64), estimatedTotalCents: BigInt(15522), status: "submitted", facturationsDraftId: draftId, submittedAt: new Date(),
    } });
    if (issued) issuances.set(draftId, { id: randomUUID(), ...issued });
    return { row, draftId };
  }

  const owed = await submittedRequest(client.id, { totalCents: "15522", balanceCents: "15522", financialState: "NO_EVIDENCE", proofScope: "NONE" });
  const issuedId = issuances.get(owed.draftId)!.id;

  const list = await getClientInvoices(client.id);
  assert.equal(list.status, "ok");
  const row = list.status === "ok" ? list.invoices.find((i) => i.source === "facturations") : undefined;
  assert.equal(row?.checkoutRequestId, owed.row.id);
  console.log("PASS invoice center offers Payer on an owed Facturations invoice");

  const first = await startFacturationsInvoiceCheckout({ clientId: client.id, requestId: owed.row.id });
  assert.equal(first.url, "https://checkout.stripe.com/c/pay/cs_test_1");
  const created = sessions[0];
  assert.equal(created.params.mode, "payment");
  assert.equal(created.params.customer, customer);
  assert.equal(created.params.line_items[0].price_data.unit_amount, 15522);
  assert.equal(created.params.metadata.facturations_business_id, BUSINESS);
  assert.equal(created.params.metadata.facturations_issued_invoice_id, issuedId);
  assert.equal(created.params.metadata.takatak_client_id, client.id);
  assert.equal(created.params.success_url, "https://app.takatak.test/dashboard/invoices?payment=success");
  await startFacturationsInvoiceCheckout({ clientId: client.id, requestId: owed.row.id });
  assert.equal(sessions[1].key, created.key, "double click reuses the same idempotency key");
  console.log("PASS Checkout session carries the Facturations balance and exact metadata; repeats are idempotent");

  await expectServiceError(startFacturationsInvoiceCheckout({ clientId: other.id, requestId: owed.row.id }), "not_found");
  console.log("PASS another workspace cannot pay (or even see) this invoice");

  const partial = await submittedRequest(client.id, { totalCents: "15522", balanceCents: "6000", financialState: "PARTIALLY_PAID", proofScope: "VERIFIED_PROVIDER_PRESENT" });
  await startFacturationsInvoiceCheckout({ clientId: client.id, requestId: partial.row.id });
  assert.equal(sessions.at(-1)!.params.line_items[0].price_data.unit_amount, 6000);
  console.log("PASS partially paid (verified) invoice charges only the remaining balance");

  const paid = await submittedRequest(client.id, { totalCents: "15522", balanceCents: "0", financialState: "PAID", proofScope: "VERIFIED_PROVIDER_PRESENT" });
  await expectServiceError(startFacturationsInvoiceCheckout({ clientId: client.id, requestId: paid.row.id }), "conflict");
  const notIssued = await submittedRequest(client.id, null);
  await expectServiceError(startFacturationsInvoiceCheckout({ clientId: client.id, requestId: notIssued.row.id }), "not_found");
  console.log("PASS paid or not-yet-issued invoices cannot be paid again");

  nextStatus = "complete";
  await expectServiceError(startFacturationsInvoiceCheckout({ clientId: client.id, requestId: owed.row.id }), "conflict");
  nextStatus = "expired";
  const before = sessions.length;
  const renewed = await startFacturationsInvoiceCheckout({ clientId: client.id, requestId: owed.row.id });
  assert.equal(sessions.length, before + 2);
  assert.notEqual(sessions.at(-1)!.key, created.key, "expired session → fresh key");
  assert.match(renewed.url, /^https:\/\/checkout\.stripe\.com\//);
  console.log("PASS already-paid session blocks a second payment; expired session opens a fresh one");

  delete process.env.STRIPE_SECRET_KEY;
  await expectServiceError(startFacturationsInvoiceCheckout({ clientId: client.id, requestId: owed.row.id }), "unavailable");
  console.log("PASS Stripe not configured → unavailable");
}
main().then(() => process.exit(0), (e) => { console.error(String(e?.stack ?? e).slice(0, 1200)); process.exit(1); });
