import assert from "node:assert/strict";
import {
  makeOrganizerSettingsUpdate,
  organizerDraftFromSettings,
} from "../src/lib/ai-file-organizer/settings-form-model";
import { defaultOrganizerSettings } from "../src/lib/ai-file-organizer/settings-policy";

const destination = "22222222-2222-4222-8222-222222222222";
const source = { mode: "suggest" as const, consentGranted: true,
  destinationIds: [destination],
  minimumConfidence: 0.95 };
const good = makeOrganizerSettingsUpdate(source, 2);
assert.equal(good?.mode, "suggest");
assert.equal(good?.expectedRevision, 2);
assert.deepEqual(good?.allowedDestinationIds, [destination]);
assert.equal(good?.requireApproval, true);
assert.equal(makeOrganizerSettingsUpdate({ ...source, consentGranted: false }, 2), null);
assert.equal(good?.providerProcessingConsent, false);
assert.equal(Object.prototype.hasOwnProperty.call(good, "revision"), false);
assert.equal(makeOrganizerSettingsUpdate({ ...source, destinationIds: [] }, 2), null);
assert.equal(makeOrganizerSettingsUpdate({ ...source, destinationIds: ["../../other"] }, 2), null);
assert.equal(makeOrganizerSettingsUpdate({ ...source, destinationIds: [destination, destination] }, 2), null);
assert.equal(makeOrganizerSettingsUpdate({ ...source, minimumConfidence: 0.5 }, 2), null);
assert.equal(makeOrganizerSettingsUpdate(source, -1), null);
const off = makeOrganizerSettingsUpdate({ ...source, mode: "off" }, 3);
assert.equal(off?.mode, "off");
assert.equal(off?.consentGranted, false);
assert.equal(off?.providerProcessingConsent, false);
assert.equal(Object.prototype.hasOwnProperty.call(off, "revision"), false);
assert.deepEqual(off?.allowedSourceKinds, []);
assert.deepEqual(off?.allowedDestinationIds, []);
assert.equal(off?.expectedRevision, 3);
assert.deepEqual(organizerDraftFromSettings(defaultOrganizerSettings()), {
  mode: "off", consentGranted: false,
  destinationIds: [], minimumConfidence: 0.9,
});
assert.deepEqual(organizerDraftFromSettings({
  ...defaultOrganizerSettings(), mode: "suggest",
  consentGranted: true, providerProcessingConsent: false,
  allowedSourceKinds: ["studio"], allowedDestinationIds: [destination], revision: 3,
}).destinationIds, [destination]);
console.log("AI organizer settings UI mutation: 19 checks passed");
