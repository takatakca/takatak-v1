// Client invoicing (Stripe Connect) against a real database (ephemeral CI
// Postgres or local) with an in-memory fake Stripe client.
// Synthetic data only; refuses non-loopback databases. No network.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import {
  applyConnectAccountUpdated,
  getClientConnectStatus,
  startClientConnectOnboarding,
  syncClientConnectAccount,
} from "@/lib/billing/client-invoicing/connect-service";
import { createAndSendClientInvoice, listClientIssuedInvoices } from "@/lib/billing/client-invoicing/invoice-service";
import { validateClientInvoiceInput } from "@/lib/billing/client-invoicing/invoice-input";
import { ServiceError } from "@/lib/services/service-error";

const created: Array<{ params: any; key: string }> = [];
const links: any[] = [];
const accounts = new Map<string, any>();
let delayCreate = false;
const inFlight = new Set<string>();
(globalThis as any).socialStripe = {
  accounts: {
    create: async (params: any, options: { idempotencyKey: string }) => {
      created.push({ params, key: options.idempotencyKey });
      // Stripe idempotency: same key in flight → refused; same key later → same account.
      if (inFlight.has(options.idempotencyKey)) throw Object.assign(new Error("Keys for idempotent requests can only be used once at a time"), { type: "StripeIdempotencyError" });
      const existing = [...accounts.values()].find((a) => a.key === options.idempotencyKey);
      if (existing) return existing.account;
      inFlight.add(options.idempotencyKey);
      if (delayCreate) await new Promise((resolve) => setTimeout(resolve, 50));
      inFlight.delete(options.idempotencyKey);
      const account = { id: `acct_TEST${randomUUID().replace(/-/g, "").slice(0, 12)}`, charges_enabled: false, payouts_enabled: false, details_submitted: false, country: "CA", default_currency: "cad" };
      accounts.set(account.id, { key: options.idempotencyKey, account });
      return account;
    },
    retrieve: async (id: string) => accounts.get(id)!.account,
  },
  ...invoiceFakes(),
  accountLinks: { create: async (params: any) => { links.push(params); return { url: `https://connect.stripe.com/setup/s/${params.account}/x` }; } },
};

// Connected-account invoice API fake: records the stripeAccount header and
// replays idempotent writes exactly like Stripe (same key -> same object).
const writes: Array<{ kind: string; account: string; key?: string; params: any }> = [];
const replay = new Map<string, any>();
const store = { customers: [] as any[], taxRates: [] as any[], invoices: new Map<string, any>(), items: [] as any[] };
function idem(kind: string, opts: { stripeAccount: string; idempotencyKey?: string }, params: any, make: () => any) {
  writes.push({ kind, account: opts.stripeAccount, key: opts.idempotencyKey, params });
  const k = `${opts.stripeAccount}|${opts.idempotencyKey}`;
  if (opts.idempotencyKey && replay.has(k)) return replay.get(k);
  const value = make();
  if (opts.idempotencyKey) replay.set(k, value);
  return value;
}
function invoiceFakes() {
  let n = 0;
  return {
    customers: {
      list: async ({ email }: any, { stripeAccount }: any) => ({ data: store.customers.filter((c) => c.account === stripeAccount && c.email === email) }),
      create: async (params: any, opts: any) => idem("customer", opts, params, () => { const c = { id: `cus_T${++n}`, account: opts.stripeAccount, ...params }; store.customers.push(c); return c; }),
    },
    taxRates: {
      list: async (_: any, { stripeAccount }: any) => ({ data: store.taxRates.filter((t) => t.account === stripeAccount) }),
      create: async (params: any, opts: any) => idem("tax", opts, params, () => { const t = { id: `txr_T${++n}`, account: opts.stripeAccount, active: true, ...params }; store.taxRates.push(t); return t; }),
    },
    invoices: {
      create: async (params: any, opts: any) => idem("invoice", opts, params, () => { const i = { id: `in_T${++n}`, account: opts.stripeAccount, status: "draft", number: null, created: Math.floor(Date.now() / 1000), currency: "cad", total: 0, amount_due: 0, amount_paid: 0, amount_remaining: 0, due_date: null, description: null, ...params }; store.invoices.set(i.id, i); return i; }),
      finalizeInvoice: async (id: string, params: any, opts: any) => idem("finalize", opts, params, () => { const i = store.invoices.get(id); assert.equal(i.account, opts.stripeAccount); Object.assign(i, { status: "open", number: `CLI-${n}`, hosted_invoice_url: "https://invoice.stripe.com/i/acct/x" }); return { ...i }; }),
      sendInvoice: async (id: string, params: any, opts: any) => idem("send", opts, params, () => ({ ...store.invoices.get(id) })),
      list: async (_: any, { stripeAccount }: any) => ({ data: [...store.invoices.values()].filter((i) => i.account === stripeAccount) }),
    },
    invoiceItems: {
      create: async (params: any, opts: any) => idem("item", opts, params, () => { const it = { id: `ii_T${++n}`, account: opts.stripeAccount, ...params }; store.items.push(it); return it; }),
    },
  };
}

