// Client invoicing (Stripe Connect) safeguards.
// Pure logic + static source checks. No database, no network.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildAccountLinkParams,
  buildConnectAccountCreateParams,
  clientConnectState,
  connectAccountIdempotencyKey,
  readConnectFlags,
  safeOnboardingUrl,
} from "../src/lib/billing/client-invoicing/connect-policy";
import {
  estimateClientInvoice,
  stripePercentage,
  validateClientInvoiceInput,
} from "../src/lib/billing/client-invoicing/invoice-input";
import {
  canActOnClientInvoice,
  clientInvoiceActionKey,
  filterClientIssuedInvoices,
  isStripeInvoiceId,
  parseClientInvoiceAction,
  parseClientInvoiceFilter,
  summarizeClientIssuedInvoices,
} from "../src/lib/billing/client-invoicing/invoice-actions";
import { clientInvoiceContentHash, clientInvoiceIdempotencyKey } from "../src/lib/billing/client-invoicing/invoice-keys";
import type { ClientInvoiceView } from "../src/lib/billing/client-invoices/invoice-view";

import { readBoundedText } from "../src/lib/http/read-bounded-text";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

const created = buildConnectAccountCreateParams({ clientId: "client-1", email: "owner@example.test" });
assert.equal(created.country, "CA");
assert.deepEqual(created.controller, {
  stripe_dashboard: { type: "full" },
  fees: { payer: "account" },
  losses: { payments: "stripe" },
  requirement_collection: "stripe",
});
assert.deepEqual(created.metadata, { takatak_client_id: "client-1" });
assert.equal(created.email, "owner@example.test");
assert.equal("email" in buildConnectAccountCreateParams({ clientId: "c", email: "not an email" }), false);
pass("connected account is the client's own (full Stripe dashboard, client pays fees, Stripe collects requirements)");

const link = buildAccountLinkParams({ accountId: "acct_TEST123456", origin: "https://app.takatak.ca/x?y=1" });
assert.equal(link.type, "account_onboarding");
assert.equal(link.return_url, "https://app.takatak.ca/dashboard/client-billing?connect=return");
assert.equal(link.refresh_url, "https://app.takatak.ca/dashboard/client-billing?connect=refresh");
assert.throws(() => buildAccountLinkParams({ accountId: "cus_123456", origin: "https://app.takatak.ca" }), TypeError);
assert.equal(safeOnboardingUrl("https://connect.stripe.com/setup/s/acct_x/abc"), "https://connect.stripe.com/setup/s/acct_x/abc");
for (const url of ["http://connect.stripe.com/setup", "https://connect.stripe.com.evil.example/", "https://evil.example/", "javascript:alert(1)", null]) {
  assert.equal(safeOnboardingUrl(url), null);
}
pass("onboarding returns to the client billing page; only Stripe-hosted HTTPS onboarding URLs are followed");

const key = connectAccountIdempotencyKey("client-1");
assert.match(key, /^tkconnect1_[A-Za-z0-9_-]{43}$/);
assert.equal(connectAccountIdempotencyKey("client-1"), key);
assert.notEqual(connectAccountIdempotencyKey("client-2"), key);
pass("one Stripe account per workspace even on simultaneous clicks");

assert.deepEqual(readConnectFlags({ id: "acct_x", charges_enabled: true, payouts_enabled: true, details_submitted: true, country: "ca", default_currency: "CAD" }),
  { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true, country: "CA", defaultCurrency: "cad" });
assert.deepEqual(readConnectFlags({ id: "acct_x", charges_enabled: "yes" as never, country: "Canada", default_currency: "dollars" }),
  { chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false, country: null, defaultCurrency: null });
assert.equal(clientConnectState(null), "not_connected");
assert.equal(clientConnectState({ chargesEnabled: false, detailsSubmitted: false }), "onboarding");
assert.equal(clientConnectState({ chargesEnabled: true, detailsSubmitted: false }), "onboarding");
assert.equal(clientConnectState({ chargesEnabled: false, detailsSubmitted: true }), "restricted");
assert.equal(clientConnectState({ chargesEnabled: true, detailsSubmitted: true }), "active");
pass("account flags are strictly read; only submitted + charges-enabled is active");

