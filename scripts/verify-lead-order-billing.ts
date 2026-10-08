// GROUPE TAKATAK Billing — won takatak.ca order lead → billing queue (TK-027).
// Pure logic + static source checks. No database, no network.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { validateInvoiceDraftInput } from "../src/lib/billing/invoices/draft-input";
import {
  allocateDiscount,
  buildLeadOrderDraft,
  leadOrderBlockers,
  leadOrderSourceReference,
  parseLeadOrderBillingBody,
  readLeadOrder,
  torontoDate,
} from "../src/lib/billing/invoices/lead-order-draft";
import { estimateInvoice } from "../src/lib/billing/invoices/preview";
import { isSourceReference } from "../src/lib/billing/invoices/source-apps";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

const order = {
  packageId: "website-starter",
  title: "Website Starter",
  category: "web",
  tierName: "Standard",
  deliveryDays: 14,
  tierPriceCents: 89900,
  addons: [{ label: "Extra page", priceCents: 15000 }, { label: "Logo", priceCents: 9999 }],
  subtotalCents: 114899,
  promoCode: "FIRST10",
  discountCents: 11490,
  totalCents: 103409,
};
const meta = (over: Record<string, unknown> = {}) => ({ origin: "takatak_website", kind: "package_order", order, ...over });

const read = readLeadOrder(meta());
assert.ok(read);
assert.equal(read.totalCents, 103409);
assert.equal(read.addons.length, 2);
for (const bad of [
  null, [], "x",
  meta({ origin: "other_app" }),
  meta({ kind: "project_request" }),
  meta({ order: null }),
  meta({ order: { ...order, totalCents: 103410 } }),
  meta({ order: { ...order, subtotalCents: 114898 } }),
  meta({ order: { ...order, discountCents: 200000 } }),
  meta({ order: { ...order, addons: [{ label: "Extra page", priceCents: -1 }] } }),
  meta({ order: { ...order, tierPriceCents: 1.5 } }),
  meta({ order: { ...order, title: "" } }),
]) {
  assert.equal(readLeadOrder(bad), null, JSON.stringify(bad)?.slice(0, 80));
}
pass("only a takatak.ca package order whose stored lines add up to its quoted total can be billed");

const won = { status: "won_internal", name: "Marie Tremblay", company: null, email: "marie@example.test", metadata: meta() };
assert.deepEqual(leadOrderBlockers(won), []);
assert.deepEqual(leadOrderBlockers({ ...won, status: "qualified_internal" }), ["not_won"]);
assert.deepEqual(leadOrderBlockers({ ...won, email: null }), ["no_email"]);
assert.deepEqual(leadOrderBlockers({ ...won, name: " ", company: null }), ["no_name"]);
assert.deepEqual(leadOrderBlockers({ ...won, name: null, company: "Café Tremblay" }), []);
assert.deepEqual(leadOrderBlockers({ ...won, metadata: meta({ kind: "domain_request" }) }), ["not_an_order"]);
pass("the lead must be Won, with a customer email and a name or company");

for (const [prices, discount] of [[[89900, 15000, 9999], 11490], [[1, 1, 1], 2], [[100], 100], [[3333, 3333, 3334], 1000], [[500, 0], 499]] as Array<[number[], number]>) {
  const shares = allocateDiscount(prices, discount);
  assert.equal(shares.reduce((a, b) => a + b, 0), discount, `sum ${prices}`);
  shares.forEach((share, index) => assert.ok(share >= 0 && share <= prices[index], `share ≤ price ${prices}`));
}
assert.deepEqual(allocateDiscount([100, 200], 0), [0, 0]);
pass("a promo discount is spread over the lines to the exact cent, never more than a line's price");

assert.equal(torontoDate(new Date("2026-10-08T03:00:00Z")), "2026-10-07", "dates are Montréal dates (UTC 03:00 is still the day before)");
assert.equal(torontoDate(new Date("2026-10-08T16:00:00Z"), 30), "2026-11-07");
assert.equal(torontoDate(new Date("2026-12-20T16:00:00Z"), 15), "2027-01-04");

