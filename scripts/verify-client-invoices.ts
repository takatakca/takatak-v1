// GROUPE TAKATAK Billing — client invoice center safeguards.
// Pure logic + static source checks. No database, no network.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { parseDraftIssuance } from "../src/lib/integrations/facturations/contract";
import {
  buildFacturationsCheckoutParams,
  facturationsCheckoutIdempotencyKey,
  safeCheckoutUrl,
} from "../src/lib/billing/client-invoices/facturations-checkout-policy";
import {
  mapFacturationsInvoice,
  mapStripeInvoice,
  safeProviderUrl,
  summarizeClientInvoices,
  type StripeInvoiceLike,
} from "../src/lib/billing/client-invoices/invoice-view";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

const now = new Date("2026-10-06T12:00:00Z");
const seconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const base: StripeInvoiceLike = {
  id: "in_1Example000000000",
  number: "TAKA-0001",
  description: "TAKATAK Social Pro",
  created: seconds("2026-09-01T10:00:00Z"),
  due_date: seconds("2026-09-15T10:00:00Z"),
  currency: "cad",
  total: 6899,
  amount_due: 6899,
  amount_paid: 6899,
  amount_remaining: 0,
  status: "paid",
  status_transitions: { paid_at: seconds("2026-09-02T10:00:00Z") },
  hosted_invoice_url: "https://invoice.stripe.com/i/acct_x/test_abc",
  invoice_pdf: "https://pay.stripe.com/invoice/acct_x/test_abc/pdf",
};

const paid = mapStripeInvoice(base, now);
assert.ok(paid);
assert.equal(paid.status, "paid");
assert.equal(paid.currency, "CAD");
assert.equal(paid.amountDueMinor, 0);
assert.equal(paid.paidAt, "2026-09-02T10:00:00.000Z");
assert.equal(paid.payUrl, base.hosted_invoice_url);
pass("paid Stripe invoice maps to a read-only row with view + PDF links");

const open = mapStripeInvoice({ ...base, status: "open", amount_paid: 0, amount_remaining: 6899, due_date: seconds("2026-10-20T00:00:00Z") }, now);
assert.equal(open?.status, "open");
assert.equal(open?.amountDueMinor, 6899);
const overdue = mapStripeInvoice({ ...base, status: "open", amount_paid: 0, amount_remaining: 6899 }, now);
assert.equal(overdue?.status, "overdue");
const partial = mapStripeInvoice({ ...base, status: "open", amount_paid: 1000, amount_remaining: 5899, due_date: null }, now);
assert.equal(partial?.status, "open");
assert.equal(partial?.amountDueMinor, 5899);
pass("open invoices past their due date with a balance are flagged overdue; partial payments show the remainder");

assert.equal(mapStripeInvoice({ ...base, status: "draft" }, now), null);
assert.equal(mapStripeInvoice({ ...base, status: null }, now), null);
assert.equal(mapStripeInvoice({ ...base, status: "something_new" }, now), null);
assert.equal(mapStripeInvoice({ ...base, id: "pi_123" }, now), null);
assert.equal(mapStripeInvoice({ ...base, created: 0 }, now), null);
const voided = mapStripeInvoice({ ...base, status: "void" }, now);
assert.equal(voided?.status, "void");
assert.equal(voided?.payUrl, null);
pass("drafts and unknown states are never shown to clients; void invoices have no pay link");

assert.equal(safeProviderUrl("https://invoice.stripe.com/i/x"), "https://invoice.stripe.com/i/x");
assert.equal(safeProviderUrl("http://invoice.stripe.com/i/x"), null);
assert.equal(safeProviderUrl("https://evil.example/i/x"), null);
assert.equal(safeProviderUrl("https://invoice.stripe.com.evil.example/x"), null);
assert.equal(safeProviderUrl("javascript:alert(1)"), null);
assert.equal(mapStripeInvoice({ ...base, hosted_invoice_url: "https://evil.example/pay" }, now)?.payUrl, null);
pass("only Stripe-hosted HTTPS links are rendered");

const summary = summarizeClientInvoices([paid, open!, overdue!]);
assert.equal(summary.outstandingMinor, 13798);
assert.equal(summary.overdueCount, 1);
assert.equal(summary.lastPaidAt, "2026-09-02T10:00:00.000Z");
assert.deepEqual(summarizeClientInvoices([]), { currency: "CAD", outstandingMinor: 0, overdueCount: 0, lastPaidAt: null });
pass("summary totals the outstanding balance and counts overdue invoices");

