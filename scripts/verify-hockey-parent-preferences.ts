import assert from "node:assert/strict";

import {
  enabledPreferenceFeatures,
  validateHockeyParentPreferenceInput,
} from "../src/lib/billing/hockey/parent-preference-policy";

const good = validateHockeyParentPreferenceInput({
  teamId: "M12B:verdun-01",
  smsReminders: true,
  calendarSync: true,
  departureAlerts: true,
  arrivalBufferMinutes: 25,
});
assert.equal(good.success, true);
if (good.success) {
  assert.deepEqual(enabledPreferenceFeatures(good.data).sort(), [
    "calendar_sync",
    "game_reminders",
  ]);
}

const disableAll = validateHockeyParentPreferenceInput({
  teamId: "M12B:verdun-01",
  smsReminders: false,
  calendarSync: false,
  departureAlerts: false,
  arrivalBufferMinutes: 30,
});
assert.equal(disableAll.success, true);
if (disableAll.success) {
  assert.deepEqual(enabledPreferenceFeatures(disableAll.data), []);
}

for (const bad of [
  null,
  {},
  { teamId: "bad team id" },
  { teamId: "x", arrivalBufferMinutes: -1 },
  { teamId: "x", arrivalBufferMinutes: 181 },
  { teamId: "x", smsReminders: "yes" },
]) {
  assert.equal(validateHockeyParentPreferenceInput(bad).success, false);
}

console.log("verify-hockey-parent-preferences: all checks passed");
