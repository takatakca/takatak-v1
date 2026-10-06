// GROUPE TAKATAK Billing — client invoice center safeguards.
// Pure logic + static source checks. No database, no network.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
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

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const page = read("src/app/dashboard/invoices/page.tsx");
assert.ok(page.includes('requireWorkspacePermission("manage_settings", "/dashboard/invoices")'));
assert.ok(page.includes("getClientInvoices(access.activeClientId)"));
assert.equal(/searchParams|params\b/.test(page), false, "page never takes a customer or client from the URL");
assert.ok(page.includes('rel="noopener noreferrer"'));
const service = read("src/lib/billing/client-invoices/client-invoice-service.ts");
assert.ok(service.startsWith('import "server-only";'));
assert.ok(service.includes("where: { clientId }"), "customer ids come from this workspace's rows only");
assert.ok(service.includes("owner !== customerIds[index]"), "invoices of another customer are dropped");
assert.equal(/invoices\.(create|update|pay|finalize|void|del)/.test(service), false, "read-only: no invoice mutation");
const roles = read("src/lib/security/roles.ts");
assert.ok(roles.includes('"/dashboard/invoices": "manage_settings"'));
pass("page is workspace-scoped and permission-gated; service is server-only and read-only");

console.log("\nCLIENT INVOICE CENTER SAFEGUARDS: ALL PASSED");
