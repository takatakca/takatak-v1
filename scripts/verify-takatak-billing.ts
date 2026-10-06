// GROUPE TAKATAK Billing — Facturations integration safeguards.
// Pure logic + static source checks. No database, no network.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  validateInvoiceDraftInput,
  type InvoiceDraftInput,
} from "../src/lib/billing/invoices/draft-input";
import {
  canonicalInvoiceDraftJson,
  deriveFacturationsIdempotencyKey,
  FACTURATIONS_IDEMPOTENCY_KEY_PATTERN,
  hashInvoiceDraft,
} from "../src/lib/billing/invoices/idempotency";
import {
  dollarsToCents,
  percentToMilliPercent,
} from "../src/lib/billing/invoices/money-input";
import {
  estimateInvoice,
  InvoiceAmountTooLargeError,
} from "../src/lib/billing/invoices/preview";
import {
  SUBMISSION_CLAIM_STALE_MS,
  canCancelInvoiceRequest,
  canSubmitInvoiceRequest,
  statusAfterSubmissionFailure,
  validateInvoiceRequestCreate,
} from "../src/lib/billing/invoices/request-policy";
import {
  BILLING_SOURCE_APPS,
  isBillingSourceApp,
} from "../src/lib/billing/invoices/source-apps";
import {
  classifyFacturationsFailure,
  parseCapabilities,
  parseCreatedDraft,
  parseDashboard,
  parseDraftPage,
  readFacturationsEnvelope,
  readFacturationsErrorCode,
} from "../src/lib/integrations/facturations/contract";
import {
  getFacturationsConfig,
  getFacturationsEnvStatus,
  normalizeFacturationsOrigin,
} from "../src/lib/integrations/facturations/env";
import {
  facturationsRoleForPlatformRole,
  facturationsSubject,
} from "../src/lib/integrations/facturations/identity";
import {
  createFacturationsServiceToken,
  FacturationsTokenError,
} from "../src/lib/integrations/facturations/service-token";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

const root = process.cwd();

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

const SECRET = "test-only-secret-value-0123456789abcdef";
const BUSINESS_ID = "biz-groupe-takatak-test";

const baseDraft = {
  currency: "CAD",
  customer: { name: "Example Customer", email: "customer@example.test", address: null },
  invoiceDate: "2026-10-06",
  dueDate: "2026-10-21",
  notes: null,
  lines: [{ description: "Service", quantity: 1, unitPriceCents: 10000, discountCents: 0, taxable: true }],
  taxes: [
    { code: "GST", label: "TPS / GST", rateMilliPercent: 5000 },
    { code: "QST", label: "TVQ / QST", rateMilliPercent: 9975 },
  ],
};

function draftWith(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...structuredClone(baseDraft), ...patch };
}

function validDraft(patch: Record<string, unknown> = {}): InvoiceDraftInput {
  const result = validateInvoiceDraftInput(draftWith(patch));
  assert.equal(result.success, true, JSON.stringify(!result.success ? result.fieldErrors : {}));
  return (result as { success: true; data: InvoiceDraftInput }).data;
}

function rejects(patch: Record<string, unknown>, field: string): void {
  const result = validateInvoiceDraftInput(draftWith(patch));
  assert.equal(result.success, false, `expected rejection for ${field}`);
  assert.ok(
    !result.success && Object.keys(result.fieldErrors).some((key) => key.startsWith(field)),
    `expected field error on ${field}, got ${JSON.stringify(!result.success && result.fieldErrors)}`,
  );
}