const taxes = [{ code: "TPS", label: "TPS 5 %", rateMilliPercent: 5000 }, { code: "TVQ", label: "TVQ 9,975 %", rateMilliPercent: 9975 }];
const draft = buildLeadOrderDraft({ order: read, customer: { name: "Marie Tremblay", email: "marie@example.test" }, taxes, dueInDays: 30, reference: "AB12CD34", now: new Date("2026-10-08T16:00:00Z") });
const valid = validateInvoiceDraftInput(draft);
assert.ok(valid.success, JSON.stringify(valid));
assert.equal(draft.invoiceDate, "2026-10-08");
assert.equal(draft.dueDate, "2026-11-07");
assert.equal(draft.lines.length, 3);
assert.deepEqual(draft.lines.map((line) => [line.quantity, line.unitPriceCents, line.taxable]), [[1, 89900, true], [1, 15000, true], [1, 9999, true]]);
assert.match(draft.lines[0].description, /^Website Starter — Standard \(14 days\)$/);
assert.equal(draft.lines.reduce((sum, line) => sum + line.discountCents, 0), 11490);
const estimate = estimateInvoice(draft);
assert.equal(estimate.subtotalCents, 103409, "invoice subtotal = the total the customer was quoted");
assert.match(draft.notes ?? "", /AB12CD34.*FIRST10/);
assert.deepEqual(draft.taxes, taxes, "taxes are exactly the ones chosen, nothing assumed");
const untaxed = buildLeadOrderDraft({ order: read, customer: { name: "M", email: "m@example.test" }, taxes: [], dueInDays: 0, reference: "R", now: new Date("2026-10-08T16:00:00Z") });
assert.ok(validateInvoiceDraftInput(untaxed).success);
assert.equal(estimateInvoice(untaxed).totalCents, 103409);
pass("the draft has the catalog lines, the quoted subtotal, the chosen taxes and Montréal dates, and passes the queue's validation");

assert.equal(leadOrderSourceReference("1F2C3D4E-0000-4000-8000-000000000001"), "website-order:1f2c3d4e-0000-4000-8000-000000000001");
assert.ok(isSourceReference(leadOrderSourceReference("1f2c3d4e-0000-4000-8000-000000000001")));
pass("one stable source reference per lead (the queue returns the same request on a repeat click)");

assert.deepEqual(parseLeadOrderBillingBody({ dueInDays: 30, taxes }), { ok: true, dueInDays: 30, taxes });
for (const body of [null, [], {}, { dueInDays: 91, taxes: [] }, { dueInDays: -1, taxes: [] }, { dueInDays: 1.5, taxes: [] }, { dueInDays: 30 }, { dueInDays: 30, taxes: [taxes[0], taxes[1], taxes[0], taxes[1]] }, { dueInDays: 30, taxes: [{ code: "TPS" }] }]) {
  assert.equal(parseLeadOrderBillingBody(body).ok, false, JSON.stringify(body));
}
pass("the request body only carries taxes and the payment term; prices never come from the browser");

const root = process.cwd();
const src = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const route = src("src/app/api/admin/billing/lead-orders/[leadId]/route.ts");
assert.ok(route.includes("requirePlatformAdminApiAccess()"), "platform owner/admin only");
assert.ok(route.includes("readJsonBody(request)"), "origin-checked, size-capped body");
assert.ok(route.includes("isLeadId(leadId)"));
const service = src("src/lib/billing/invoices/lead-order-service.ts");
assert.ok(service.startsWith('import "server-only";'));
assert.ok(service.includes("enqueueInvoiceRequest("), "goes through the central billing queue, never straight to Facturations");
assert.ok(service.includes("clientId: null"), "a website guest is not attached to some workspace");
assert.ok(!/fetch\(|facturations\/client/.test(service), "no direct Facturations call");
const page = src("src/app/dashboard/leads/[id]/page.tsx");
assert.ok(page.includes('platform.mode === "authorized"'), "the invoice card shows to platform admins only");
const form = src("src/components/billing/lead-order-billing-form.tsx");
assert.ok(form.includes("useState<string[]>([])"), "no tax is pre-checked");
pass("route is platform-admin only and origin-checked; the service only uses the billing queue; no tax pre-selected");

console.log("\nLEAD ORDER → FACTURATIONS DRAFT SAFEGUARDS: ALL PASSED");
