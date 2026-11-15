import { strict as assert } from "node:assert";
import { decideOrganizerAction, type OrganizerPolicy, type OrganizerCandidate } from "../src/lib/ai-file-organizer/approval-policy";

const policy: OrganizerPolicy = {
  mode: "auto", consentGranted: true, entitlementActive: true,
  allowedSourceKinds: ["studio"], allowedDestinationIds: ["folder-a"],
  minimumConfidence: 0.9, requireApproval: false,
};
const candidate: OrganizerCandidate = {
  sourceKind: "studio", destinationId: "folder-a", confidence: 0.95,
  sourceClientId: "client-a", destinationClientId: "client-a", activeClientId: "client-a",
};
assert.equal(decideOrganizerAction(policy, candidate), "auto_approved");
assert.equal(decideOrganizerAction({ ...policy, mode: "off" }, candidate), "disabled");
assert.equal(decideOrganizerAction({ ...policy, consentGranted: false }, candidate), "disabled");
assert.equal(decideOrganizerAction({ ...policy, entitlementActive: false }, candidate), "blocked");
assert.equal(decideOrganizerAction({ ...policy, mode: "suggest" }, candidate), "approval_required");
assert.equal(decideOrganizerAction({ ...policy, requireApproval: true }, candidate), "approval_required");
assert.equal(decideOrganizerAction(policy, { ...candidate, confidence: 0.5 }), "approval_required");
assert.equal(decideOrganizerAction(policy, { ...candidate, confidence: Number.NaN }), "blocked");
assert.equal(decideOrganizerAction(policy, { ...candidate, destinationClientId: "client-b" }), "blocked");
assert.equal(decideOrganizerAction(policy, { ...candidate, sourceClientId: "client-b" }), "blocked");
assert.equal(decideOrganizerAction(policy, { ...candidate, destinationId: "folder-b" }), "blocked");
assert.equal(decideOrganizerAction(policy, { ...candidate, sourceKind: "unknown" }), "blocked");
console.log("AI organizer policy: 12 checks passed");