function verifyDraftValidation(): void {
  const draft = validDraft();
  assert.equal(draft.lines[0].discountCents, 0);
  pass("valid Facturations DraftInput is accepted unchanged");

  const withoutDiscount = validDraft({
    lines: [{ description: "No discount key", quantity: 2, unitPriceCents: 500, taxable: false }],
  });
  assert.equal(withoutDiscount.lines[0].discountCents, 0);
  pass("missing discountCents normalizes to 0 like Facturations");

  rejects({ currency: "USD" }, "currency");
  rejects({ invoiceDate: "2026-02-30" }, "invoiceDate");
  rejects({ dueDate: "2026-10-01" }, "dueDate");
  rejects({ customer: { name: "A", email: "not-an-email", address: null } }, "customer.email");
  rejects({ customer: { name: "A\u0007", email: "a@example.test", address: null } }, "customer.name");
  rejects({ customer: { name: "\ud800", email: "a@example.test", address: null } }, "customer.name");
  rejects({ customer: { name: "A", email: "a@example.test", phone: "1" } }, "customer");
  rejects({ lines: [] }, "lines");
  rejects({ lines: Array.from({ length: 51 }, () => baseDraft.lines[0]) }, "lines");
  rejects({ lines: [{ ...baseDraft.lines[0], quantity: 0 }] }, "lines.0.quantity");
  rejects({ lines: [{ ...baseDraft.lines[0], quantity: 1.5 }] }, "lines.0.quantity");
  rejects({ lines: [{ ...baseDraft.lines[0], unitPriceCents: 100_000_001 }] }, "lines.0.unitPriceCents");
  rejects({ lines: [{ ...baseDraft.lines[0], discountCents: 10001 }] }, "lines.0.discountCents");
  rejects({ lines: [{ ...baseDraft.lines[0], taxable: "yes" }] }, "lines.0.taxable");
  rejects({ lines: [{ ...baseDraft.lines[0], totalCents: 1 }] }, "lines.0");
  rejects({ taxes: [baseDraft.taxes[0], baseDraft.taxes[0]] }, "taxes.1.code");
  rejects({ taxes: [{ code: "gst", label: "GST", rateMilliPercent: 5000 }] }, "taxes.0.code");
  rejects({ taxes: [{ code: "GST", label: "GST", rateMilliPercent: 100_001 }] }, "taxes.0.rateMilliPercent");
  rejects(
    { taxes: ["A", "B", "C", "D"].map((code) => ({ code, label: code, rateMilliPercent: 1000 })) },
    "taxes",
  );
  assert.equal(validateInvoiceDraftInput({ ...baseDraft, totalCents: 1 }).success, false);
  assert.equal(validateInvoiceDraftInput(null).success, false);
  pass("draft validation rejects every Facturations-invalid shape (currency, dates, limits, keys, taxes)");
}

function verifyEstimateParity(): void {
  // Expected values computed with Facturations src/draft-preview.js previewDraft().
  const a = estimateInvoice(validDraft());
  assert.deepEqual(
    [a.subtotalCents, a.taxableSubtotalCents, a.taxes.map((t) => t.amountCents), a.taxTotalCents, a.totalCents],
    [10000, 10000, [500, 998], 1498, 11498],
  );

  const b = estimateInvoice(
    validDraft({
      lines: [
        { description: "Taxable", quantity: 3, unitPriceCents: 1999, discountCents: 500, taxable: true },
        { description: "Exempt", quantity: 2, unitPriceCents: 1234, discountCents: 0, taxable: false },
      ],
    }),
  );
  assert.deepEqual(
    [b.subtotalCents, b.taxableSubtotalCents, b.taxes.map((t) => t.amountCents), b.taxTotalCents, b.totalCents],
    [7965, 5497, [275, 548], 823, 8788],
  );

  const c = estimateInvoice(
    validDraft({
      lines: [{ description: "Half cent", quantity: 1, unitPriceCents: 10, discountCents: 0, taxable: true }],
      taxes: [{ code: "T5", label: "Five", rateMilliPercent: 5000 }],
    }),
  );
  assert.deepEqual([c.taxes[0].amountCents, c.totalCents], [1, 11]);

  const d = estimateInvoice(
    validDraft({
      lines: [{ description: "Big", quantity: 1000, unitPriceCents: 100_000_000, discountCents: 0, taxable: true }],
      taxes: [{ code: "HST", label: "HST", rateMilliPercent: 15000 }],
    }),
  );
  assert.equal(d.totalCents, 115_000_000_000);
  pass("local estimate matches Facturations previewDraft (independent half-up taxes, no compounding)");

  const huge = validDraft({
    lines: Array.from({ length: 50 }, () => ({
      description: "Max",
      quantity: 1000,
      unitPriceCents: 100_000_000,
      discountCents: 0,
      taxable: true,
    })),
    taxes: [{ code: "MAX", label: "Max", rateMilliPercent: 100_000 }],
  });
  assert.throws(() => estimateInvoice(huge), InvoiceAmountTooLargeError);
  pass("estimate refuses totals above the Facturations 1e12-cent ceiling");
}

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
}

