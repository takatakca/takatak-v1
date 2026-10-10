// GROUPE TAKATAK Billing — won takatak.ca order lead → billing queue (TK-027)
// against a real database (ephemeral CI Postgres or local). Synthetic data
// only; refuses non-loopback databases. No network, no Facturations call.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createInvoiceRequestFromLeadOrder, getLeadOrderBilling } from "@/lib/billing/invoices/lead-order-service";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

const order = {
  packageId: "website-starter",
  title: "Website Starter",
  category: "web",
  tierName: "Standard",
  deliveryDays: 14,
  tierPriceCents: 89900,
  addons: [{ label: "Extra page", priceCents: 15000 }],
  subtotalCents: 104900,
  promoCode: "FIRST10",
  discountCents: 10490,
  totalCents: 94410,
};
const taxes = [{ code: "TPS", label: "TPS 5 %", rateMilliPercent: 5000 }, { code: "TVQ", label: "TVQ 9,975 %", rateMilliPercent: 9975 }];

async function expectServiceError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof ServiceError && error.code === code);
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  }
  const prisma = getPrisma()!;
  const agency = await prisma.client.create({ data: { name: `Agency ${randomUUID()}` } });
  const actor = await prisma.profile.create({ data: { authUserId: randomUUID(), email: `billing-${randomUUID()}@example.test` } });
  const lead = (status: "won_internal" | "qualified_internal", metadata: object, email: string | null = "marie@example.test") =>
    prisma.lead.create({ data: { clientId: agency.id, name: "Marie Tremblay", email, status, priority: "high", valueCents: 94410, metadata } });
  const metadata = { origin: "takatak_website", kind: "package_order", order };

  const qualified = await lead("qualified_internal", metadata);
  await expectServiceError(createInvoiceRequestFromLeadOrder({ leadId: qualified.id, profileId: actor.id, taxes, dueInDays: 30 }), "conflict");
  const project = await lead("won_internal", { origin: "takatak_website", kind: "project_request", project: { title: "X" } });
  await expectServiceError(createInvoiceRequestFromLeadOrder({ leadId: project.id, profileId: actor.id, taxes, dueInDays: 30 }), "conflict");
  const noEmail = await lead("won_internal", metadata, null);
  await expectServiceError(createInvoiceRequestFromLeadOrder({ leadId: noEmail.id, profileId: actor.id, taxes, dueInDays: 30 }), "conflict");
  await expectServiceError(createInvoiceRequestFromLeadOrder({ leadId: randomUUID(), profileId: actor.id, taxes, dueInDays: 30 }), "not_found");
  assert.equal(await prisma.billingInvoiceRequest.count({ where: { sourceReference: { in: [qualified.id, project.id, noEmail.id].map((id) => `website-order:${id}`) } } }), 0);
  assert.equal(await getLeadOrderBilling(project.id), null, "a non-order lead has no invoice card");
  console.log("PASS a lead that is not Won, not an order, or has no email is refused and queues nothing");

  const won = await lead("won_internal", metadata);
  const before = await getLeadOrderBilling(won.id);
  assert.ok(before && before.request === null && before.blockers.length === 0);
  const now = new Date("2026-10-08T16:00:00Z");
  const first = await createInvoiceRequestFromLeadOrder({ leadId: won.id, profileId: actor.id, taxes, dueInDays: 30, now });
  assert.equal(first.created, true);
  assert.equal(first.request.status, "pending", "queued for owner review; nothing is sent to Facturations yet");
  assert.equal(first.request.sourceApp, "takatak_core");
  assert.equal(first.request.sourceReference, `website-order:${won.id}`);
  assert.equal(first.request.clientId, null);
  assert.equal(first.request.customerName, "Marie Tremblay");
  assert.equal(first.request.dueDate, "2026-11-07");
  // 94410 + TPS 4720.5→4721 + TVQ 9417.40→9417 = 108548
  assert.equal(first.request.estimatedTotalCents, "108548");
  const row = await prisma.billingInvoiceRequest.findUniqueOrThrow({ where: { id: first.request.id } });
  const stored = row.draft as { lines: Array<{ unitPriceCents: number; discountCents: number }>; taxes: unknown[]; customer: { email: string } };
  assert.deepEqual(stored.lines.map((line) => line.unitPriceCents), [89900, 15000]);
  assert.equal(stored.lines.reduce((sum, line) => sum + line.discountCents, 0), 10490);
  assert.deepEqual(stored.taxes, taxes);
  assert.equal(stored.customer.email, "marie@example.test");
  assert.equal(row.createdByProfileId, actor.id);
  console.log("PASS a won order becomes one pending billing request with the catalog lines, the promo, the chosen taxes and the actor");

  const again = await createInvoiceRequestFromLeadOrder({ leadId: won.id, profileId: actor.id, taxes, dueInDays: 30, now });
  assert.equal(again.created, false);
  assert.equal(again.request.id, first.request.id);
  await expectServiceError(createInvoiceRequestFromLeadOrder({ leadId: won.id, profileId: actor.id, taxes: [taxes[0]], dueInDays: 30, now }), "conflict");
  assert.equal(await prisma.billingInvoiceRequest.count({ where: { sourceReference: `website-order:${won.id}` } }), 1);
  console.log("PASS a repeat click returns the same request; a different draft for the same order is refused, never a second invoice");

  const activities = await prisma.leadActivity.findMany({ where: { leadId: won.id } });
  assert.equal(activities.length, 1, "one history entry, written only when the request is created");
  assert.equal((activities[0].metadata as { billingInvoiceRequestId?: string }).billingInvoiceRequestId, first.request.id);
  const audits = await prisma.auditLog.count({ where: { entityId: first.request.id, action: "billing.invoice_request.created" } });
  assert.equal(audits, 1);
  const after = await getLeadOrderBilling(won.id);
  assert.equal(after?.request?.id, first.request.id, "the lead page shows the request");
  console.log("PASS the lead history and the audit log record the request once; the lead page shows its status");
}

main().then(() => process.exit(0), (e) => { console.error(String(e?.stack ?? e).slice(0, 1500)); process.exit(1); });
