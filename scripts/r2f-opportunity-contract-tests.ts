import assert from "node:assert/strict";
import {
  R2F_OPPORTUNITY_STATES,
  buildR2FPublicOpportunityProjection,
  evaluateR2FOpportunityTransition,
  isR2FOpportunityState,
  toR2FPublicOpportunityStatus,
} from "../src/lib/integrations/r2f/opportunity-contract";

const expectedStates = [
  "new", "qualified", "internal_candidate", "partner_candidate", "distributed",
  "contacted", "won", "lost", "completed", "cancelled",
];
assert.deepEqual([...R2F_OPPORTUNITY_STATES], expectedStates);
assert.equal(isR2FOpportunityState("toString"), false);
assert.equal(isR2FOpportunityState("__proto__"), false);
assert.equal(isR2FOpportunityState(null), false);

for (const state of R2F_OPPORTUNITY_STATES) {
  assert.deepEqual(evaluateR2FOpportunityTransition(state, state), {
    allowed: true, changed: false,
  });
  assert.notEqual(toR2FPublicOpportunityStatus(state), null);
}

const permitted: Record<string, string[]> = {
  new: ["qualified", "cancelled"],
  qualified: ["internal_candidate", "partner_candidate", "lost", "cancelled"],
  internal_candidate: ["distributed", "contacted", "lost", "cancelled"],
  partner_candidate: ["distributed", "lost", "cancelled"],
  distributed: ["contacted", "lost", "cancelled"],
  contacted: ["won", "lost", "cancelled"],
  won: ["completed", "cancelled"],
  lost: [], completed: [], cancelled: [],
};
for (const from of R2F_OPPORTUNITY_STATES) {
  for (const to of R2F_OPPORTUNITY_STATES) {
    if (from === to) continue;
    const result = evaluateR2FOpportunityTransition(from, to);
    assert.equal(result.allowed, permitted[from].includes(to), `${from} -> ${to}`);
  }
}
assert.deepEqual(evaluateR2FOpportunityTransition("unknown", "new"), {
  allowed: false, reason: "unknown_state",
});
assert.deepEqual(evaluateR2FOpportunityTransition("new", "toString"), {
  allowed: false, reason: "unknown_state",
});

assert.equal(toR2FPublicOpportunityStatus("internal_candidate"), "in_review");
assert.equal(toR2FPublicOpportunityStatus("partner_candidate"), "in_review");
assert.equal(toR2FPublicOpportunityStatus("won"), "in_progress");
assert.equal(toR2FPublicOpportunityStatus("completed"), "finished");
assert.equal(toR2FPublicOpportunityStatus("lost"), "closed");
assert.equal(toR2FPublicOpportunityStatus("__proto__"), null);

const reference = "R2F_public_ABC123";
const updatedAt = "2026-10-15T18:00:00.000Z";
const projection = buildR2FPublicOpportunityProjection({
  reference, state: "internal_candidate", updatedAt,
});
assert.deepEqual(projection, {
  version: 1, reference, status: "in_review", updatedAt,
});
assert.deepEqual(Object.keys(projection ?? {}), ["version", "reference", "status", "updatedAt"]);
assert.equal(buildR2FPublicOpportunityProjection({
  reference: "unsafe/customer@example.com", state: "new", updatedAt,
}), null);
assert.equal(buildR2FPublicOpportunityProjection({
  reference, state: "new", updatedAt: "2026-02-30T18:00:00.000Z",
}), null);
assert.equal(buildR2FPublicOpportunityProjection({
  reference, state: "new", updatedAt: "2026-10-15T18:00:00+00:00",
}), null);
assert.equal(buildR2FPublicOpportunityProjection({
  reference, state: "not-a-state", updatedAt,
}), null);
console.log("R2F phase 2 opportunity contract: all deterministic checks passed");
