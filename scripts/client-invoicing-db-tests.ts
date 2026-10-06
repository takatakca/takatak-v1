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
  accountLinks: { create: async (params: any) => { links.push(params); return { url: `https://connect.stripe.com/setup/s/${params.account}/x` }; } },
};

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
}
main().then(() => process.exit(0), (e) => { console.error(String(e?.stack ?? e).slice(0, 1200)); process.exit(1); });
