// Facturations integration — pure and mocked-network checks (no real network,
// no database). Run: npm run qa:facturations
import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";

import {
  facturationsRolesFor,
  resolveFacturationsAccess,
} from "../src/lib/integrations/facturations/access";
import {
  createFacturationsClient,
  FacturationsClientError,
  parseDraftPage,
  parseDraftSummary,
} from "../src/lib/integrations/facturations/client";
import { readFacturationsConfig } from "../src/lib/integrations/facturations/config";
import { createFacturationsServiceToken } from "../src/lib/integrations/facturations/token";
import type { TenantAccess } from "../src/lib/security/tenant-access";

const SECRET = "facturations-test-secret-abcdefghijklmnopqrstuvwxyz";
const CLIENT_A = "11111111-1111-4111-8111-111111111111";
const CLIENT_B = "22222222-2222-4222-8222-222222222222";
const PROFILE = "33333333-3333-4333-8333-333333333333";
const DRAFT = "44444444-4444-4444-8444-444444444444";

const VALID_ENV = {
  FACTURATIONS_INTEGRATION_ENABLED: "true",
  FACTURATIONS_ORIGIN: "https://facturations.bolon.example",
  FACTURATIONS_INTEGRATION_HMAC_SECRET: SECRET,
  FACTURATIONS_INTEGRATION_ISSUER: "https://dashboard.takatak.example",
  FACTURATIONS_INTEGRATION_AUDIENCE: "facturations",
  FACTURATIONS_CLIENT_BUSINESS_MAP: JSON.stringify({ [CLIENT_A]: "business-a" }),
  NODE_ENV: "production",
};

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

// Mirrors the claim checks of Facturations src/integration-auth.js
// (verifyIntegrationBearer) so a contract drift fails here first.
function verifyLikeFacturations(token: string, nowSeconds: number) {
  const [h, p, s] = token.split(".");
  const expected = createHmac("sha256", SECRET).update(`${h}.${p}`).digest();
  const provided = Buffer.from(s, "base64url");
  assert.ok(provided.length === expected.length && timingSafeEqual(provided, expected));
  const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  assert.deepEqual(Object.keys(header).sort(), ["alg", "typ"]);
  assert.equal(header.alg, "HS256");
  assert.equal(header.typ, "JWT");
  assert.deepEqual(Object.keys(payload).sort(), [
    "aud", "business_id", "exp", "iat", "iss", "jti", "roles", "sub", "version",
  ]);
  assert.equal(payload.version, 1);
  assert.ok(/^[A-Za-z0-9._:-]{16,128}$/.test(payload.jti));
  assert.ok(payload.exp > payload.iat && payload.exp - payload.iat <= 90);
  assert.ok(payload.iat <= nowSeconds + 10 && payload.exp > nowSeconds - 10);
  return payload;
}

function scoped(role: string, clientId = CLIENT_A): TenantAccess {
  return {
    mode: "client_scoped",
    profileId: PROFILE,
    role,
    allowedClientIds: [clientId],
    activeClientId: clientId,
    customPermissions: [],
    deniedPermissions: [],
  } as TenantAccess;
}

function envelope(data: unknown, businessId = "business-a") {
  return { version: 1, requestId: "req", businessId, data };
}

const SUMMARY = {
  status: "DRAFTS_ONLY",
  currency: "CAD",
  draftCount: "3",
  draftTotalCents: "125050",
  customerCount: "2",
  issuedInvoicesAvailable: false,
  paymentsAvailable: false,
  revenueAvailable: false,
};

