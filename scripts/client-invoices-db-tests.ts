// GROUPE TAKATAK Billing — client invoice center against a real database
// (ephemeral CI Postgres or local) with an in-memory fake Stripe client.
// Synthetic data only; refuses non-loopback databases.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { getClientInvoices } from "@/lib/billing/client-invoices/client-invoice-service";

const s = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const calls: string[] = [];
function inv(id: string, customer: string, status: string, extra: Record<string, unknown> = {}) {
  return { id, customer, status, number: id.toUpperCase(), description: null, created: s("2026-09-01T00:00:00Z"), due_date: s("2026-09-15T00:00:00Z"),
    currency: "cad", total: 6899, amount_due: 6899, amount_paid: status === "paid" ? 6899 : 0, amount_remaining: status === "paid" ? 0 : 6899,
    status_transitions: { paid_at: status === "paid" ? s("2026-09-02T00:00:00Z") : null },
    hosted_invoice_url: "https://invoice.stripe.com/i/acct/x", invoice_pdf: "https://pay.stripe.com/invoice/acct/x/pdf", ...extra };
}
(globalThis as any).socialStripe = { invoices: { list: async ({ customer }: { customer: string }) => {
  calls.push(customer);
  if (customer === "cus_FAILING0001") throw new Error("boom");
  return { data: [
    inv("in_paid1", customer, "paid"),
    inv("in_open1", customer, "open", { created: s("2026-10-01T00:00:00Z"), due_date: s("2099-01-01T00:00:00Z") }),
    inv("in_draft1", customer, "draft"),
    inv("in_foreign", "cus_SOMEONEELSE", "open"),
    inv("in_evil", customer, "open", { hosted_invoice_url: "https://evil.example/pay", created: s("2026-08-01T00:00:00Z") }),
  ] };
} } };

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  }
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_for_local_test_only";
  const prisma = getPrisma()!;
  const client = await prisma.client.create({ data: { name: `Invoice test ${randomUUID()}` } });
  const other = await prisma.client.create({ data: { name: `Other ${randomUUID()}` } });
  assert.deepEqual(await getClientInvoices(other.id), { status: "no_billing_account" });

  const cus = `cus_TEST${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  await prisma.clientSubscription.create({ data: { clientId: client.id, planCode: "social_pro", status: "active", provider: "stripe", externalCustomerId: cus } });
  const r = await getClientInvoices(client.id);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.deepEqual(calls, [cus], "only this workspace's own customer is queried");
  assert.deepEqual(r.invoices.map((i) => i.id), ["in_open1", "in_paid1", "in_evil"], "draft + foreign customer dropped, newest first");
  assert.equal(r.invoices.find((i) => i.id === "in_evil")!.payUrl, null, "non-Stripe link never rendered");
  assert.equal(r.partial, false);
  console.log("PASS workspace sees only its own finalized Stripe invoices; drafts, other customers and unsafe links are dropped");

  await prisma.adSubscription.create({ data: { clientId: client.id, planCode: "ads_direct", status: "active", provider: "stripe", externalCustomerId: "cus_FAILING0001" } as any });
  const p = await getClientInvoices(client.id);
  assert.equal(p.status, "ok"); assert.equal((p as any).partial, true);
  console.log("PASS one failing Stripe customer → partial list, page still renders");

  delete process.env.STRIPE_SECRET_KEY;
  assert.deepEqual(await getClientInvoices(client.id), { status: "unavailable" });
  console.log("PASS Stripe not configured → unavailable (no crash)");
}
main().then(() => process.exit(0), (e) => { console.error(String(e?.message ?? e).slice(0, 800)); process.exit(1); });