const issued = {
  id: "22222222-2222-4222-8222-222222222222",
  officialInvoiceNumber: "INV-0042",
  issuedAt: "2026-09-20T15:00:00.000Z",
  currency: "CAD" as const,
  totalCents: "11498",
  balanceCents: "0",
  financialState: "PAID" as const,
  proofScope: "VERIFIED_PROVIDER_PRESENT" as const,
};
const requestId = "33333333-3333-4333-8333-333333333333";
const factPaid = mapFacturationsInvoice({ requestId, invoice: issued, dueDate: "2026-10-05", description: "Service" }, now);
assert.equal(factPaid.status, "paid");
assert.equal(factPaid.amountDueMinor, 0);
assert.equal(factPaid.source, "facturations");
assert.equal(factPaid.number, "INV-0042");
assert.equal(factPaid.payUrl, null);
const synthetic = mapFacturationsInvoice({ requestId, invoice: { ...issued, proofScope: "SYNTHETIC_ONLY" }, dueDate: "2026-12-01", description: null }, now);
assert.equal(synthetic.status, "open");
assert.equal(synthetic.amountDueMinor, 11498);
assert.equal(synthetic.amountPaidMinor, 0);
const noEvidenceLate = mapFacturationsInvoice({ requestId, invoice: { ...issued, financialState: "NO_EVIDENCE", proofScope: "NONE", balanceCents: "11498" }, dueDate: "2026-10-01", description: null }, now);
assert.equal(noEvidenceLate.status, "overdue");
const partialVerified = mapFacturationsInvoice({ requestId, invoice: { ...issued, financialState: "PARTIALLY_PAID", balanceCents: "6000" }, dueDate: "2026-12-01", description: null }, now);
assert.equal(partialVerified.status, "open");
assert.equal(partialVerified.amountDueMinor, 6000);
assert.equal(partialVerified.amountPaidMinor, 5498);
const refunded = mapFacturationsInvoice({ requestId, invoice: { ...issued, financialState: "FULLY_REFUNDED" }, dueDate: null, description: null }, now);
assert.equal(refunded.status, "refunded");
assert.equal(refunded.amountDueMinor, 0);
pass("Facturations invoices: only VERIFIED provider evidence counts as paid; synthetic/none stays owed; overdue after due date");

assert.equal(factPaid.checkoutRequestId, null);
assert.equal(refunded.checkoutRequestId, null);
assert.equal(synthetic.checkoutRequestId, requestId);
assert.equal(noEvidenceLate.checkoutRequestId, requestId);
assert.equal(partialVerified.checkoutRequestId, requestId);
assert.equal(mapStripeInvoice(base, now)?.checkoutRequestId, null);
pass("Payer appears only on owed Facturations invoices, never on paid/refunded or Stripe rows");

const issuedInvoiceId = "44444444-4444-4444-8444-444444444444";
const checkoutInput = {
  businessId: "groupe-takatak-business",
  issuedInvoiceId,
  invoiceNumber: "TK-2026-0001",
  amountCents: 15522,
  clientId: "client-1",
  requestId,
  customerId: "cus_TEST123456",
  origin: "https://app.takatak.ca/some/path?x=1",
};
const params = buildFacturationsCheckoutParams(checkoutInput);
assert.equal(params.mode, "payment");
assert.equal(params.customer, "cus_TEST123456");
assert.equal(params.line_items.length, 1);
assert.equal(params.line_items[0].price_data.currency, "cad");
assert.equal(params.line_items[0].price_data.unit_amount, 15522);
assert.equal(params.line_items[0].price_data.product_data.name, "Facture TK-2026-0001");
assert.deepEqual(params.metadata, {
  facturations_business_id: "groupe-takatak-business",
  facturations_issued_invoice_id: issuedInvoiceId,
  takatak_client_id: "client-1",
  takatak_invoice_request_id: requestId,
});
assert.deepEqual(params.payment_intent_data.metadata, params.metadata);
assert.equal(params.success_url, "https://app.takatak.ca/dashboard/invoices?payment=success");
assert.equal(params.cancel_url, "https://app.takatak.ca/dashboard/invoices?payment=cancelled");
assert.equal("customer" in buildFacturationsCheckoutParams({ ...checkoutInput, customerId: "not-a-customer" }), false);
assert.equal(buildFacturationsCheckoutParams({ ...checkoutInput, invoiceNumber: "<script>" }).line_items[0].price_data.product_data.name, "Facture script");
for (const bad of [
  { amountCents: 49 }, { amountCents: 100_000_000 }, { amountCents: 10.5 },
  { issuedInvoiceId: "nope" }, { requestId: "nope" }, { businessId: "" },
]) {
  assert.throws(() => buildFacturationsCheckoutParams({ ...checkoutInput, ...bad }), TypeError);
}
pass("Checkout session: CAD one-time payment of the Facturations balance, exact metadata for the Facturations webhook");

