// Run: npx tsx scripts/verify-hosting-control-policy.ts
import assert from "node:assert/strict";
import {
  authorizeHostingOperation, HOSTING_ENGINE_CONFIG,
  type HostingAccessEvidence,
  type HostingOperation,
  type HostingRole,
} from "../src/lib/web-migration/hosting-control-policy";

const evidence: HostingAccessEvidence = {
  tenantMembershipVerified: true,
  resourceOwnershipVerified: true,
  serviceEntitlementActive: true,
  verifiedRecoveryPoint: true,
  changeApprovalVerified: true,
};
const verdict = (role: HostingRole, operation: HostingOperation, patch: Partial<HostingAccessEvidence> = {}) =>
  authorizeHostingOperation({ role, operation, evidence: { ...evidence, ...patch } });

assert.equal(HOSTING_ENGINE_CONFIG.coolify.customerFrontend, "takatak-hosting-control");
assert.equal(HOSTING_ENGINE_CONFIG.cpanel_whm.licenseRequired, true);
assert.equal(verdict("owner", "site.read").ok, true);
assert.equal(verdict("owner", "preview.deploy").ok, true);
assert.equal(verdict("developer", "files.edit_scoped").ok, true);
assert.equal(verdict("viewer", "metrics.read").ok, true);
assert.equal(verdict("viewer", "files.list_sanitized").reason, "role_not_authorized");
assert.equal(verdict("developer", "production.deploy").reason, "role_not_authorized");
assert.equal(verdict("manager", "production.deploy").reason, "role_not_authorized");
assert.equal(verdict("owner", "production.deploy", { changeApprovalVerified: false }).reason, "change_approval_required");
assert.equal(verdict("owner", "production.deploy", { verifiedRecoveryPoint: false }).reason, "recovery_point_required");
assert.equal(verdict("owner", "production.deploy").ok, true);
assert.equal(verdict("owner", "domain.dns_change").reason, "role_not_authorized");
assert.equal(verdict("owner", "environment.secret_replace").reason, "role_not_authorized");
assert.equal(verdict("platform_operator", "domain.dns_change", { changeApprovalVerified: false }).reason, "change_approval_required");
assert.equal(verdict("platform_operator", "domain.dns_change").ok, true);
assert.equal(verdict("platform_operator", "backup.restore", { verifiedRecoveryPoint: false }).reason, "recovery_point_required");

for (const op of ["host.shell", "host.admin", "secrets.read"] as const) {
  for (const role of ["owner", "manager", "developer", "viewer", "platform_operator", "ai_assistant"] as const) {
    assert.equal(verdict(role, op).reason, "operation_prohibited");
  }
}
for (const operation of ["site.read", "backup.create", "production.deploy", "database.export_scoped"] as const) {
  assert.equal(verdict("ai_assistant", operation).reason, "role_not_authorized");
  assert.equal(verdict("owner", operation, { tenantMembershipVerified: false }).reason, "tenant_or_site_not_verified");
  assert.equal(verdict("owner", operation, { resourceOwnershipVerified: false }).reason, "tenant_or_site_not_verified");
}
assert.equal(verdict("owner", "site.read", { serviceEntitlementActive: false }).reason, "service_not_entitled");
assert.equal(verdict("owner", "support.ticket", { serviceEntitlementActive: false }).ok, true);
console.log("TAKATAK Hosting Control: pure role, isolation, backup, approval and no-shell policy checks passed.");
