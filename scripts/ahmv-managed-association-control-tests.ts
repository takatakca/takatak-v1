import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AHMV_CONTROL_SERVICES,
  DEFAULT_MANAGED_ASSOCIATION_PRODUCT_CODE,
  type ManagedAssociationGrant,
} from "../src/lib/integrations/ahmv-control-plane/contracts";
import {
  canGrantPerformAhmvAction,
  grantAllowsAhmvControl,
  mapWorkspaceRoleToAhmvControlRole,
} from "../src/lib/integrations/ahmv-control-plane/policy";
import { assertSafeAhmvControlPayload } from "../src/lib/integrations/ahmv-control-plane/payload-policy";
import { buildAhmvControlEnvelope } from "../src/lib/integrations/ahmv-control-plane/outbound.server";

const now = new Date("2026-10-04T17:30:00-04:00");
const serviceToken = "server-only-ahmv-control-token".padEnd(40, "x");

const grant: ManagedAssociationGrant = {
  organizationId: "org_ahmv",
  actorId: "user_manager_1",
  role: "manager",
  subscriptionId: "sub_ahmv_2026",
  productCode: DEFAULT_MANAGED_ASSOCIATION_PRODUCT_CODE,
  status: "active",
  enabledServices: ["website", "seo", "social"],
  validUntil: "2026-11-04T17:30:00-05:00",
};

assert.equal(AHMV_CONTROL_SERVICES.length, 16);
assert.equal(grantAllowsAhmvControl(grant, { now }), true);
assert.equal(
  grantAllowsAhmvControl({ ...grant, status: "suspended" }, { now }),
  false,
);
assert.equal(
  grantAllowsAhmvControl(
    { ...grant, validUntil: "2026-10-01T00:00:00-04:00" },
    { now },
  ),
  false,
);
assert.equal(
  grantAllowsAhmvControl(
    { ...grant, productCode: "some_other_product" },
    { now },
  ),
  false,
);

assert.equal(mapWorkspaceRoleToAhmvControlRole("owner"), "owner");
assert.equal(mapWorkspaceRoleToAhmvControlRole("admin"), "admin");
assert.equal(mapWorkspaceRoleToAhmvControlRole("manager"), "manager");
assert.equal(mapWorkspaceRoleToAhmvControlRole("editor"), "operator");
assert.equal(mapWorkspaceRoleToAhmvControlRole("staff"), "operator");
assert.equal(mapWorkspaceRoleToAhmvControlRole("viewer"), "viewer");

assert.equal(canGrantPerformAhmvAction(grant, "seo", "publish", { now }), true);
assert.equal(canGrantPerformAhmvAction(grant, "voice", "read", { now }), false);
assert.equal(canGrantPerformAhmvAction(grant, "seo", "delete", { now }), false);
assert.equal(
  canGrantPerformAhmvAction(
    { ...grant, role: "owner" },
    "seo",
    "delete",
    { now },
  ),
  true,
);

assert.doesNotThrow(() =>
  assertSafeAhmvControlPayload({
    title: "Accueil",
    settings: { indexable: true },
  }),
);
assert.throws(
  () => assertSafeAhmvControlPayload({ apiKey: "must-not-be-forwarded" }),
  /ahmv_control_payload_forbidden_key/,
);
assert.throws(
  () => assertSafeAhmvControlPayload({ nested: { refresh_token: "no" } }),
  /ahmv_control_payload_forbidden_key/,
);

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("control_contract_must_not_fetch");
};

const envelope = buildAhmvControlEnvelope({
  serviceToken,
  grant,
  now,
  command: {
    requestId: "req_ahmv_123",
    idempotencyKey: "cmd_ahmv_12345678",
    service: "seo",
    action: "save_draft",
    resourceType: "page",
    resourceId: "home",
    expectedRevision: 2,
    payload: { title: "Accueil" },
  },
});

globalThis.fetch = originalFetch;

assert.equal(envelope.headers["x-takatak-tenant"], "ahmverdun");
assert.equal(envelope.headers["x-takatak-product"], "ahmv");
assert.equal(envelope.headers["x-takatak-organization-id"], grant.organizationId);
assert.equal(envelope.headers["x-takatak-actor-id"], grant.actorId);
assert.equal(envelope.headers["x-request-id"], "req_ahmv_123");
assert.equal(
  envelope.headers.authorization,
  ["Bearer", serviceToken].join(" "),
);
assert.equal(envelope.command.tenant, "ahmverdun");
assert.equal(envelope.command.organizationId, grant.organizationId);
assert.equal(envelope.command.actorId, grant.actorId);
assert.equal(envelope.command.expectedRevision, 2);

assert.throws(
  () =>
    buildAhmvControlEnvelope({
      serviceToken: "too-short",
      grant,
      now,
      command: {
        requestId: "req_ahmv_123",
        idempotencyKey: "cmd_ahmv_12345678",
        service: "seo",
        action: "read",
        resourceType: "page",
        resourceId: "home",
      },
    }),
  /ahmv_control_service_token_not_configured/,
);

assert.throws(
  () =>
    buildAhmvControlEnvelope({
      serviceToken,
      grant,
      now,
      command: {
        requestId: "req_ahmv_123",
        idempotencyKey: "cmd_ahmv_12345678",
        service: "voice",
        action: "read",
        resourceType: "phone",
        resourceId: "main",
      },
    }),
  /ahmv_control_grant_denied/,
);

assert.throws(
  () =>
    buildAhmvControlEnvelope({
      serviceToken,
      grant,
      now,
      command: {
        requestId: "req_ahmv_123",
        idempotencyKey: "bad",
        service: "seo",
        action: "read",
        resourceType: "page",
        resourceId: "home",
      },
    }),
  /ahmv_control_invalid_idempotency_key/,
);

const outboundSource = readFileSync(
  "src/lib/integrations/ahmv-control-plane/outbound.server.ts",
  "utf8",
);
assert.match(outboundSource, /import "server-only"/);
assert.doesNotMatch(outboundSource, /\bfetch\s*\(/);
assert.doesNotMatch(outboundSource, /NEXT_PUBLIC_/);

const dashboardConfig = readFileSync(
  "src/lib/dashboard/dashboard-config.ts",
  "utf8",
);
assert.doesNotMatch(dashboardConfig, /managed-association|ahmv-control-plane/);

const hockeyPage = readFileSync(
  "src/app/dashboard/hockey/page.tsx",
  "utf8",
);
assert.doesNotMatch(hockeyPage, /ahmv-control-plane/);

console.log("TAKATAK AHMV managed-association control contract safeguards passed.");