const keyInput = { clientId: "client-1", issuedInvoiceId, amountCents: 15522 };
const key = facturationsCheckoutIdempotencyKey(keyInput);
assert.match(key, /^tkpay1_[A-Za-z0-9_-]{43}$/);
assert.equal(facturationsCheckoutIdempotencyKey({ ...keyInput, issuedInvoiceId: issuedInvoiceId.toUpperCase() }), key);
assert.notEqual(facturationsCheckoutIdempotencyKey({ ...keyInput, amountCents: 6000 }), key);
assert.notEqual(facturationsCheckoutIdempotencyKey({ ...keyInput, clientId: "client-2" }), key);
assert.notEqual(facturationsCheckoutIdempotencyKey({ ...keyInput, attempt: "2026-10-06T12" }), key);
assert.equal(safeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_123"), "https://checkout.stripe.com/c/pay/cs_test_123");
for (const url of ["http://checkout.stripe.com/c/pay", "https://checkout.stripe.com.evil.example/", "https://evil.example/", "javascript:alert(1)", null]) {
  assert.equal(safeCheckoutUrl(url), null);
}
pass("double clicks reuse one Stripe session; only Stripe-hosted HTTPS checkout URLs are followed");

assert.deepEqual(
  parseDraftIssuance({ draftId: requestId, issued: false, invoice: null, nativeActions: {} }),
  { draftId: requestId, issued: false, invoice: null },
);
assert.equal(parseDraftIssuance({ draftId: requestId, issued: false, invoice: issued })?.issued ?? null, null);
assert.equal(parseDraftIssuance({ draftId: requestId, issued: true, invoice: issued })?.invoice?.officialInvoiceNumber, "INV-0042");
assert.equal(parseDraftIssuance({ draftId: requestId, issued: true, invoice: { ...issued, currency: "USD" } }), null);
assert.equal(parseDraftIssuance({ draftId: requestId, issued: true, invoice: { ...issued, financialState: "MAYBE" } }), null);
assert.equal(parseDraftIssuance({ draftId: requestId, issued: true, invoice: { ...issued, totalCents: "-1" } }), null);
assert.equal(parseDraftIssuance({ draftId: "nope", issued: false, invoice: null }), null);
pass("issuance responses are strictly validated (currency, states, amounts, ids)");

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const page = read("src/app/dashboard/invoices/page.tsx");
assert.ok(page.includes('requireWorkspacePermission("manage_settings", "/dashboard/invoices")'));
assert.ok(page.includes("getClientInvoices(access.activeClientId)"));
assert.equal(/\bparams\b/.test(page), false, "page never takes a customer or client from the URL");
assert.equal((page.match(/searchParams/g) ?? []).length, 3, "searchParams only selects the payment notice");
assert.ok(page.includes("Object.hasOwn(PAYMENT_NOTICES, payment)"));
assert.ok(page.includes('rel="noopener noreferrer"'));
const service = read("src/lib/billing/client-invoices/client-invoice-service.ts");
assert.ok(service.startsWith('import "server-only";'));
assert.ok(service.includes("where: { clientId }"), "customer ids come from this workspace's rows only");
assert.ok(service.includes("owner !== customerIds[index]"), "invoices of another customer are dropped");
assert.equal(/invoices\.(create|update|pay|finalize|void|del)/.test(service), false, "read-only: no invoice mutation");
assert.ok(service.includes("where: { clientId, status: \"submitted\", facturationsDraftId: { not: null } }"), "Facturations invoices come from this workspace's own requests");
assert.ok(service.includes("result.data.draftId !== request.facturationsDraftId"), "Facturations must answer for the exact recorded draft");
assert.equal(/createFacturationsDraft|reconcileInvoiceRequest|submitInvoiceRequest/.test(service), false, "client page never writes to Facturations");
const checkout = read("src/lib/billing/client-invoices/facturations-checkout.ts");
assert.ok(checkout.startsWith('import "server-only";'));
assert.ok(checkout.includes('where: { id: input.requestId, clientId: input.clientId, status: "submitted", facturationsDraftId: { not: null } }'), "only this workspace's own issued requests can be paid");
assert.ok(checkout.includes("issuance.data.draftId !== request.facturationsDraftId"));
assert.ok(checkout.includes("amountCents: view.amountDueMinor"), "amount comes from Facturations, not the browser");
assert.ok(checkout.includes("idempotencyKey: facturationsCheckoutIdempotencyKey"));
assert.equal(/markPaid|status: "paid"|billingInvoiceRequest\.update/.test(checkout), false, "TAKATAK never marks a Facturations invoice paid");
const checkoutRoute = read("src/app/api/billing/client-invoices/[requestId]/checkout/route.ts");
assert.ok(checkoutRoute.includes('requireWorkspaceApiPermission("manage_settings")'));
assert.ok(checkoutRoute.includes("hasValidWriteOrigin(request)"));
assert.ok(checkoutRoute.includes("clientId: gate.access.activeClientId"));
assert.equal(/request\.(json|text|formData)\(/.test(checkoutRoute), false, "route ignores the request body");
const payButton = read("src/components/billing/facturations-pay-button.tsx");
assert.ok(payButton.includes('url.hostname === "checkout.stripe.com"'));
pass("Payer route is workspace-gated, origin-checked, body-free and server-priced");

const roles = read("src/lib/security/roles.ts");
assert.ok(roles.includes('"/dashboard/invoices": "manage_settings"'));
pass("page is workspace-scoped and permission-gated; service is server-only and read-only");

console.log("\nCLIENT INVOICE CENTER SAFEGUARDS: ALL PASSED");