function verifyServiceToken(): void {
  const nowMs = Date.UTC(2026, 9, 6, 12, 0, 0);
  const token = createFacturationsServiceToken({
    secret: SECRET,
    issuer: "takatak-v1",
    audience: "facturations",
    subject: "takatak:mi:00000000-0000-4000-8000-000000000001",
    businessId: BUSINESS_ID,
    roles: ["OWNER"],
    nowMs,
  });
  const [header, payload, signature] = token.split(".");

  assert.deepEqual(decodeSegment(header), { alg: "HS256", typ: "JWT" });
  const claims = decodeSegment(payload);
  assert.deepEqual(Object.keys(claims).sort(), ["aud", "business_id", "exp", "iat", "iss", "jti", "roles", "sub", "version"]);
  assert.equal(claims.version, 1);
  assert.equal(claims.business_id, BUSINESS_ID);
  assert.deepEqual(claims.roles, ["OWNER"]);
  assert.equal((claims.exp as number) - (claims.iat as number), 60);
  assert.equal(claims.iat, Math.floor(nowMs / 1000));
  assert.match(String(claims.jti), /^[A-Za-z0-9._:-]{16,128}$/);
  assert.equal(
    signature,
    createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url"),
  );
  pass("service token has the exact Facturations HS256 header, claim set and 60 s lifetime");

  const again = createFacturationsServiceToken({
    secret: SECRET,
    issuer: "takatak-v1",
    audience: "facturations",
    subject: "takatak:mi:00000000-0000-4000-8000-000000000001",
    businessId: BUSINESS_ID,
    roles: ["OWNER"],
    nowMs,
  });
  assert.notEqual(decodeSegment(again.split(".")[1]).jti, claims.jti);
  pass("every token gets a fresh jti (Facturations replay guard)");

  const base = {
    secret: SECRET,
    issuer: "takatak-v1",
    audience: "facturations",
    subject: "takatak:profile:00000000-0000-4000-8000-000000000002",
    businessId: BUSINESS_ID,
    roles: ["STAFF"] as const,
  };
  assert.throws(() => createFacturationsServiceToken({ ...base, lifetimeSeconds: 91 }), FacturationsTokenError);
  assert.throws(() => createFacturationsServiceToken({ ...base, secret: "short" }), FacturationsTokenError);
  assert.throws(() => createFacturationsServiceToken({ ...base, subject: "short" }), FacturationsTokenError);
  assert.throws(() => createFacturationsServiceToken({ ...base, jti: "bad jti" }), FacturationsTokenError);
  assert.throws(
    () => createFacturationsServiceToken({ ...base, roles: ["ADMIN" as never] }),
    FacturationsTokenError,
  );
  assert.throws(() => createFacturationsServiceToken({ ...base, businessId: "" }), FacturationsTokenError);
  pass("token minting fails closed on weak secret, long lifetime, bad subject, jti, role or business");
}

function verifyIdentity(): void {
  assert.equal(facturationsRoleForPlatformRole("owner"), "OWNER");
  assert.equal(facturationsRoleForPlatformRole("admin"), "STAFF");
  assert.equal(facturationsRoleForPlatformRole("user"), null);
  assert.equal(facturationsRoleForPlatformRole(null), null);
  assert.equal(
    facturationsSubject({ masterIdentityId: "mi-1234567", profileId: "p-1" }),
    "takatak:mi:mi-1234567",
  );
  assert.equal(
    facturationsSubject({ masterIdentityId: null, profileId: "00000000-0000-4000-8000-000000000002" }),
    "takatak:profile:00000000-0000-4000-8000-000000000002",
  );
  pass("only platform owner maps to OWNER; admin is STAFF; users get no billing identity");
}

function verifyIdempotency(): void {
  const key = deriveFacturationsIdempotencyKey("rentauto", "booking:abc");
  assert.match(key, FACTURATIONS_IDEMPOTENCY_KEY_PATTERN);
  assert.equal(key.length, 48);
  assert.equal(key, deriveFacturationsIdempotencyKey("rentauto", "booking:abc"));
  assert.notEqual(key, deriveFacturationsIdempotencyKey("ahmv", "booking:abc"));
  assert.notEqual(key, deriveFacturationsIdempotencyKey("rentauto", "booking:abd"));
  pass("Idempotency-Key is deterministic per (sourceApp, sourceReference) and fits ^[A-Za-z0-9_-]{16,80}$");

  const draft = validDraft();
  assert.equal(hashInvoiceDraft(draft), hashInvoiceDraft(structuredClone(draft)));
  assert.match(hashInvoiceDraft(draft), /^[0-9a-f]{64}$/);
  assert.notEqual(hashInvoiceDraft(draft), hashInvoiceDraft(validDraft({ notes: "changed" })));
  const reordered = { ...draft, customer: { address: null, email: draft.customer.email, name: draft.customer.name } };
  assert.equal(canonicalInvoiceDraftJson(reordered), canonicalInvoiceDraftJson(draft));
  pass("draft hash is canonical and changes with any content change");
}