const good = {
  reference: "55555555-5555-4555-8555-555555555555",
  customer: { name: "  Café Exemple  ", email: "Compta@Example.TEST" },
  lines: [{ description: "Service", quantity: 2, unitAmountCents: 5000 }, { description: "Frais", quantity: 1, unitAmountCents: 1999 }],
  taxRates: [{ displayName: "TPS", percentMilli: 5000 }, { displayName: "TVQ", percentMilli: 9975 }],
  daysUntilDue: 30,
  memo: "Merci!",
};
const ok = validateClientInvoiceInput(good);
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.value.customer.name, "Café Exemple");
  assert.equal(ok.value.customer.email, "compta@example.test");
  const estimate = estimateClientInvoice(ok.value);
  assert.equal(estimate.subtotalCents, 11999);
  assert.deepEqual(estimate.taxes.map((t) => t.amountCents), [600, 1197]);
  assert.equal(estimate.totalCents, 13796);
}
assert.equal(stripePercentage(9975), 9.975);
const invalid = (patch: Record<string, unknown>) => validateClientInvoiceInput({ ...good, ...patch }).ok;
for (const patch of [
  { reference: "nope" },
  { customer: { name: "", email: "a@b.test" } },
  { customer: { name: "X", email: "not-an-email" } },
  { customer: { name: "Bad\u0000name", email: "a@b.test" } },
  { lines: [] },
  { lines: Array.from({ length: 26 }, () => good.lines[0]) },
  { lines: [{ description: "x", quantity: 0, unitAmountCents: 100 }] },
  { lines: [{ description: "x", quantity: 1.5, unitAmountCents: 100 }] },
  { lines: [{ description: "x", quantity: 1, unitAmountCents: -5 }] },
  { lines: [{ description: "x", quantity: 10_000, unitAmountCents: 99_999 }] },
  { taxRates: [{ displayName: "TPS", percentMilli: 0 }] },
  { taxRates: [{ displayName: "TPS", percentMilli: 30_001 }] },
  { taxRates: [{ displayName: "<b>", percentMilli: 5000 }] },
  { taxRates: [{ displayName: "TPS", percentMilli: 5000 }, { displayName: "tps", percentMilli: 5000 }] },
  { taxRates: "TPS" },
  { daysUntilDue: 0 },
  { daysUntilDue: 91 },
  { memo: "x".repeat(501) },
  { lines: [{ description: "x", quantity: 1, unitAmountCents: 99_999_999 }], taxRates: [{ displayName: "T", percentMilli: 5000 }] },
]) {
  assert.equal(invalid(patch), false, JSON.stringify(patch).slice(0, 80));
}
assert.equal(validateClientInvoiceInput(null).ok, false);
assert.equal(invalid({ taxRates: [], memo: null }), true);
pass("client invoice input: CAD integer cents, bounded lines/taxes/due date, explicit tax rates, no control characters");

