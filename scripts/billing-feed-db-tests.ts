// GROUPE TAKATAK Billing — signed ecosystem feed against a real database
// (ephemeral CI Postgres or local), calling the real route handlers.
// Synthetic data only; refuses non-loopback databases. No network.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { GET, POST } from "@/app/api/integrations/billing/invoice-requests/route";
import { getPrisma } from "@/lib/db/prisma";
import { signBillingFeedRequest } from "@/lib/billing/invoices/feed-signature";

const ORIGIN = "https://takatak.test";
const PATH = "/api/integrations/billing/invoice-requests";
const FOODHUB = "foodhub-feed-secret-for-tests-0123456789abc";
const FESTI = "festi-ice-feed-secret-for-tests-0123456789a";

const draft = {
  currency: "CAD",
  customer: { name: "Feed Customer", email: "feed@example.test", address: null },
  invoiceDate: "2026-10-06",
  dueDate: "2026-10-21",
  notes: null,
  lines: [{ description: "Commande", quantity: 2, unitPriceCents: 2500, discountCents: 0, taxable: true }],
  taxes: [{ code: "GST", label: "TPS / GST", rateMilliPercent: 5000 }],
};

function signed(method: "GET" | "POST", app: string, secret: string, path: string, body = "", timestamp = String(Math.floor(Date.now() / 1000))) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      "x-takatak-billing-app": app,
      "x-takatak-billing-timestamp": timestamp,
      "x-takatak-billing-signature": signBillingFeedRequest({ app, secret, timestamp, method, path, rawBody: body }),
    },
    ...(method === "POST" ? { body } : {}),
  });
}

async function json(response: Response) {
  return { status: response.status, body: await response.json() };
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  }
  process.env.BILLING_FEED_SECRET_FOODHUB = FOODHUB;
  process.env.BILLING_FEED_SECRET_FESTI_ICE = FESTI;
  delete process.env.BILLING_FEED_SECRET_AHMV;
  const prisma = getPrisma()!;
  const reference = `order/${randomUUID()}`;
  const body = JSON.stringify({ sourceReference: reference, draft });

  const first = await json(await POST(signed("POST", "foodhub", FOODHUB, PATH, body)));
  assert.equal(first.status, 201);
  assert.equal(first.body.created, true);
  assert.equal(first.body.request.sourceApp, "foodhub");
  assert.equal(first.body.request.status, "pending");
  const row = await prisma.billingInvoiceRequest.findUnique({ where: { id: first.body.request.id } });
  assert.equal(row?.sourceApp, "foodhub");
  assert.equal(row?.createdByProfileId, null);
  assert.equal(Number(row?.estimatedTotalCents), 5250);
  console.log("PASS a signed app queues a pending request under its own name (no Facturations call)");

  const again = await json(await POST(signed("POST", "foodhub", FOODHUB, PATH, body)));
  assert.equal(again.status, 200);
  assert.equal(again.body.created, false);
  assert.equal(again.body.request.id, first.body.request.id);
  const changed = JSON.stringify({ sourceReference: reference, draft: { ...draft, notes: "changed" } });
  assert.equal((await POST(signed("POST", "foodhub", FOODHUB, PATH, changed))).status, 409);
  console.log("PASS replay or retry returns the same request; a different draft on the same reference is a conflict");

  const sameRefOtherApp = await json(await POST(signed("POST", "festi_ice", FESTI, PATH, body)));
  assert.equal(sameRefOtherApp.status, 201, "references are per app");
  assert.notEqual(sameRefOtherApp.body.request.id, first.body.request.id);
  console.log("PASS the same reference from another app is a separate request");

  const spoof = JSON.stringify({ sourceApp: "ads", sourceReference: `x/${randomUUID()}`, draft });
  const spoofed = await json(await POST(signed("POST", "foodhub", FOODHUB, PATH, spoof)));
  assert.equal(spoofed.status, 400);
  assert.equal((await POST(signed("POST", "festi_ice", FOODHUB, PATH, JSON.stringify({ sourceReference: `x/${randomUUID()}`, draft })))).status, 401);
  assert.equal((await POST(signed("POST", "ahmv", FOODHUB, PATH, body))).status, 503, "app without a secret fails closed");
  const stale = String(Math.floor(Date.now() / 1000) - 600);
  assert.equal((await POST(signed("POST", "foodhub", FOODHUB, PATH, body, stale))).status, 401);
  const tampered = signed("POST", "foodhub", FOODHUB, PATH, body);
  assert.equal((await POST(new Request(tampered.url, { method: "POST", headers: tampered.headers, body: body.replace("Commande", "Gratuit") }))).status, 401);
  const invalidDraft = JSON.stringify({ sourceReference: `x/${randomUUID()}`, draft: { ...draft, currency: "USD" } });
  assert.equal((await POST(signed("POST", "foodhub", FOODHUB, PATH, invalidDraft))).status, 400);
  console.log("PASS body cannot choose the app; wrong secret, unconfigured app, stale or tampered requests and invalid drafts are refused");

  const statusPath = `${PATH}?sourceReference=${encodeURIComponent(reference)}`;
  const status = await json(await GET(signed("GET", "foodhub", FOODHUB, statusPath)));
  assert.equal(status.status, 200);
  assert.deepEqual(status.body.request, { id: first.body.request.id, sourceApp: "foodhub", sourceReference: reference, status: "pending", submitted: false });
  const otherAppView = await json(await GET(signed("GET", "festi_ice", FESTI, statusPath)));
  assert.equal(otherAppView.body.request.id, sameRefOtherApp.body.request.id, "each app only sees its own request");
  assert.equal((await GET(signed("GET", "foodhub", FOODHUB, `${PATH}?sourceReference=${encodeURIComponent("nope/" + randomUUID())}`))).status, 404);
  const retargeted = signed("GET", "foodhub", FOODHUB, statusPath);
  assert.equal((await GET(new Request(`${ORIGIN}${PATH}?sourceReference=other`, { headers: retargeted.headers }))).status, 401, "a signed status lookup cannot be pointed at another reference");
  console.log("PASS status lookups are signed (query included) and scoped to the calling app");
}
main().then(() => process.exit(0), (e) => { console.error(String(e?.stack ?? e).slice(0, 1200)); process.exit(1); });