function verifyRequestPolicy(): void {
  const now = new Date("2026-10-06T12:00:00Z");
  const recent = new Date(now.getTime() - 1000);
  const stale = new Date(now.getTime() - SUBMISSION_CLAIM_STALE_MS - 1);

  assert.equal(canSubmitInvoiceRequest("pending", recent, now), true);
  assert.equal(canSubmitInvoiceRequest("failed", recent, now), true);
  assert.equal(canSubmitInvoiceRequest("submitting", recent, now), false);
  assert.equal(canSubmitInvoiceRequest("submitting", stale, now), true);
  assert.equal(canSubmitInvoiceRequest("submitted", stale, now), false);
  assert.equal(canSubmitInvoiceRequest("rejected", stale, now), false);
  assert.equal(canSubmitInvoiceRequest("cancelled", stale, now), false);
  assert.equal(canCancelInvoiceRequest("submitted"), false);
  assert.equal(canCancelInvoiceRequest("submitting"), false);
  assert.equal(canCancelInvoiceRequest("rejected"), true);
  pass("submitted requests are final; only pending/failed (or abandoned claims) can be sent");

  assert.equal(statusAfterSubmissionFailure({ kind: "network_error", retryable: true }), "failed");
  assert.equal(statusAfterSubmissionFailure({ kind: "unavailable", retryable: true }), "failed");
  assert.equal(statusAfterSubmissionFailure({ kind: "invalid_request", retryable: false }), "rejected");
  assert.equal(statusAfterSubmissionFailure({ kind: "not_configured", retryable: false }), "pending");
  assert.equal(statusAfterSubmissionFailure({ kind: "disabled", retryable: false }), "pending");
  assert.equal(statusAfterSubmissionFailure({ kind: "auth_rejected", retryable: false }), "pending");
  assert.equal(statusAfterSubmissionFailure({ kind: "owner_required", retryable: false }), "pending");
  assert.equal(statusAfterSubmissionFailure({ kind: "not_found", retryable: false }), "pending");
  assert.equal(statusAfterSubmissionFailure({ kind: "idempotency_conflict", retryable: false }), "rejected");
  assert.equal(statusAfterSubmissionFailure({ kind: "invalid_response", retryable: true }), "failed");
  assert.equal(statusAfterSubmissionFailure({ kind: "token_replay", retryable: true }), "failed");
  pass("timeouts stay retryable, only invoice-data verdicts are final, config/auth gaps leave the request pending");

  const ok = validateInvoiceRequestCreate({
    sourceApp: "manual",
    sourceReference: "manual:00000000-0000-4000-8000-000000000003",
    clientId: null,
    draft: baseDraft,
  });
  assert.equal(ok.success, true);
  const wrongSource = validateInvoiceRequestCreate(
    { sourceApp: "rentauto", sourceReference: "booking:1", draft: baseDraft },
    { allowedSourceApps: ["manual"] },
  );
  assert.equal(wrongSource.success, false);
  assert.equal(
    validateInvoiceRequestCreate({ sourceApp: "manual", sourceReference: "has space", draft: baseDraft }).success,
    false,
  );
  assert.equal(
    validateInvoiceRequestCreate({ sourceApp: "manual", sourceReference: "m:1", clientId: "x", draft: baseDraft }).success,
    false,
  );
  assert.equal(
    validateInvoiceRequestCreate({ sourceApp: "manual", sourceReference: "m:1", draft: baseDraft, businessId: "x" }).success,
    false,
  );
  assert.equal(isBillingSourceApp("unknown_app"), false);
  for (const app of BILLING_SOURCE_APPS) {
    assert.match(app, /^[a-z][a-z0-9_]{1,39}$/);
  }
  pass("admin API only accepts manual requests and never a browser-supplied business id");
}