const k1 = clientInvoiceIdempotencyKey("client-1", good.reference, "invoice");
assert.match(k1, /^tkcinv1_[A-Za-z0-9_-]{43}$/);
assert.equal(clientInvoiceIdempotencyKey("client-1", good.reference.toUpperCase(), "invoice"), k1);
assert.notEqual(clientInvoiceIdempotencyKey("client-1", good.reference, "line:1"), k1);
assert.notEqual(clientInvoiceIdempotencyKey("client-2", good.reference, "invoice"), k1);
assert.equal(clientInvoiceContentHash({ b: 1, a: [2, { d: 3, c: 4 }] }), clientInvoiceContentHash({ a: [2, { c: 4, d: 3 }], b: 1 }));
assert.notEqual(clientInvoiceContentHash({ a: 1 }), clientInvoiceContentHash({ a: 2 }));
pass("every invoice write has a key per workspace + form reference + contents + step");

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const service = read("src/lib/billing/client-invoicing/connect-service.ts");
assert.ok(service.startsWith('import "server-only";'));
assert.ok(service.includes("idempotencyKey: connectAccountIdempotencyKey(input.clientId)"));
assert.ok(service.includes('error.code !== "P2002"'), "a simultaneous link keeps the stored account");
assert.ok(service.includes("account.id !== row.stripeAccountId"));
assert.ok(service.includes("account.id !== event.account"), "webhook object must be the event's own account");
assert.ok(service.includes("stripeAccountId: account.id,"), "webhook only touches linked accounts");
assert.equal(/charges\.create|paymentIntents|transfers\.create|payouts\.create/.test(service), false, "TAKATAK never moves client funds");
const route = read("src/app/api/billing/client-invoicing/connect/route.ts");
assert.ok(route.includes('requireWorkspaceApiPermission("manage_settings")'));
assert.ok(route.includes("hasValidWriteOrigin(request)"));
assert.ok(route.includes("clientId: gate.access.activeClientId"));
assert.equal(/request\.(json|text|formData)\(/.test(route), false, "route ignores the request body");
const webhook = read("src/app/api/billing/client-invoicing/webhook/route.ts");
assert.ok(webhook.includes("getClientConnectWebhookSecret()"));
assert.ok(webhook.includes("webhooks.constructEvent(rawBody, signature, secret)"));
assert.ok(webhook.includes('event.type !== "account.updated"'));
assert.ok(webhook.includes("readBoundedText(request, MAX_BODY_BYTES)"), "unauthenticated body is read with a streaming cap");
assert.equal(webhook.includes("request.text()"), false);
assert.ok(service.includes("lastStripeEventAt: { lte: eventAt }"), "late, older Connect events never overwrite newer state");
const page = read("src/app/dashboard/client-billing/page.tsx");
assert.ok(page.includes('requireWorkspacePermission("manage_settings", "/dashboard/client-billing")'));
assert.equal(/\bparams\b/.test(page), false);
assert.ok(page.includes('connect === "return" || connect === "refresh"'), "URL only triggers a server-side re-read");
const button = read("src/components/billing/client-connect-button.tsx");
assert.ok(button.includes('url.hostname === "connect.stripe.com"'));
const roles = read("src/lib/security/roles.ts");
assert.ok(roles.includes('"/dashboard/client-billing": "manage_settings"'));
const invoiceService = read("src/lib/billing/client-invoicing/invoice-service.ts");
assert.ok(invoiceService.startsWith('import "server-only";'));
assert.ok(invoiceService.includes('clientConnectState(row) !== "active"'), "invoices only on an active connected account");
assert.equal((invoiceService.match(/\{ stripeAccount, idempotencyKey/g) ?? []).length, 7, "every write is on the connected account with a key");
for (const call of ["sendInvoice(input.invoiceId, {}, options)", "voidInvoice(input.invoiceId, {}, options)", "pay(input.invoiceId, { paid_out_of_band: true }, options)"]) {
  assert.ok(invoiceService.includes(call), `invoice action uses the keyed connected-account options: ${call}`);
}
assert.ok(invoiceService.includes('pending_invoice_items_behavior: "exclude"'));
assert.equal(/application_fee|transfer_data|charges\.create|payouts/.test(invoiceService), false, "no platform fee or fund movement");
const invoiceRoute = read("src/app/api/billing/client-invoicing/invoices/route.ts");
assert.ok(invoiceRoute.includes('requireWorkspaceApiPermission("manage_settings")'));
assert.ok(invoiceRoute.includes("readJsonBody(request)"), "origin-checked, size-capped body");
assert.ok(invoiceRoute.includes("validateClientInvoiceInput(body.body)"));
assert.ok(invoiceRoute.includes("clientId: gate.access.activeClientId"));
const form = read("src/components/billing/client-invoice-form.tsx");
assert.equal(/node:crypto|invoice-keys|server-only/.test(form), false, "client bundle stays free of server modules");
assert.ok(form.includes("disabled={pending || !confirmed}"), "explicit confirmation before sending");
const env = read("src/lib/billing/client-invoicing/env.ts");
assert.ok(env.includes('CLIENT_INVOICING_ENABLED?.trim() === "1"'), "off unless explicitly enabled");
const migration = read("prisma/migrations/20261006140000_client_stripe_connect_accounts/migration.sql");
for (const needle of [
  "ENABLE ROW LEVEL SECURITY",
  "REVOKE ALL ON TABLE public.client_stripe_connect_accounts FROM anon",
  "REVOKE ALL ON TABLE public.client_stripe_connect_accounts FROM authenticated",
  "rows cannot be deleted",
  "link is immutable",
  "'^acct_[A-Za-z0-9]{6,64}$'",
  "SET search_path = ''",
]) {
  assert.ok(migration.includes(needle), `migration: ${needle}`);
}
pass("routes are workspace-gated and origin-checked; webhook is signed; table is locked down and the link immutable");


// Invoice actions and dashboard summary.
for (const action of ["remind", "void", "mark_paid"]) {
  assert.deepEqual(parseClientInvoiceAction({ action }), { ok: true, action });
}
for (const body of [{ action: "delete" }, { action: "VOID" }, { action: ["void"] }, {}, null, "void", { action: "pay" }]) {
  assert.equal(parseClientInvoiceAction(body).ok, false);
}
assert.ok(isStripeInvoiceId("in_1PqRsTuVwXyZ"));
for (const id of ["in_short", "cus_1PqRsTuVwXyZ", "in_1PqRs/../x", "in_1PqRsTuVwXyZ?x=1", "", 42, `in_${"a".repeat(65)}`]) {
  assert.equal(isStripeInvoiceId(id), false, String(id));
}
assert.deepEqual((["open", "overdue", "paid", "void", "uncollectible", "refunded"] as const).map(canActOnClientInvoice), [true, true, false, false, false, false]);
pass("only remind / void / mark_paid on a well-formed Stripe invoice id; only open or overdue invoices can be acted on");

const morning = new Date("2026-10-08T08:00:00Z");
const evening = new Date("2026-10-08T23:59:00Z");
const nextDay = new Date("2026-10-09T00:01:00Z");
assert.equal(clientInvoiceActionKey("c1", "in_1PqRsTuVwXyZ", "remind", morning), clientInvoiceActionKey("c1", "in_1PqRsTuVwXyZ", "remind", evening));
assert.notEqual(clientInvoiceActionKey("c1", "in_1PqRsTuVwXyZ", "remind", evening), clientInvoiceActionKey("c1", "in_1PqRsTuVwXyZ", "remind", nextDay));
assert.equal(clientInvoiceActionKey("c1", "in_1PqRsTuVwXyZ", "void", morning), clientInvoiceActionKey("c1", "in_1PqRsTuVwXyZ", "void", nextDay));
assert.notEqual(clientInvoiceActionKey("c1", "in_1PqRsTuVwXyZ", "void"), clientInvoiceActionKey("c2", "in_1PqRsTuVwXyZ", "void"));
assert.notEqual(clientInvoiceActionKey("c1", "in_1PqRsTuVwXyZ", "void"), clientInvoiceActionKey("c1", "in_1PqRsTuVwXyz", "void"), "invoice ids stay case-sensitive");
assert.notEqual(clientInvoiceActionKey("c1", "in_1PqRsTuVwXyZ", "void"), clientInvoiceActionKey("c1", "in_1PqRsTuVwXyZ", "mark_paid"));
pass("at most one reminder email per invoice per day; void / mark paid keys never change; keys are per workspace and per invoice");

const now = new Date("2026-10-08T12:00:00Z");
const row = (over: Partial<ClientInvoiceView>): ClientInvoiceView => ({
  id: "in_1PqRsTuVwXyZ", source: "stripe", number: "N-1", description: null, issuedAt: "2026-09-01T00:00:00.000Z", dueAt: null, paidAt: null,
  currency: "CAD", totalMinor: 0, amountDueMinor: 0, amountPaidMinor: 0, status: "open", payUrl: null, pdfUrl: null, checkoutRequestId: null, ...over,
});
const sample = [
  row({ status: "open", amountDueMinor: 11498, totalMinor: 11498 }),
  row({ status: "overdue", amountDueMinor: 5000, totalMinor: 7000, amountPaidMinor: 2000 }),
  row({ status: "paid", amountPaidMinor: 20000, paidAt: "2026-10-01T10:00:00.000Z" }),
  row({ status: "paid", amountPaidMinor: 99999, paidAt: "2026-08-01T10:00:00.000Z" }),
  row({ status: "paid", amountPaidMinor: 777, paidAt: "2026-10-09T10:00:00.000Z" }),
  row({ status: "void", amountDueMinor: 0, totalMinor: 4000 }),
  row({ status: "open", currency: "USD", amountDueMinor: 123456 }),
];
assert.deepEqual(summarizeClientIssuedInvoices(sample, now), {
  currency: "CAD",
  outstandingMinor: 16498,
  outstandingCount: 2,
  overdueMinor: 5000,
  overdueCount: 1,
  paidLast30DaysMinor: 20000,
  paidLast30DaysCount: 1,
  otherCurrencyCount: 1,
});
assert.equal(summarizeClientIssuedInvoices([], now).outstandingMinor, 0);
pass("summary: amount still owed, overdue and paid in the last 30 days; void ignored; other currencies never added to CAD");

assert.deepEqual(filterClientIssuedInvoices(sample, "unpaid").map((i) => i.status), ["open", "overdue", "open"]);
assert.deepEqual(filterClientIssuedInvoices(sample, "overdue").map((i) => i.status), ["overdue"]);
assert.equal(filterClientIssuedInvoices(sample, "paid").length, 3);
assert.equal(filterClientIssuedInvoices(sample, "all").length, sample.length);
for (const value of ["unpaid", "overdue", "paid", "all"]) assert.equal(parseClientInvoiceFilter(value), value);
for (const value of [undefined, ["paid"], "PAID", "x"]) assert.equal(parseClientInvoiceFilter(value), "all");
pass("invoice list filters: to collect, overdue, paid; unknown filter shows everything");

const actionRoute = read("src/app/api/billing/client-invoicing/invoices/[invoiceId]/route.ts");
assert.ok(actionRoute.includes('requireWorkspaceApiPermission("manage_settings")'), "action route is workspace-gated");
assert.ok(actionRoute.includes("readJsonBody(request)"), "action route checks the write origin");
assert.ok(actionRoute.includes("isStripeInvoiceId(invoiceId)"), "action route validates the invoice id");
assert.ok(actionRoute.includes("gate.access.activeClientId"), "action uses the active workspace, never the request");
const actionService = read("src/lib/billing/client-invoicing/invoice-service.ts");
assert.ok(actionService.includes("stripe.invoices.retrieve(input.invoiceId, {}, { stripeAccount })"), "invoice re-read from the workspace's own account");
assert.ok(actionService.includes("paid_out_of_band: true"), "mark paid never charges the customer");
assert.ok(actionService.includes("auditLog.create"), "every action is audit-logged");
const nav = read("src/lib/dashboard/dashboard-config.ts");
assert.ok(nav.includes('href: "/dashboard/client-billing"'), "client billing is reachable from the sidebar");
pass("action route is workspace-gated and origin-checked; invoice re-read on the workspace's account; audited; in the sidebar");

async function boundedBodyChecks() {
  const chunked = (parts: string[]) => new Request("https://takatak.test/x", {
    method: "POST",
    body: new ReadableStream({ start(controller) { for (const part of parts) controller.enqueue(new TextEncoder().encode(part)); controller.close(); } }),
    duplex: "half",
  } as RequestInit);
  assert.equal(await readBoundedText(chunked(["{\"a\":", "1}"]), 100), '{"a":1}');
  assert.equal(await readBoundedText(chunked(["x".repeat(60), "x".repeat(60)]), 100), null, "chunked body over the cap without Content-Length");
  assert.equal(await readBoundedText(new Request("https://takatak.test/x", { method: "POST", body: "é".repeat(60) }), 100), null, "cap is in bytes, not characters");
  assert.equal(await readBoundedText(new Request("https://takatak.test/x", { method: "POST", body: "ok" }), 100), "ok");
  pass("request bodies are read with a streaming byte cap (no unbounded buffering)");
}

boundedBodyChecks().then(() => console.log("\nCLIENT INVOICING (STRIPE CONNECT) SAFEGUARDS: ALL PASSED"), (error) => { console.error(error); process.exit(1); });
