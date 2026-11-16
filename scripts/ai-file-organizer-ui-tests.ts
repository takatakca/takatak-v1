import assert from "node:assert/strict";
import { organizerSettingsSavePayload, type OrganizerUiDraft } from "../src/lib/ai-file-organizer/settings-ui";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const c = "33333333-3333-4333-8333-333333333333";
const off: OrganizerUiDraft = {
  mode: "off", consentGranted: false, providerProcessingConsent: false,
  allowedDestinationIds: [], minimumConfidence: 0.9,
};
const suggest: OrganizerUiDraft = {
  ...off, mode: "suggest", consentGranted: true,
  providerProcessingConsent: true, allowedDestinationIds: [a, b],
};

const disabled = organizerSettingsSavePayload(off, 0, []);
assert.ok(disabled);
assert.equal(disabled.mode, "off");
assert.equal(disabled.expectedRevision, 0);
assert.equal(disabled.requireApproval, true);
assert.deepEqual(disabled.allowedDestinationIds, []);
assert.deepEqual(disabled.allowedSourceKinds, []);

const reset = organizerSettingsSavePayload({
  ...suggest, mode: "off", minimumConfidence: 0.95,
}, 3, [a, b]);
assert.ok(reset);
assert.equal(reset.mode, "off");
assert.equal(reset.consentGranted, false);
assert.equal(reset.providerProcessingConsent, false);
assert.deepEqual(reset.allowedSourceKinds, []);
assert.deepEqual(reset.allowedDestinationIds, []);
assert.equal(reset.expectedRevision, 3);

const active = organizerSettingsSavePayload(suggest, 7, [a, b]);
assert.ok(active);
assert.equal(active.mode, "suggest");
assert.equal(active.expectedRevision, 7);
assert.equal(active.requireApproval, true);
assert.deepEqual(active.allowedSourceKinds, ["studio"]);
assert.deepEqual(active.allowedDestinationIds, [a, b]);
assert.equal("clientId" in active, false);
assert.equal("entitlementActive" in active, false);

assert.equal(organizerSettingsSavePayload(suggest, 7, [a]), null, "unknown project must fail");
assert.equal(organizerSettingsSavePayload(suggest, 7, [c]), null, "other workspace destination must fail");
assert.equal(organizerSettingsSavePayload(suggest, 7, []), null);
assert.equal(organizerSettingsSavePayload({...suggest,allowedDestinationIds:[]}, 7, [a]), null);
assert.equal(organizerSettingsSavePayload({...suggest,allowedDestinationIds:[a, a]}, 7, [a,b]), null);
assert.equal(organizerSettingsSavePayload({...suggest,consentGranted:false}, 7, [a,b]), null);
assert.equal(organizerSettingsSavePayload({...suggest,providerProcessingConsent:false}, 7, [a,b]), null);
assert.equal(organizerSettingsSavePayload({...suggest,minimumConfidence:0.7}, 7, [a,b]), null);
assert.equal(organizerSettingsSavePayload({...suggest,minimumConfidence:1.01}, 7, [a,b]), null);
assert.equal(organizerSettingsSavePayload({...suggest,minimumConfidence:Number.NaN}, 7, [a,b]), null);
assert.equal(organizerSettingsSavePayload(suggest, -1, [a,b]), null);
assert.equal(organizerSettingsSavePayload(suggest, 1.5, [a,b]), null);
assert.equal(organizerSettingsSavePayload({...suggest,mode:"auto" as "suggest"}, 7, [a,b]), null);
console.log("AI File Organizer Studio settings UI: 21 consent/scope/boundary checks passed");