function verifyContract(): void {
  const envelope = (data: unknown, businessId = BUSINESS_ID) => ({
    version: 1,
    requestId: "11111111-1111-4111-8111-111111111111",
    businessId,
    data,
  });

  assert.equal(readFacturationsEnvelope(envelope({}), BUSINESS_ID)?.requestId, "11111111-1111-4111-8111-111111111111");
  assert.equal(readFacturationsEnvelope(envelope({}, "other-business"), BUSINESS_ID), null);
  assert.equal(readFacturationsEnvelope({ ...envelope({}), version: 2 }, BUSINESS_ID), null);
  pass("responses from any other Facturations business or version are refused");

  const capabilities = parseCapabilities({
    service: "facturations",
    integrationVersion: 1,
    capabilities: {
      capabilitiesRead: true,
      dashboardRead: true,
      draftsRead: true,
      draftDetailsRead: true,
      customersRead: true,
      approvalsRead: true,
      draftWrite: false,
      ownerApprovalWrite: false,
      issuanceAuthorizationWrite: false,
      deliveryAuthorizationWrite: false,
      portalPublicationWrite: false,
    },
  });
  assert.equal(capabilities?.capabilities.draftWrite, false);
  assert.equal(parseCapabilities({ service: "facturations", integrationVersion: 1, capabilities: {} }), null);

  assert.deepEqual(
    parseDashboard({ status: "DRAFTS_ONLY", currency: "CAD", draftCount: "3", draftTotalCents: "125050", customerCount: "2" }),
    { status: "DRAFTS_ONLY", currency: "CAD", draftCount: "3", draftTotalCents: "125050", customerCount: "2" },
  );
  assert.equal(parseDashboard({ status: "REVENUE", currency: "CAD", draftCount: "1", draftTotalCents: "1", customerCount: "1" }), null);
  assert.equal(
    parseDraftPage({ status: "DRAFTS_ONLY", page: 1, pageSize: 20, drafts: [{ id: "nope" }] }),
    null,
  );

  const preview = {
    status: "DRAFT",
    persisted: true,
    waveSynced: false,
    emailed: false,
    currency: "CAD",
    subtotalCents: 10000,
    taxableSubtotalCents: 10000,
    taxTotalCents: 1498,
    totalCents: 11498,
  };
  assert.equal(
    parseCreatedDraft({ id: "22222222-2222-4222-8222-222222222222", status: "DRAFT", preview })?.totals.totalCents,
    11498,
  );
  assert.equal(
    parseCreatedDraft({ id: "22222222-2222-4222-8222-222222222222", status: "DRAFT", preview: { ...preview, waveSynced: true } }),
    null,
  );
  assert.equal(
    parseCreatedDraft({ id: "22222222-2222-4222-8222-222222222222", status: "ISSUED", preview }),
    null,
  );
  pass("created-draft responses must stay DRAFT, unsynced and unsent");

  assert.equal(readFacturationsErrorCode({ error: "OWNER_REQUIRED" }), "OWNER_REQUIRED");
  assert.equal(readFacturationsErrorCode({ error: "<script>" }), null);
  assert.deepEqual(classifyFacturationsFailure(401, "INTEGRATION_TOKEN_REPLAY"), { kind: "token_replay", retryable: true });
  assert.deepEqual(classifyFacturationsFailure(401, "INVALID_INTEGRATION_TOKEN"), { kind: "auth_rejected", retryable: false });
  assert.deepEqual(classifyFacturationsFailure(403, "OWNER_REQUIRED"), { kind: "owner_required", retryable: false });
  assert.deepEqual(classifyFacturationsFailure(409, "IDEMPOTENCY_CONFLICT"), { kind: "idempotency_conflict", retryable: false });
  assert.deepEqual(classifyFacturationsFailure(422, "INVALID_LINES"), { kind: "invalid_request", retryable: false });
  assert.deepEqual(classifyFacturationsFailure(503, "STORAGE_UNAVAILABLE"), { kind: "unavailable", retryable: true });
  assert.deepEqual(classifyFacturationsFailure(429, null), { kind: "invalid_response", retryable: true });
  pass("Facturations error codes map to fail-closed TAKATAK outcomes");
}

