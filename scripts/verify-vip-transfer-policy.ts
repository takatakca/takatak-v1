// Run: npx tsx scripts/verify-vip-transfer-policy.ts
// Pure contract tests: no credentials, database, Stripe charges, DNS or external requests.
import assert from "node:assert/strict";
import {
  authorizeMigrationAction, buildVipQuote, mayTransitionMigration,
  VIP_TRANSFER_PRODUCT, VIP_DOMAIN_PRODUCT,
  type TrustedMigrationEvidence,
} from "../src/lib/web-migration/vip-transfer-policy";

const full: TrustedMigrationEvidence = {
  ownerVerified: true,
  stripePaymentVerified: true,
  recoverySnapshotVerified: true,
  cutoverApprovedByHuman: true,
  registrarTransferApprovedByHuman: true,
};
const without = (key: keyof TrustedMigrationEvidence): TrustedMigrationEvidence => ({ ...full, [key]: false });
const rejected = (result: ReturnType<typeof authorizeMigrationAction>, reason: string) => {
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
};

// VIP pricing contract, intentionally excl. taxes/add-ons.
assert.equal(VIP_TRANSFER_PRODUCT.amountCents, 50_000);
assert.equal(VIP_DOMAIN_PRODUCT.amountCents, 2_000);
assert.deepEqual(buildVipQuote(1), {
  currency: "cad", vipAnnualCents: 50_000, domainAnnualCents: 2_000,
  subtotalCents: 52_000, taxesCents: null, totalCents: null,
  domainCount: 1, marketingAddonsIncluded: false,
});
assert.equal(buildVipQuote(0).subtotalCents, 50_000);
assert.equal(buildVipQuote(3).subtotalCents, 56_000);
for (const invalid of [-1, 0.5, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.throws(() => buildVipQuote(invalid), RangeError);
}

// AI never executes mutations, regardless of its prompt or tool selection.
for (const action of ["backup", "copy_to_destination", "set_secrets", "switch_dns", "rollback"] as const) {
  rejected(authorizeMigrationAction({ action, actor: "ai_assistant", evidence: full }), "actor_not_authorized");
}
// Ownership / payment / recoverability / approval gates cannot be skipped.
rejected(authorizeMigrationAction({ action: "backup", actor: "system", evidence: without("ownerVerified") }), "ownership_unverified");
rejected(authorizeMigrationAction({ action: "backup", actor: "system", evidence: without("stripePaymentVerified") }), "payment_not_verified");
rejected(authorizeMigrationAction({ action: "copy_to_destination", actor: "operator", evidence: without("recoverySnapshotVerified") }), "missing_recovery_point");
rejected(authorizeMigrationAction({ action: "switch_dns", actor: "operator", evidence: without("cutoverApprovedByHuman") }), "cutover_not_approved");
rejected(authorizeMigrationAction({ action: "initiate_registrar_transfer", actor: "operator", evidence: without("registrarTransferApprovedByHuman") }), "domain_transfer_not_approved");
rejected(authorizeMigrationAction({ action: "switch_dns", actor: "client", evidence: full }), "actor_not_authorized");
assert.equal(authorizeMigrationAction({ action: "switch_dns", actor: "operator", evidence: full }).ok, true);

// Explicit migration order; cutover needs review, no self-approval by AI or client.
assert.equal(mayTransitionMigration({ from: "draft", to: "copying", actor: "operator", evidence: full }).reason, "unknown_transition");
assert.equal(mayTransitionMigration({ from: "blocked", to: "copying", actor: "operator", evidence: full }).reason, "unknown_transition");
assert.equal(mayTransitionMigration({ from: "auditing", to: "awaiting_payment", actor: "client", evidence: full }).reason, "actor_not_authorized");
assert.equal(mayTransitionMigration({ from: "auditing", to: "awaiting_payment", actor: "operator", evidence: without("ownerVerified") }).reason, "ownership_unverified");
assert.equal(mayTransitionMigration({ from: "draft", to: "awaiting_ownership", actor: "client", evidence: without("ownerVerified") }).ok, true);
assert.equal(mayTransitionMigration({ from: "auditing", to: "awaiting_payment", actor: "operator", evidence: full }).ok, true);
assert.equal(mayTransitionMigration({ from: "awaiting_cutover_approval", to: "cutting_over", actor: "operator", evidence: without("cutoverApprovedByHuman") }).reason, "cutover_not_approved");
assert.equal(mayTransitionMigration({ from: "awaiting_cutover_approval", to: "cutting_over", actor: "ai_assistant", evidence: full }).reason, "actor_not_authorized");
assert.equal(mayTransitionMigration({ from: "awaiting_cutover_approval", to: "cutting_over", actor: "client", evidence: full }).reason, "actor_not_authorized");
assert.equal(mayTransitionMigration({ from: "monitoring", to: "completed", actor: "operator", evidence: full }).ok, true);
assert.equal(mayTransitionMigration({ from: "completed", to: "copying", actor: "operator", evidence: full }).reason, "unknown_transition");
assert.equal(mayTransitionMigration({ from: "rolled_back", to: "copying", actor: "operator", evidence: full }).reason, "unknown_transition");

console.log("VIP transfer policy: all pure contract checks passed.");
