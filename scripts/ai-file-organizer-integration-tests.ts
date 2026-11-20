import { strict as assert } from "node:assert";
import { organizerSubscriptionActive } from "../src/lib/ai-file-organizer/entitlement-policy";
import { previewStudioOrganizerAction, type OrganizerStudioDependencies, type StudioOrganizerPreview } from "../src/lib/ai-file-organizer/studio-approval";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const outputId = "33333333-3333-4333-8333-333333333333";
const base: StudioOrganizerPreview = {
  clientId: a, outputId, destinationId: "folder-a", confidence: .96,
  policy: { mode: "suggest", consentGranted: true, allowedSourceKinds: ["studio"],
    allowedDestinationIds: ["folder-a"], minimumConfidence: .9, requireApproval: true },
};
let reads = 0;
const deps: OrganizerStudioDependencies = {
  canManageWorkspace: async id => id === a,
  hasOrganizerEntitlement: async id => id === a,
  loadStudioOutput: async () => { reads++; return { clientId: a, origin: "ai_generated", status: "saved", source: "takatakstudio_output" }; },
  loadDestination: async () => ({ clientId: a }),
};
async function expect(input: StudioOrganizerPreview, expected: string, overrides: Partial<OrganizerStudioDependencies> = {}) {
  assert.equal(await previewStudioOrganizerAction({ ...deps, ...overrides }, input), expected);
}
async function main() {
  await expect(base, "approval_required");
  await expect({ ...base, policy: { ...base.policy, mode: "auto", requireApproval: false } }, "auto_approved");
  await expect({ ...base, policy: { ...base.policy, mode: "off" } }, "disabled");
  await expect({ ...base, policy: { ...base.policy, consentGranted: false } }, "disabled");
  await expect(base, "blocked", { canManageWorkspace: async () => false });
  await expect(base, "blocked", { hasOrganizerEntitlement: async () => false });
  await expect(base, "blocked", { loadStudioOutput: async () => null });
  await expect(base, "blocked", { loadStudioOutput: async () => ({ clientId: b, origin: "ai_generated", status: "saved", source: "takatakstudio_output" }) });
  await expect(base, "blocked", { loadStudioOutput: async () => ({ clientId: a, origin: "manual", status: "saved", source: "takatakstudio_output" }) });
  await expect(base, "blocked", { loadStudioOutput: async () => ({ clientId: a, origin: "ai_generated", status: "archived", source: "takatakstudio_output" }) });
  await expect(base, "blocked", { loadStudioOutput: async () => ({ clientId: a, origin: "ai_generated", status: "saved", source: "takbot" }) });
  await expect(base, "blocked", { loadDestination: async () => null });
  await expect(base, "blocked", { loadDestination: async () => ({ clientId: b }) });
  await expect({ ...base, destinationId: "folder-b" }, "blocked");
  await expect({ ...base, confidence: 42 }, "blocked");
  await expect({ ...base, clientId: b }, "blocked");
  await expect({ ...base, outputId: "invalid" }, "blocked");
  const readCount = reads;
  await expect({ ...base, policy: { ...base.policy, mode: "off" } }, "disabled");
  assert.equal(readCount, reads, "off mode must not read any private file metadata");
  const now = new Date("2026-11-15T12:00:00.000Z");
  const current = { status: "active", stripeSubscriptionId: "sub_abc", currentPeriodEnd: new Date("2026-12-01T00:00:00Z") };
  assert.equal(organizerSubscriptionActive(current, now), true);
  assert.equal(organizerSubscriptionActive({ ...current, status: "past_due" }, now), false);
  assert.equal(organizerSubscriptionActive({ ...current, status: "canceled" }, now), false);
  assert.equal(organizerSubscriptionActive({ ...current, stripeSubscriptionId: null }, now), false);
  assert.equal(organizerSubscriptionActive({ ...current, currentPeriodEnd: null }, now), false);
  assert.equal(organizerSubscriptionActive({ ...current, currentPeriodEnd: new Date("2026-11-01") }, now), false);
  assert.equal(organizerSubscriptionActive({ ...current, currentPeriodEnd: "bad-date" }, now), false);
  assert.equal(organizerSubscriptionActive(null, now), false);
  console.log("AI organizer integration: 26 checks passed");
}
void main();
