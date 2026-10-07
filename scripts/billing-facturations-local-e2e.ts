// GROUPE TAKATAK Billing — opt-in local end-to-end test against a REAL
// Facturations server (takatakca/Facturations) and a disposable local
// TAKATAK database. Never runs in CI and refuses non-loopback targets.
//
// Setup (all local, synthetic data only):
//   1. Disposable PostgreSQL with TAKATAK migrations applied (DATABASE_URL on
//      localhost/127.0.0.1).
//   2. Facturations on 127.0.0.1 with its own disposable test database and
//      FACTURATIONS_INTEGRATION_ENABLED=1, FACTURATIONS_INTEGRATION_WRITES_ENABLED=1
//      and matching issuer/audience/HMAC secret/WAVE_BUSINESS_ID.
//   3. BILLING_E2E_CONFIRM_LOCAL=1 plus the FACTURATIONS_* variables, then:
//      npx tsx --require ./scripts/register-server-only.cjs scripts/billing-facturations-local-e2e.ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { enqueueInvoiceRequest, submitInvoiceRequest, cancelInvoiceRequest, reconcileInvoiceRequest, listInvoiceRequests, countInvoiceRequestsByStatus } from "@/lib/billing/invoices/invoice-request-service";
import { createFacturationsDraft, getFacturationsCapabilities, getFacturationsDashboard, listFacturationsDrafts, getFacturationsDraftWorkflow } from "@/lib/integrations/facturations/client";
import { resolveFacturationsActor } from "@/lib/integrations/facturations/actor";
import { validateInvoiceDraftInput } from "@/lib/billing/invoices/draft-input";


function assertLocalTargets(): void {
  const isLoopback = (value: string | undefined) => {
    try {
      const { hostname } = new URL(value ?? "");
      return hostname === "localhost" || hostname === "127.0.0.1";
    } catch {
      return false;
    }
  };

  if (process.env.BILLING_E2E_CONFIRM_LOCAL !== "1") {
    throw new Error("Set BILLING_E2E_CONFIRM_LOCAL=1 to run this local-only end-to-end test.");
  }

  if (!isLoopback(process.env.DATABASE_URL) || !isLoopback(process.env.FACTURATIONS_ORIGIN)) {
    throw new Error("Refusing to run: DATABASE_URL and FACTURATIONS_ORIGIN must be loopback.");
  }
}

const ok = (m: string) => console.log("PASS ", m);
const draft = (name: string, cents = 10000) => ({
  currency: "CAD", customer: { name, email: `${name.toLowerCase().replace(/\W/g, "")}@example.test`, address: null },
  invoiceDate: "2026-10-06", dueDate: "2026-10-21", notes: null,
  lines: [{ description: "Service", quantity: 1, unitPriceCents: cents, discountCents: 0, taxable: true }],
  taxes: [{ code: "GST", label: "TPS / GST", rateMilliPercent: 5000 }, { code: "QST", label: "TVQ / QST", rateMilliPercent: 9975 }],
});