function verifyEnvironment(): void {
  assert.equal(normalizeFacturationsOrigin("https://facturations.example.test", "production"), "https://facturations.example.test");
  assert.equal(normalizeFacturationsOrigin("https://facturations.example.test/", "production"), "https://facturations.example.test");
  assert.equal(normalizeFacturationsOrigin("http://facturations.example.test", "development"), null);
  assert.equal(normalizeFacturationsOrigin("http://127.0.0.1:3000", "development"), "http://127.0.0.1:3000");
  assert.equal(normalizeFacturationsOrigin("http://127.0.0.1:3000", "production"), null);
  assert.equal(normalizeFacturationsOrigin("https://facturations.example.test/integration", "production"), null);
  assert.equal(normalizeFacturationsOrigin("https://user:pass@facturations.example.test", "production"), null);
  assert.equal(normalizeFacturationsOrigin("https://facturations.example.test?x=1", "production"), null);
  pass("Facturations origin must be an exact HTTPS origin (loopback HTTP only outside production)");

  const keys = [
    "FACTURATIONS_INTEGRATION_ENABLED",
    "FACTURATIONS_ORIGIN",
    "FACTURATIONS_INTEGRATION_HMAC_SECRET",
    "FACTURATIONS_INTEGRATION_ISSUER",
    "FACTURATIONS_INTEGRATION_AUDIENCE",
    "FACTURATIONS_BUSINESS_ID",
  ];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  try {
    for (const key of keys) delete process.env[key];
    assert.equal(getFacturationsEnvStatus().state, "disabled");
    assert.equal(getFacturationsConfig(), null);

    process.env.FACTURATIONS_INTEGRATION_ENABLED = "1";
    assert.equal(getFacturationsEnvStatus().state, "not_configured");
    assert.equal(getFacturationsConfig(), null);

    process.env.FACTURATIONS_ORIGIN = "https://facturations.example.test";
    process.env.FACTURATIONS_INTEGRATION_HMAC_SECRET = "too-short";
    process.env.FACTURATIONS_INTEGRATION_ISSUER = "takatak-v1";
    process.env.FACTURATIONS_INTEGRATION_AUDIENCE = "facturations";
    process.env.FACTURATIONS_BUSINESS_ID = BUSINESS_ID;
    assert.deepEqual(getFacturationsEnvStatus().missing, ["FACTURATIONS_INTEGRATION_HMAC_SECRET"]);

    process.env.FACTURATIONS_INTEGRATION_HMAC_SECRET = SECRET;
    assert.equal(getFacturationsEnvStatus().state, "configured_untested");
    assert.equal(getFacturationsConfig()?.origin, "https://facturations.example.test");
    assert.equal(JSON.stringify(getFacturationsEnvStatus()).includes(SECRET), false);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
  pass("integration is off unless explicitly enabled and fully configured; status never echoes secrets");
}

function verifyMoneyInput(): void {
  assert.equal(dollarsToCents("12.5"), 1250);
  assert.equal(dollarsToCents("12,05"), 1205);
  assert.equal(dollarsToCents("0.1"), 10);
  assert.equal(dollarsToCents("1000000"), 100000000);
  assert.equal(dollarsToCents("1.234"), null);
  assert.equal(dollarsToCents("-1"), null);
  assert.equal(dollarsToCents("1e3"), null);
  assert.equal(percentToMilliPercent("9.975"), 9975);
  assert.equal(percentToMilliPercent("5"), 5000);
  assert.equal(percentToMilliPercent("14.975"), 14975);
  assert.equal(percentToMilliPercent("9.9751"), null);
  pass("human money/rate inputs convert exactly without floating point");
}

function verifyStaticGuards(): void {
  const routes = [
    "src/app/api/admin/billing/facturations/route.ts",
    "src/app/api/admin/billing/invoice-requests/route.ts",
    "src/app/api/admin/billing/invoice-requests/[requestId]/submit/route.ts",
    "src/app/api/admin/billing/invoice-requests/[requestId]/cancel/route.ts",
  ];

  for (const route of routes) {
    const source = read(route);
    const handlers = source.match(/export async function (GET|POST|PUT|PATCH|DELETE)/g) ?? [];
    const guards = source.match(/await requirePlatformAdminApiAccess\(\)/g) ?? [];
    assert.ok(handlers.length > 0, `${route} exports a handler`);
    assert.equal(guards.length, handlers.length, `${route}: every handler requires platform admin`);
    assert.equal(/business_?id/i.test(source), false, `${route} never reads a business id from the request`);
    if (source.includes("export async function POST")) {
      assert.ok(
        source.includes("readJsonBody(") || source.includes("hasValidWriteOrigin("),
        `${route}: POST verifies origin`,
      );
    }
  }
  pass("every billing admin route requires platform admin, checks write origin, never accepts business ids");

  const submit = read("src/app/api/admin/billing/invoice-requests/[requestId]/submit/route.ts");
  assert.ok(submit.includes('actor.role !== "OWNER"'), "submit route requires OWNER");
  const service = read("src/lib/billing/invoices/invoice-request-service.ts");
  assert.ok(service.includes('context.actor.role !== "OWNER"'), "submit service requires OWNER");
  pass("only the Facturations OWNER can create drafts (route + service)");

  for (const file of [
    "src/lib/integrations/facturations/client.ts",
    "src/lib/integrations/facturations/actor.ts",
    "src/lib/billing/invoices/invoice-request-service.ts",
    "src/lib/billing/invoices/facturations-overview.ts",
  ]) {
    assert.ok(read(file).startsWith('import "server-only";'), `${file} is server-only`);
  }
  pass("network, identity and storage modules are server-only");

  const client = read("src/lib/integrations/facturations/client.ts");
  assert.ok(client.includes('redirect: "error"'), "client refuses redirects");
  assert.ok(client.includes('cache: "no-store"'), "client disables caching");
  assert.ok(client.includes("AbortSignal.timeout("), "client has a timeout");
  for (const forbidden of ["/approve", "authorize-issuance", "/deliver", "/publish", "/payments"]) {
    assert.equal(client.includes(forbidden), false, `client never calls ${forbidden}`);
  }
  pass("client only calls read endpoints and POST /drafts — never approval, issuance, delivery or payment");

  const srcFiles: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const relative = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(relative);
      else if (/\.(ts|tsx)$/.test(entry.name)) srcFiles.push(relative);
    }
  };
  walk("src");
  for (const file of srcFiles) {
    assert.equal(read(file).includes("NEXT_PUBLIC_FACTURATIONS"), false, `${file} exposes Facturations config publicly`);
  }
  for (const file of srcFiles.filter((f) => f.startsWith(path.join("src", "components")))) {
    const source = read(file);
    assert.equal(source.includes("FACTURATIONS_INTEGRATION_HMAC_SECRET"), false, `${file} references the secret`);
    assert.equal(source.includes("integrations/facturations/client"), false, `${file} imports the server client`);
  }
  pass("no NEXT_PUBLIC Facturations variable and no browser component touches the secret or client");

  const envExample = read(".env.example");
  for (const line of envExample.split("\n").filter((l) => l.startsWith("FACTURATIONS_"))) {
    const [name, value = ""] = line.split("=");
    if (name === "FACTURATIONS_INTEGRATION_ENABLED") assert.equal(value.trim(), "0");
    else assert.equal(value.trim(), "", `${name} must be blank in .env.example`);
  }
  pass(".env.example ships the integration disabled with blank values");

  const migration = read("prisma/migrations/20261006120000_takatak_billing_invoice_requests/migration.sql");
  assert.ok(migration.includes("ALTER TABLE public.billing_invoice_requests ENABLE ROW LEVEL SECURITY;"));
  assert.ok(migration.includes("REVOKE ALL ON TABLE public.billing_invoice_requests FROM anon;"));
  assert.ok(migration.includes("REVOKE ALL ON TABLE public.billing_invoice_requests FROM authenticated;"));
  assert.ok(migration.includes("billing_invoice_requests fed draft fields are immutable"));
  assert.ok(migration.includes("billing_invoice_requests rows cannot be deleted"));
  assert.ok(migration.includes("CHECK (\"currency\" = 'CAD')"));
  assert.equal(/CREATE POLICY/i.test(migration), false);
  const advisor = read("scripts/ci-rls-advisor-catalog.ts");
  assert.ok(advisor.includes('"billing_invoice_requests"'), "RLS advisor treats the queue as sensitive");
  pass("queue table: RLS on, no Data API grants/policies, immutable fed drafts, no deletes, CAD only");
}

verifyDraftValidation();
verifyEstimateParity();
verifyServiceToken();
verifyIdentity();
verifyIdempotency();
verifyRequestPolicy();
verifyContract();
verifyEnvironment();
verifyMoneyInput();
verifyStaticGuards();

console.log("\nTAKATAK BILLING (FACTURATIONS) SAFEGUARDS: ALL PASSED");
