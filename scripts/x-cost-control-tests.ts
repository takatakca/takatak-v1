import assert from "node:assert/strict";
import {
  X_ESTIMATED_COST_USD_MICROS,
  classifyXPublishOperation,
  createXCostAuditEvent,
  evaluateXCostGuard,
  isXCacheFresh,
} from "../src/lib/social/providers/x-cost-control";

assert.equal(classifyXPublishOperation({ text: "Bonjour" }), "post.create");
assert.equal(
  classifyXPublishOperation({ text: "Voir https://takatak.ca/offre" }),
  "post.create_with_url",
);
assert.ok(
  X_ESTIMATED_COST_USD_MICROS["post.create_with_url"] >
    X_ESTIMATED_COST_USD_MICROS["post.create"],
);

assert.equal(
  evaluateXCostGuard({
    enabled: false,
    operation: "post.create",
    monthlyBudgetUsdMicros: 1_000_000,
    spentUsdMicros: 0,
    idempotencyKey: "post-1",
  }).allowed,
  false,
);
assert.deepEqual(
  evaluateXCostGuard({
    enabled: true,
    operation: "post.create",
    monthlyBudgetUsdMicros: 0,
    spentUsdMicros: 0,
    idempotencyKey: "post-1",
  }).allowed,
  false,
);
assert.equal(
  evaluateXCostGuard({
    enabled: true,
    operation: "post.create",
    monthlyBudgetUsdMicros: 1_000_000,
    spentUsdMicros: 0,
  }).allowed,
  false,
);
const urlDecision = evaluateXCostGuard({
  enabled: true,
  operation: "post.create_with_url",
  monthlyBudgetUsdMicros: 199_999,
  spentUsdMicros: 0,
  idempotencyKey: "post-url-1",
});
assert.equal(urlDecision.allowed, false);
assert.equal(urlDecision.allowed ? "" : urlDecision.code, "budget_exceeded");

const allowed = evaluateXCostGuard({
  enabled: true,
  operation: "post.read",
  monthlyBudgetUsdMicros: 1_000_000,
  spentUsdMicros: 10_000,
});
assert.equal(allowed.allowed, true);
const audit = createXCostAuditEvent({
  clientId: "client-1",
  businessBrandId: "brand-1",
  socialAccountId: "account-1",
  operation: "post.read",
  decision: allowed,
});
assert.equal(audit.clientId, "client-1");
assert.equal(audit.businessBrandId, "brand-1");
assert.equal(audit.socialAccountId, "account-1");
assert.equal(audit.operation, "post.read");

const now = new Date("2026-10-23T12:00:00.000Z");
assert.equal(
  isXCacheFresh({ kind: "profile", cachedAt: new Date(now.getTime() - 60_000), now }),
  true,
);
assert.equal(
  isXCacheFresh({ kind: "post", cachedAt: new Date(now.getTime() - 16 * 60_000), now }),
  false,
);

console.log("PASS  X paid API cost guard (offline; no provider request)");