async function main() {
  assertLocalTargets();
  const businessId = process.env.FACTURATIONS_BUSINESS_ID;
  const prisma = getPrisma()!;
  const profile = await prisma.profile.create({ data: { authUserId: randomUUID(), email: `owner-${randomUUID()}@example.test`, role: "owner", status: "active" } });
  const admin = await prisma.profile.create({ data: { authUserId: randomUUID(), email: `admin-${randomUUID()}@example.test`, role: "admin", status: "active" } });
  const owner = (await resolveFacturationsActor({ profileId: profile.id, platformRole: "owner" }))!;
  const staff = (await resolveFacturationsActor({ profileId: admin.id, platformRole: "admin" }))!;
  assert.equal(owner.role, "OWNER"); assert.equal(staff.role, "STAFF");
  assert.equal(await resolveFacturationsActor({ profileId: profile.id, platformRole: "user" }), null);
  ok("actors resolved: owner=OWNER, admin=STAFF, user=none");

  const caps = await getFacturationsCapabilities(owner);
  assert.ok(caps.ok, JSON.stringify(caps)); assert.equal(caps.data.capabilities.draftWrite, true);
  assert.equal(caps.data.capabilities.issuanceAuthorizationWrite, false);
  const staffCaps = await getFacturationsCapabilities(staff);
  assert.ok(staffCaps.ok); assert.equal(staffCaps.data.capabilities.customersRead, false);
  ok("live Facturations accepted TAKATAK-signed OWNER and STAFF identities");

  const ref = `manual:${randomUUID()}`;
  const first = await enqueueInvoiceRequest({ sourceApp: "manual", sourceReference: ref, clientId: null, draft: draft("Example Customer") as any }, { profileId: profile.id });
  assert.equal(first.created, true); assert.equal(first.request.estimatedTotalCents, "11498");
  const again = await enqueueInvoiceRequest({ sourceApp: "manual", sourceReference: ref, clientId: null, draft: draft("Example Customer") as any }, { profileId: profile.id });
  assert.equal(again.created, false); assert.equal(again.request.id, first.request.id);
  await assert.rejects(enqueueInvoiceRequest({ sourceApp: "manual", sourceReference: ref, clientId: null, draft: draft("Example Customer", 20000) as any }, { profileId: profile.id }), /different invoice request/);
  await assert.rejects(enqueueInvoiceRequest({ sourceApp: "manual", sourceReference: "m:bad", clientId: null, draft: { ...draft("X"), currency: "USD" } as any }, { profileId: profile.id }), /Correct the highlighted/);
  ok("enqueue is idempotent per source reference; changed draft = conflict; invalid draft refused");

  await assert.rejects(submitInvoiceRequest(first.request.id, { profileId: admin.id, actor: staff }), /platform owner/);
  ok("STAFF cannot send requests to Facturations");

  const sent = await submitInvoiceRequest(first.request.id, { profileId: profile.id, actor: owner });
  assert.equal(sent.outcome, "submitted", JSON.stringify(sent));
  assert.ok(sent.request.facturationsDraftId); assert.equal(sent.request.facturationsTotalCents, "11498");
  ok(`submitted → Facturations DRAFT ${sent.request.facturationsDraftId} with matching total 114.98 CAD`);

  await assert.rejects(submitInvoiceRequest(first.request.id, { profileId: profile.id, actor: owner }), /cannot be sent while submitted/);
  await assert.rejects(cancelInvoiceRequest(first.request.id, profile.id), /cannot be cancelled while submitted/);
  ok("submitted request is final (no resend, no cancel)");

  const race = await enqueueInvoiceRequest({ sourceApp: "manual", sourceReference: `manual:${randomUUID()}`, clientId: null, draft: draft("Race Example", 3333) as any }, { profileId: profile.id });
  const raced = await Promise.allSettled([1, 2, 3].map(() => submitInvoiceRequest(race.request.id, { profileId: profile.id, actor: owner })));
  const winners = raced.filter((r) => r.status === "fulfilled" && (r.value as any).outcome === "submitted");
  const losers = raced.filter((r) => r.status === "rejected" && /already being sent|cannot be sent while submitted/.test(String((r as PromiseRejectedResult).reason)));
  assert.equal(winners.length, 1, JSON.stringify(raced.map((r) => r.status)));
  assert.equal(losers.length, 2);
  const raceRow = await prisma.billingInvoiceRequest.findUniqueOrThrow({ where: { id: race.request.id } });
  assert.equal(raceRow.submitAttempts, 1);
  ok("3 simultaneous sends → exactly one reaches Facturations; the others are refused");

  const wf = await getFacturationsDraftWorkflow(owner, sent.request.facturationsDraftId!);
  assert.ok(wf.ok); assert.equal(wf.data.internalApproval, "NOT_APPROVED"); assert.equal(wf.data.nextStep, "STANDALONE_OWNER_REVIEW");
  ok("Facturations workflow: DRAFT, NOT_APPROVED, next step is standalone owner review");

  // Timeout simulation: Facturations created the draft but TAKATAK never saw the answer.
  const ref2 = `rentauto-booking:${randomUUID()}`;
  const second = await enqueueInvoiceRequest({ sourceApp: "rentauto", sourceReference: ref2, clientId: null, draft: draft("Renter Example", 4550) as any }, { profileId: null });
  const row2 = await prisma.billingInvoiceRequest.findUniqueOrThrow({ where: { id: second.request.id } });
  const lost = await createFacturationsDraft(owner, (validateInvoiceDraftInput(row2.draft) as any).data, row2.idempotencyKey);
  assert.ok(lost.ok);
  const retried = await submitInvoiceRequest(second.request.id, { profileId: profile.id, actor: owner });
  assert.equal(retried.outcome, "submitted"); assert.equal(retried.request.facturationsDraftId, lost.data.id);
  ok("retry after a lost response returns the SAME Facturations draft (no duplicate invoice)");

  // Facturations unreachable → failed (retryable), later retry succeeds.
  const ref3 = `ahmv-membership:${randomUUID()}`;
  const third = await enqueueInvoiceRequest({ sourceApp: "ahmv", sourceReference: ref3, clientId: null, draft: draft("Parent Example", 12000) as any }, { profileId: null });
  const goodOrigin = process.env.FACTURATIONS_ORIGIN;
  process.env.FACTURATIONS_ORIGIN = "http://127.0.0.1:1";
  const down = await submitInvoiceRequest(third.request.id, { profileId: profile.id, actor: owner });
  assert.equal(down.outcome, "failed"); assert.equal(down.request.status, "failed"); assert.equal(down.request.lastErrorCode, "NETWORK_ERROR");
  await assert.rejects(cancelInvoiceRequest(third.request.id, profile.id), /draft may exist/);
  process.env.FACTURATIONS_ORIGIN = goodOrigin;
  const back = await submitInvoiceRequest(third.request.id, { profileId: profile.id, actor: owner });
  assert.equal(back.outcome, "submitted"); assert.equal(back.request.submitAttempts, 2);
  ok("Facturations down → failed (retryable, NOT cancellable); retry succeeds on attempt 2");

  // 409: the request's key is already bound to a different draft in Facturations.
  const conflictReq = await enqueueInvoiceRequest({ sourceApp: "manual", sourceReference: `manual:${randomUUID()}`, clientId: null, draft: draft("Conflict Example", 7000) as any }, { profileId: profile.id });
  const conflictRow = await prisma.billingInvoiceRequest.findUniqueOrThrow({ where: { id: conflictReq.request.id } });
  const squatter = await createFacturationsDraft(owner, (validateInvoiceDraftInput(draft("Someone Else", 1)) as any).data, conflictRow.idempotencyKey);
  assert.ok(squatter.ok);
  const conflicted = await submitInvoiceRequest(conflictReq.request.id, { profileId: profile.id, actor: owner });
  assert.equal(conflicted.outcome, "failed"); assert.equal(conflicted.request.status, "needs_reconciliation"); assert.equal((conflicted as any).code, "IDEMPOTENCY_CONFLICT");
  await assert.rejects(cancelInvoiceRequest(conflictReq.request.id, profile.id), /cannot be cancelled/);
  await assert.rejects(submitInvoiceRequest(conflictReq.request.id, { profileId: profile.id, actor: owner }), /cannot be sent while needs_reconciliation/);
  await assert.rejects(reconcileInvoiceRequest(conflictReq.request.id, squatter.data.id, { profileId: profile.id, actor: owner }), /does not match/);
  await assert.rejects(reconcileInvoiceRequest(conflictReq.request.id, sent.request.facturationsDraftId!, { profileId: profile.id, actor: owner }), /does not match|already linked/);
  await assert.rejects(reconcileInvoiceRequest(conflictReq.request.id, randomUUID(), { profileId: profile.id, actor: owner }), /could not be loaded/);
  await assert.rejects(reconcileInvoiceRequest(conflictReq.request.id, squatter.data.id, { profileId: admin.id, actor: staff }), /platform owner/);
  const matching = await createFacturationsDraft(owner, (validateInvoiceDraftInput(draft("Conflict Example", 7000)) as any).data, `tkb1_manual_match_${randomUUID().replace(/-/g, "")}`);
  assert.ok(matching.ok);
  const linked = await reconcileInvoiceRequest(conflictReq.request.id, matching.data.id, { profileId: profile.id, actor: owner });
  assert.equal(linked.status, "submitted"); assert.equal(linked.facturationsDraftId, matching.data.id);
  ok("409 → needs_reconciliation (not cancellable/resendable); only a verified matching draft can be linked, by the OWNER");

  // Wrong shared secret → rejected, final.
  const ref4 = `manual:${randomUUID()}`;
  const fourth = await enqueueInvoiceRequest({ sourceApp: "manual", sourceReference: ref4, clientId: null, draft: draft("Wrong Secret", 100) as any }, { profileId: profile.id });
  const goodSecret = process.env.FACTURATIONS_INTEGRATION_HMAC_SECRET;
  process.env.FACTURATIONS_INTEGRATION_HMAC_SECRET = "a-different-secret-that-is-long-enough-123";
  const badAuth = await submitInvoiceRequest(fourth.request.id, { profileId: profile.id, actor: owner });
  assert.equal(badAuth.outcome, "failed"); assert.equal(badAuth.request.status, "pending"); assert.equal(badAuth.request.lastErrorCode, "INVALID_INTEGRATION_TOKEN");
  process.env.FACTURATIONS_INTEGRATION_HMAC_SECRET = goodSecret;
  const fixed = await submitInvoiceRequest(fourth.request.id, { profileId: profile.id, actor: owner });
  assert.equal(fixed.outcome, "submitted");
  ok("wrong shared secret → Facturations 401 → request stays pending; sends once config is fixed");

  // Wrong business configured on TAKATAK side.
  process.env.FACTURATIONS_BUSINESS_ID = "some-other-business";
  const wrongBiz = await getFacturationsDashboard(owner);
  assert.equal(wrongBiz.ok, false); assert.equal((wrongBiz as any).code, "INVALID_INTEGRATION_CLAIMS");
  process.env.FACTURATIONS_BUSINESS_ID = businessId;
  ok("mismatched business id is refused by Facturations");

  const dash = await getFacturationsDashboard(owner);
  assert.ok(dash.ok); assert.equal(dash.data.status, "DRAFTS_ONLY");
  const drafts = await listFacturationsDrafts(staff, 1, 20);
  assert.ok(drafts.ok); assert.ok(drafts.data.drafts.length >= 3);
  ok(`dashboard DRAFTS_ONLY: ${dash.data.draftCount} drafts, ${dash.data.draftTotalCents} cents; STAFF can list drafts`);

  // DB guards.
  await assert.rejects(prisma.billingInvoiceRequest.update({ where: { id: second.request.id }, data: { draftHash: "0".repeat(64) } }), /immutable/);
  await assert.rejects(prisma.billingInvoiceRequest.update({ where: { id: second.request.id }, data: { status: "pending", facturationsDraftId: null, submittedAt: null } }), /final state/);
  await assert.rejects(prisma.billingInvoiceRequest.delete({ where: { id: second.request.id } }), /cannot be deleted/);
  const probe = await enqueueInvoiceRequest({ sourceApp: "manual", sourceReference: `manual:${randomUUID()}`, clientId: null, draft: draft("Probe", 100) as any }, { profileId: profile.id });
  await assert.rejects(prisma.billingInvoiceRequest.update({ where: { id: probe.request.id }, data: { status: "submitted" } }), /submitted_has_draft|check constraint/i);
  await cancelInvoiceRequest(probe.request.id, profile.id);
  ok("database refuses rewriting fed drafts, reopening submitted rows, deletes and inconsistent states");

  const ref5 = `manual:${randomUUID()}`;
  const fifth = await enqueueInvoiceRequest({ sourceApp: "manual", sourceReference: ref5, clientId: null, draft: draft("Cancel Me", 100) as any }, { profileId: profile.id });
  const cancelled = await cancelInvoiceRequest(fifth.request.id, profile.id);
  assert.equal(cancelled.status, "cancelled");
  await assert.rejects(submitInvoiceRequest(fifth.request.id, { profileId: profile.id, actor: owner }), /cannot be sent while cancelled/);
  ok("cancelled request can never be sent");

  const counts = await countInvoiceRequestsByStatus();
  const list = await listInvoiceRequests({ take: 10 });
  const audit = await prisma.auditLog.count({ where: { entityType: "billing_invoice_request" } });
  console.log("counts", JSON.stringify(counts), "listed", list.length, "audit entries", audit);
  assert.ok(audit >= 9);
  ok("every queue action is audit-logged");
  console.log("\nE2E TAKATAK → FACTURATIONS: ALL PASSED");
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
