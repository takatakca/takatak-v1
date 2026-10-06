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
import { clientInvoiceIdempotencyKey } from "../src/lib/billing/client-invoicing/invoice-keys";

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
pass("every invoice write has a key per workspace + form reference + step");

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const service = read("src/lib/billing/client-invoicing/connect-service.ts");
assert.ok(service.startsWith('import "server-only";'));
assert.ok(service.includes("idempotencyKey: connectAccountIdempotencyKey(input.clientId)"));
assert.ok(service.includes('error.code !== "P2002"'), "a simultaneous link keeps the stored account");
assert.ok(service.includes("account.id !== row.stripeAccountId"));
assert.ok(service.includes("account.id !== event.account"), "webhook object must be the event's own account");
assert.ok(service.includes("where: { stripeAccountId: account.id }"), "webhook only touches linked accounts");
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
assert.equal((invoiceService.match(/\{ stripeAccount, idempotencyKey/g) ?? []).length, 6, "every write is on the connected account with a key");
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

console.log("\nCLIENT INVOICING (STRIPE CONNECT) SAFEGUARDS: ALL PASSED");
