import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  assignExperiment,
  isValidExperimentAllocationConfig,
} from "../src/lib/intelligence/experiment-allocation.ts";

const CLIENT_A = "11111111-1111-4111-8111-111111111111";
const CLIENT_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXPERIMENT = "22222222-2222-4222-8222-222222222222";
const SUBJECT = "33333333-3333-4333-8333-333333333333";
const secret = "synthetic-unit-test-secret-not-for-production-ONLY";

function config(overrides = {}) {
  return {
    clientId: CLIENT_A,
    experimentId: EXPERIMENT,
    revision: 1,
    status: "running",
    allocationBps: 10_000,
    variants: [{ id: "control", weightBps: 5000 }, { id: "candidate", weightBps: 5000 }],
    ...overrides,
  };
}
function input(overrides = {}) {
  return {
    enabled: true,
    activeClientId: CLIENT_A,
    hasHumanLaunchApproval: true,
    siteOwnershipVerified: true,
    hasAnalyticsConsent: true,
    anonymousSubjectId: SUBJECT,
    serverSecret: secret,
    experiment: config(),
    ...overrides,
  };
}

test("stable allocation returns only experiment identity and variant, never visitor ID", () => {
  const first = assignExperiment(input());
  assert.equal(first.assigned, true);
  assert.deepEqual(assignExperiment(input()), first);
  assert.ok(["control", "candidate"].includes(first.variantId));
  assert.ok(!JSON.stringify(first).includes(SUBJECT));
  assert.ok(!JSON.stringify(first).includes(secret));
});

test("all experiments are disabled by default without explicit server rollout", () => {
  assert.deepEqual(assignExperiment(input({ enabled: false })), { assigned: false, reason: "disabled" });
});

test("malformed null configuration and string-valued flags never authorize", () => {
  assert.deepEqual(assignExperiment(input({ experiment: null })), { assigned: false, reason: "invalid_configuration" });
  assert.deepEqual(assignExperiment(input({ enabled: "true" })), { assigned: false, reason: "disabled" });
  assert.deepEqual(assignExperiment(input({ hasHumanLaunchApproval: "true" })), { assigned: false, reason: "approval_required" });
  assert.deepEqual(assignExperiment(input({ siteOwnershipVerified: "true" })), { assigned: false, reason: "unverified_site" });
  assert.deepEqual(assignExperiment(input({ hasAnalyticsConsent: "true" })), { assigned: false, reason: "consent_required" });
});

test("tenant isolation denies a foreign current session and missing session", () => {
  assert.deepEqual(assignExperiment(input({ activeClientId: CLIENT_B })), { assigned: false, reason: "tenant_mismatch" });
  assert.deepEqual(assignExperiment(input({ activeClientId: null })), { assigned: false, reason: "tenant_mismatch" });
  assert.deepEqual(assignExperiment(input({ experiment: config({ clientId: CLIENT_B }) })), { assigned: false, reason: "tenant_mismatch" });
});

test("human approval, site verification and consent are hard gates", () => {
  assert.deepEqual(assignExperiment(input({ hasHumanLaunchApproval: false })), { assigned: false, reason: "approval_required" });
  assert.deepEqual(assignExperiment(input({ siteOwnershipVerified: false })), { assigned: false, reason: "unverified_site" });
  assert.deepEqual(assignExperiment(input({ hasAnalyticsConsent: false })), { assigned: false, reason: "consent_required" });
});

test("draft, approved, paused and completed states cannot allocate visitors", () => {
  for (const status of ["draft", "approved", "paused", "completed"]) {
    assert.deepEqual(assignExperiment(input({ experiment: config({ status }) })), { assigned: false, reason: "not_running" });
  }
});

test("malformed, duplicate, zero-weight and non-100% variants fail closed", () => {
  const invalid = [
    config({ variants: [{ id: "same", weightBps: 5000 }, { id: "same", weightBps: 5000 }] }),
    config({ variants: [{ id: "control", weightBps: 9999 }, { id: "candidate", weightBps: 0 }] }),
    config({ variants: [{ id: "control", weightBps: 6000 }, { id: "candidate", weightBps: 3000 }] }),
    config({ variants: [{ id: "control", weightBps: 5000 }] }),
    config({ variants: [{ id: "control", weightBps: 5000 }, { id: "candidate", weightBps: 5000 }], allocationBps: 10001 }),
    config({ revision: 0 }),
    config({ experimentId: "not-a-uuid" }),
    config({ clientId: CLIENT_A, status: "unknown" }),
  ];
  for (const experiment of invalid) {
    assert.equal(isValidExperimentAllocationConfig(experiment), false);
    assert.deepEqual(assignExperiment(input({ experiment })), { assigned: false, reason: "invalid_configuration" });
  }
});

test("unknown or personally identifying visitor identifiers are rejected", () => {
  for (const anonymousSubjectId of [null, "", "someone@example.com", "192.0.2.3", "raw-user-id"]) {
    assert.deepEqual(assignExperiment(input({ anonymousSubjectId })), { assigned: false, reason: "invalid_configuration" });
  }
});

test("short secret fails closed, and changing the secret never supplies a fallback", () => {
  assert.deepEqual(assignExperiment(input({ serverSecret: "short" })), { assigned: false, reason: "invalid_configuration" });
});

test("0% allocation enrolls nobody", () => {
  assert.deepEqual(assignExperiment(input({ experiment: config({ allocationBps: 0 }) })), { assigned: false, reason: "not_enrolled" });
});

test("100% rollout with a balanced configuration uses both variants, consistently", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const visitor = "99999999-9999-4999-8999-" + i.toString(16).padStart(12, "0");
    const first = assignExperiment(input({ anonymousSubjectId: visitor }));
    assert.equal(first.assigned, true);
    assert.deepEqual(assignExperiment(input({ anonymousSubjectId: visitor })), first);
    seen.add(first.variantId);
  }
  assert.deepEqual([...seen].sort(), ["candidate", "control"]);
});