async function expectServiceError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof ServiceError && error.code === code);
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  }
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_fake_for_local_test_only", NEXT_PUBLIC_APP_URL: "https://app.takatak.test" });
  const prisma = getPrisma()!;
  const client = await prisma.client.create({ data: { name: `Connect test ${randomUUID()}` } });
  const other = await prisma.client.create({ data: { name: `Other ${randomUUID()}` } });
  const profileId = randomUUID();

  delete process.env.CLIENT_INVOICING_ENABLED;
  await expectServiceError(startClientConnectOnboarding({ clientId: client.id, profileId }), "unavailable");
  assert.equal(created.length, 0);
  console.log("PASS feature off → no Stripe account is created");

  process.env.CLIENT_INVOICING_ENABLED = "1";
  assert.equal((await getClientConnectStatus(client.id)).state, "not_connected");
  delayCreate = true;
  const settled = await Promise.allSettled([
    startClientConnectOnboarding({ clientId: client.id, profileId }),
    startClientConnectOnboarding({ clientId: client.id, profileId }),
  ]);
  delayCreate = false;
  const fulfilled = settled.filter((r): r is PromiseFulfilledResult<{ url: string }> => r.status === "fulfilled");
  const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.ok(rejected[0].reason instanceof ServiceError && rejected[0].reason.code === "conflict", "second simultaneous click gets a retry message");
  const a = fulfilled[0].value;
  const b = await startClientConnectOnboarding({ clientId: client.id, profileId });
  const rows = await prisma.clientStripeConnectAccount.findMany({ where: { clientId: client.id } });
  assert.equal(rows.length, 1);
  assert.equal(accounts.size, 1, "simultaneous clicks → one Stripe account");
  assert.equal(created[0].key, created[1].key);
  assert.equal(created[0].params.metadata.takatak_client_id, client.id);
  assert.match(a.url, /^https:\/\/connect\.stripe\.com\//);
  assert.equal(a.url, b.url);
  assert.equal(links[0].return_url, "https://app.takatak.test/dashboard/client-billing?connect=return");
  assert.equal((await getClientConnectStatus(client.id)).state, "onboarding");
  console.log("PASS onboarding creates exactly one account per workspace and returns a Stripe-hosted link");

  await startClientConnectOnboarding({ clientId: client.id, profileId });
  assert.equal(accounts.size, 1, "resuming onboarding reuses the stored account");
  assert.equal((await getClientConnectStatus(other.id)).state, "not_connected", "other workspace unaffected");
  console.log("PASS resuming onboarding reuses the stored account; other workspaces are unaffected");

  const accountId = rows[0].stripeAccountId;
  Object.assign(accounts.get(accountId).account, { details_submitted: true });
  assert.equal((await syncClientConnectAccount(client.id)).state, "restricted");
  assert.equal(await applyConnectAccountUpdated({ account: accountId, data: { object: { id: accountId, charges_enabled: true, payouts_enabled: true, details_submitted: true, country: "CA", default_currency: "cad" } } }), "updated");
  const active = await getClientConnectStatus(client.id);
  assert.equal(active.state, "active");
  assert.equal(active.flags?.payoutsEnabled, true);
  await expectServiceError(startClientConnectOnboarding({ clientId: client.id, profileId }), "conflict");
  console.log("PASS return sync and account.updated webhook move the workspace to active");

  assert.equal(await applyConnectAccountUpdated({ account: "acct_UNKNOWN1234", data: { object: { id: "acct_UNKNOWN1234", charges_enabled: true, details_submitted: true } } }), "ignored");
  assert.equal(await applyConnectAccountUpdated({ account: "acct_OTHER12345", data: { object: { id: accountId, charges_enabled: false, details_submitted: false } } }), "ignored");
  assert.equal((await getClientConnectStatus(client.id)).state, "active", "mismatched event cannot downgrade");
  console.log("PASS webhook ignores unknown accounts and objects that are not the event's own account");

  await assert.rejects(prisma.$executeRawUnsafe(`UPDATE client_stripe_connect_accounts SET "stripeAccountId"='acct_HIJACK123456' WHERE "clientId"='${client.id}'`), /immutable/);
  await assert.rejects(prisma.$executeRawUnsafe(`UPDATE client_stripe_connect_accounts SET "clientId"='${other.id}' WHERE "clientId"='${client.id}'`), /immutable/);
  await assert.rejects(prisma.$executeRawUnsafe(`DELETE FROM client_stripe_connect_accounts WHERE "clientId"='${client.id}'`), /cannot be deleted/);
  await assert.rejects(prisma.clientStripeConnectAccount.create({ data: { clientId: other.id, stripeAccountId: "not-an-account" } }));
  console.log("PASS database keeps the workspace ↔ Stripe account link immutable and well-formed");

  const parsed = validateClientInvoiceInput({
    reference: randomUUID(),
    customer: { name: "Client Final", email: "final@example.test" },
    lines: [{ description: "Service", quantity: 2, unitAmountCents: 5000 }, { description: "Frais", quantity: 1, unitAmountCents: 1999 }],
    taxRates: [{ displayName: "TPS", percentMilli: 5000 }, { displayName: "TVQ", percentMilli: 9975 }],
    daysUntilDue: 30,
    memo: null,
  });
  assert.ok(parsed.ok);
  if (!parsed.ok) return;

  await expectServiceError(createAndSendClientInvoice({ clientId: other.id, profileId, invoice: parsed.value }), "conflict");
  assert.equal(writes.length, 0, "no Stripe write for a workspace without an active account");
  assert.deepEqual(await listClientIssuedInvoices(other.id), { status: "not_active" });
  console.log("PASS a workspace without an active connected account cannot invoice");

  const sent = await createAndSendClientInvoice({ clientId: client.id, profileId, invoice: parsed.value });
  assert.match(sent.invoiceId, /^in_T/);
  assert.equal(sent.hostedUrl, "https://invoice.stripe.com/i/acct/x");
  assert.ok(writes.every((w) => w.account === accountId), "every write is on this workspace's own connected account");
  assert.ok(writes.every((w) => typeof w.key === "string" && w.key.startsWith("tkcinv1_")));
  const invoiceWrite = writes.find((w) => w.kind === "invoice")!;
  assert.equal(invoiceWrite.params.collection_method, "send_invoice");
  assert.equal(invoiceWrite.params.currency, "cad");
  assert.equal(invoiceWrite.params.days_until_due, 30);
  assert.equal(invoiceWrite.params.default_tax_rates.length, 2);
  assert.equal(invoiceWrite.params.metadata.takatak_client_id, client.id);
  const items = writes.filter((w) => w.kind === "item");
  assert.deepEqual(items.map((w) => [w.params.quantity, String(w.params.unit_amount_decimal), w.params.invoice]), [[2, "5000", sent.invoiceId], [1, "1999", sent.invoiceId]]);
  assert.deepEqual(store.taxRates.map((t) => [t.display_name, t.percentage, t.inclusive]), [["TPS", 5, false], ["TVQ", 9.975, false]]);
  console.log("PASS invoice is created, itemized, taxed with the client's own rates, finalized and sent on its own account");

  const before = { customers: store.customers.length, invoices: store.invoices.size, items: store.items.length, taxes: store.taxRates.length };
  await createAndSendClientInvoice({ clientId: client.id, profileId, invoice: parsed.value });
  assert.deepEqual({ customers: store.customers.length, invoices: store.invoices.size, items: store.items.length, taxes: store.taxRates.length }, before);
  console.log("PASS resubmitting the same form creates nothing new");

  const second = validateClientInvoiceInput({ ...parsed.value, reference: randomUUID() });
  assert.ok(second.ok);
  if (second.ok) await createAndSendClientInvoice({ clientId: client.id, profileId, invoice: second.value });
  assert.equal(store.customers.length, before.customers, "existing customer reused by email");
  assert.equal(store.taxRates.length, before.taxes, "existing tax rates reused");
  assert.equal(store.invoices.size, before.invoices + 1);
  const listed = await listClientIssuedInvoices(client.id);
  assert.equal(listed.status, "ok");
  assert.equal(listed.status === "ok" ? listed.invoices.length : 0, 2);
  console.log("PASS a new invoice reuses the customer and tax rates; the list shows this account's invoices");
}
main().then(() => process.exit(0), (e) => { console.error(String(e?.stack ?? e).slice(0, 1200)); process.exit(1); });