const PAGE = {
  status: "DRAFTS_ONLY",
  page: 1,
  pageSize: 20,
  drafts: [{
    id: DRAFT,
    customerName: "Client Exemple",
    invoiceDate: "2026-09-27",
    dueDate: "2026-10-12",
    totalCents: "85000",
    currency: "CAD",
    status: "DRAFT",
  }],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function main() {
  console.log("Facturations integration checks");

  await check("config stays disabled unless explicitly enabled", () => {
    assert.equal(readFacturationsConfig({}).state, "disabled");
    assert.equal(
      readFacturationsConfig({ ...VALID_ENV, FACTURATIONS_INTEGRATION_ENABLED: "1" }).state,
      "disabled",
    );
  });

  await check("config accepts a complete https configuration", () => {
    const result = readFacturationsConfig(VALID_ENV);
    assert.equal(result.state, "configured_untested");
    if (result.state !== "configured_untested") return;
    assert.equal(result.config.origin, "https://facturations.bolon.example");
    assert.equal(result.config.clientBusinessMap.get(CLIENT_A), "business-a");
  });

  await check("config fails closed on unsafe or incomplete values", () => {
    const bad: Array<Record<string, string>> = [
      { FACTURATIONS_ORIGIN: "http://facturations.bolon.example" },
      { FACTURATIONS_ORIGIN: "http://localhost:3000" },
      { FACTURATIONS_ORIGIN: "https://user:pw@facturations.bolon.example" },
      { FACTURATIONS_ORIGIN: "https://facturations.bolon.example/api" },
      { FACTURATIONS_ORIGIN: "https://facturations.bolon.example?x=1" },
      { FACTURATIONS_INTEGRATION_HMAC_SECRET: "too-short" },
      { FACTURATIONS_INTEGRATION_ISSUER: "" },
      { FACTURATIONS_INTEGRATION_AUDIENCE: "" },
      { FACTURATIONS_CLIENT_BUSINESS_MAP: "" },
      { FACTURATIONS_CLIENT_BUSINESS_MAP: "{}" },
      { FACTURATIONS_CLIENT_BUSINESS_MAP: "[]" },
      { FACTURATIONS_CLIENT_BUSINESS_MAP: "{not json" },
      { FACTURATIONS_CLIENT_BUSINESS_MAP: JSON.stringify({ "not-a-uuid": "b" }) },
      { FACTURATIONS_CLIENT_BUSINESS_MAP: JSON.stringify({ [CLIENT_A]: "" }) },
      { FACTURATIONS_CLIENT_BUSINESS_MAP: JSON.stringify({ [CLIENT_A]: "has space" }) },
      { FACTURATIONS_CLIENT_BUSINESS_MAP: JSON.stringify({ [CLIENT_A]: 7 }) },
    ];
    for (const override of bad) {
      assert.equal(
        readFacturationsConfig({ ...VALID_ENV, ...override }).state,
        "not_configured",
        JSON.stringify(override),
      );
    }
  });

  await check("loopback http origin is allowed only outside production", () => {
    const local = { ...VALID_ENV, NODE_ENV: "development", FACTURATIONS_ORIGIN: "http://127.0.0.1:3000" };
    assert.equal(readFacturationsConfig(local).state, "configured_untested");
  });

  await check("service token matches the Facturations claim contract", () => {
    const nowMs = 1_800_000_000_000;
    const token = createFacturationsServiceToken({
      secret: SECRET,
      issuer: "iss",
      audience: "aud",
      subject: PROFILE,
      businessId: "business-a",
      roles: ["OWNER"],
      nowMs,
    });
    const payload = verifyLikeFacturations(token, nowMs / 1000);
    assert.equal(payload.iss, "iss");
    assert.equal(payload.aud, "aud");
    assert.equal(payload.sub, PROFILE);
    assert.equal(payload.business_id, "business-a");
    assert.deepEqual(payload.roles, ["OWNER"]);
    assert.equal(payload.exp - payload.iat, 60);
  });

  await check("every token gets a fresh jti", () => {
    const input = {
      secret: SECRET, issuer: "iss", audience: "aud", subject: PROFILE,
      businessId: "business-a", roles: ["OWNER"] as const,
    };
    const a = JSON.parse(Buffer.from(createFacturationsServiceToken(input).split(".")[1], "base64url").toString());
    const b = JSON.parse(Buffer.from(createFacturationsServiceToken(input).split(".")[1], "base64url").toString());
    assert.notEqual(a.jti, b.jti);
  });

  await check("token refuses a weak secret or bad subject", () => {
    const base = {
      secret: SECRET, issuer: "iss", audience: "aud", subject: PROFILE,
      businessId: "business-a", roles: ["OWNER"] as const,
    };
    assert.throws(() => createFacturationsServiceToken({ ...base, secret: "short" }));
    assert.throws(() => createFacturationsServiceToken({ ...base, subject: "x" }));
    assert.throws(() => createFacturationsServiceToken({ ...base, roles: [] }));
  });

  await check("only workspace owners map to OWNER, admins to STAFF", () => {
    assert.deepEqual(facturationsRolesFor("owner"), ["OWNER"]);
    assert.deepEqual(facturationsRolesFor("admin"), ["STAFF"]);
    for (const role of ["manager", "editor", "staff", "viewer"] as const) {
      assert.equal(facturationsRolesFor(role), null, role);
    }
  });

  await check("access requires a linked, client-scoped workspace", () => {
    const config = { clientBusinessMap: new Map([[CLIENT_A, "business-a"]]) };
    const ok = resolveFacturationsAccess(scoped("owner"), config);
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.equal(ok.principal.businessId, "business-a");
      assert.equal(ok.principal.subject, PROFILE);
    }
    assert.deepEqual(
      resolveFacturationsAccess(scoped("owner", CLIENT_B), config),
      { ok: false, reason: "workspace_not_linked" },
    );
    assert.deepEqual(
      resolveFacturationsAccess(scoped("viewer"), config),
      { ok: false, reason: "role_not_allowed" },
    );
    for (const access of [
      { mode: "foundation_demo", role: "owner", warning: "w" },
      { mode: "selection_required", profileId: PROFILE, platformRole: "owner", allowedClientIds: [CLIENT_A] },
      { mode: "platform_admin", profileId: PROFILE, role: "owner", allowedClientIds: "all", customPermissions: [], deniedPermissions: [] },
      { mode: "denied", reason: "not_authenticated" },
    ]) {
      assert.deepEqual(
        resolveFacturationsAccess(access as TenantAccess, config),
        { ok: false, reason: "workspace_required" },
        access.mode,
      );
    }
  });

  const config = {
    origin: "https://facturations.bolon.example",
    secret: SECRET,
    issuer: "iss",
    audience: "aud",
  };
  const principal = {
    clientId: CLIENT_A,
    businessId: "business-a",
    subject: PROFILE,
    roles: ["OWNER"] as const,
  };

  await check("client calls only fixed paths with a bearer and no cookies", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = createFacturationsClient({
      config,
      principal,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return jsonResponse(envelope(url.includes("/drafts") ? PAGE : SUMMARY));
      },
    });
    const summary = await client.getDraftSummary();
    const page = await client.listDrafts(2, 10);
    assert.deepEqual(summary, {
      status: "DRAFTS_ONLY", currency: "CAD", draftCount: 3, draftTotalCents: 125050, customerCount: 2,
    });
    assert.equal(page.drafts[0].totalCents, 85000);
    assert.equal(calls[0].url, "https://facturations.bolon.example/integration/v1/dashboard");
    assert.equal(calls[1].url, "https://facturations.bolon.example/integration/v1/drafts?page=2&pageSize=10");
    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>;
      assert.equal(call.init.method, "GET");
      assert.equal(call.init.redirect, "error");
      assert.ok(headers.Authorization.startsWith("Bearer "));
      assert.equal(Object.keys(headers).some((k) => k.toLowerCase() === "cookie"), false);
    }
    const jtis = calls.map((c) =>
      JSON.parse(Buffer.from((c.init.headers as Record<string, string>).Authorization.split(".")[1], "base64url").toString()).jti);
    assert.notEqual(jtis[0], jtis[1]);
  });

  await check("client rejects out-of-range paging before any network call", async () => {
    let called = false;
    const client = createFacturationsClient({
      config, principal, fetchImpl: async () => { called = true; return jsonResponse({}); },
    });
    for (const [page, size] of [[0, 20], [1, 0], [1, 51], [1.5, 20]]) {
      await assert.rejects(client.listDrafts(page, size), (e: unknown) =>
        e instanceof FacturationsClientError && e.code === "invalid_request");
    }
    assert.equal(called, false);
  });

  await check("client maps upstream failures to safe codes", async () => {
    const cases: Array<[() => Promise<Response>, string]> = [
      [async () => jsonResponse({ error: "INVALID_INTEGRATION_TOKEN" }, 401), "rejected"],
      [async () => jsonResponse({ error: "OWNER_REQUIRED" }, 403), "rejected"],
      [async () => jsonResponse({ error: "NOT_FOUND" }, 404), "integration_disabled"],
      [async () => jsonResponse({ error: "INVALID_QUERY" }, 422), "invalid_request"],
      [async () => jsonResponse({ error: "STORAGE_UNAVAILABLE" }, 503), "unavailable"],
      [async () => { throw new TypeError("network down"); }, "unavailable"],
      [async () => new Response("not json", { status: 200 }), "invalid_response"],
      [async () => jsonResponse(envelope(SUMMARY, "business-b")), "invalid_response"],
      [async () => jsonResponse({ ...envelope(SUMMARY), version: 2 }), "invalid_response"],
      [async () => new Response("x".repeat(300_000), { status: 200 }), "invalid_response"],
    ];
    for (const [fetchImpl, code] of cases) {
      const client = createFacturationsClient({ config, principal, fetchImpl });
      await assert.rejects(client.getDraftSummary(), (e: unknown) =>
        e instanceof FacturationsClientError && e.code === code, code);
    }
  });

  await check("summary parser refuses anything that is not draft-only", () => {
    for (const bad of [
      { ...SUMMARY, status: "ISSUED" },
      { ...SUMMARY, currency: "USD" },
      { ...SUMMARY, revenueAvailable: true },
      { ...SUMMARY, paymentsAvailable: true },
      { ...SUMMARY, draftCount: "-1" },
      { ...SUMMARY, draftTotalCents: "12.5" },
      { ...SUMMARY, customerCount: null },
    ]) {
      assert.throws(() => parseDraftSummary(bad), FacturationsClientError, JSON.stringify(bad));
    }
  });

  await check("draft parser keeps only whitelisted fields and rejects bad rows", () => {
    const parsed = parseDraftPage({
      ...PAGE,
      drafts: [{ ...PAGE.drafts[0], customerEmail: "leak@example.test", internalNote: "x" }],
    });
    assert.deepEqual(Object.keys(parsed.drafts[0]).sort(), [
      "currency", "customerName", "dueDate", "id", "invoiceDate", "status", "totalCents",
    ]);
    const row = PAGE.drafts[0];
    for (const bad of [
      { ...PAGE, status: "ISSUED" },
      { ...PAGE, pageSize: 51 },
      { ...PAGE, pageSize: 0, drafts: [] },
      { ...PAGE, pageSize: 1, drafts: [row, row] },
      { ...PAGE, drafts: [{ ...row, id: "not-a-uuid" }] },
      { ...PAGE, drafts: [{ ...row, status: "ISSUED" }] },
      { ...PAGE, drafts: [{ ...row, currency: "USD" }] },
      { ...PAGE, drafts: [{ ...row, invoiceDate: "2026-02-30" }] },
      { ...PAGE, drafts: [{ ...row, totalCents: "-5" }] },
      { ...PAGE, drafts: [{ ...row, customerName: "x".repeat(201) }] },
    ]) {
      assert.throws(() => parseDraftPage(bad), FacturationsClientError, JSON.stringify(bad).slice(0, 80));
    }
  });

  console.log(`\n${passed} Facturations integration checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
