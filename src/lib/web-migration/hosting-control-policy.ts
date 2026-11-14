/**
 * TAKATAK Hosting Control — pure authorization policy contract.
 *
 * FOUNDATION ONLY. Real routes MUST load the subject role, plan entitlement,
 * client/site ownership, target UUID and approvals from server-trusted storage.
 * The browser and AI must never supply trusted evidence or a Coolify token.
 * No command execution, cPanel API calls, SSH, DNS or database access here.
 */
export type HostingRole = "owner" | "manager" | "developer" | "viewer" | "platform_operator" | "ai_assistant";

export type HostingOperation =
  | "site.read"
  | "logs.read_sanitized"
  | "metrics.read"
  | "files.list_sanitized"
  | "files.edit_scoped"
  | "database.inspect_scoped"
  | "database.export_scoped"
  | "backup.create"
  | "backup.restore"
  | "preview.deploy"
  | "production.restart"
  | "production.deploy"
  | "domain.dns_change"
  | "environment.secret_replace"
  | "wordpress.admin_link"
  | "support.ticket"
  | "host.shell"
  | "host.admin"
  | "secrets.read";

export type HostingAccessEvidence = Readonly<{
  /** Authenticated subject and resource/site's same clientId in server storage. */
  tenantMembershipVerified: boolean;
  /** The site mapping has been verified against the customer's tenant. */
  resourceOwnershipVerified: boolean;
  /** VIP subscription paid or owner-approved active legacy entitlement. */
  serviceEntitlementActive: boolean;
  /** Evidence of a successful restorable snapshot for risky write actions. */
  verifiedRecoveryPoint: boolean;
  /** Single-use, version-bound, fresh authenticated human approval record. */
  changeApprovalVerified: boolean;
}>;

export type HostingAccessDecision = Readonly<{
  ok: boolean;
  reason:
    | "allowed"
    | "tenant_or_site_not_verified"
    | "service_not_entitled"
    | "role_not_authorized"
    | "recovery_point_required"
    | "change_approval_required"
    | "operation_prohibited";
}>;

const readonlyOps: ReadonlySet<HostingOperation> = new Set([
  "site.read", "logs.read_sanitized", "metrics.read",
  "wordpress.admin_link", "support.ticket",
]);

const managedOps: ReadonlySet<HostingOperation> = new Set([
  ...readonlyOps,
  "files.list_sanitized", "files.edit_scoped",
  "database.inspect_scoped", "database.export_scoped",
  "backup.create", "preview.deploy",
]);

/** Changes that may cause production downtime or loss require a verified restore point. */
const recoverableChanges: ReadonlySet<HostingOperation> = new Set([
  "backup.restore", "production.restart", "production.deploy", "files.edit_scoped",
]);

const freshApprovalOps: ReadonlySet<HostingOperation> = new Set([
  "backup.restore", "production.deploy", "domain.dns_change", "environment.secret_replace",
]);

/**
 * Preliminary decision only; call it after authenticated tenant membership
 * and specific resource ID checks, before queueing a scoped server command.
 */
export function authorizeHostingOperation(input: {
  operation: HostingOperation;
  role: HostingRole;
  evidence: HostingAccessEvidence;
}): HostingAccessDecision {
  const { operation, role, evidence } = input;
  // Even platform operators do not read plaintext secrets or get raw
  // infrastructure shell through customer-facing Hosting Control.
  if (["host.shell", "host.admin", "secrets.read"].includes(operation)) {
    return { ok: false, reason: "operation_prohibited" };
  }
  if (role === "ai_assistant") {
    return { ok: false, reason: "role_not_authorized" };
  }
  if (!evidence.tenantMembershipVerified || !evidence.resourceOwnershipVerified) {
    return { ok: false, reason: "tenant_or_site_not_verified" };
  }
  if (!evidence.serviceEntitlementActive && operation !== "support.ticket") {
    return { ok: false, reason: "service_not_entitled" };
  }
  if (role === "viewer" && !readonlyOps.has(operation)) {
    return { ok: false, reason: "role_not_authorized" };
  }
  if (role === "developer" && !managedOps.has(operation)) {
    return { ok: false, reason: "role_not_authorized" };
  }
  if ((role === "manager" || role === "owner") && ["backup.restore", "domain.dns_change", "environment.secret_replace"].includes(operation)) {
    // High-risk operations require a platform operator to perform the actual write
    // after the client's recorded approval. Clients may request via separate API.
    return { ok: false, reason: "role_not_authorized" };
  }
  if (role === "manager" && operation === "production.deploy") {
    return { ok: false, reason: "role_not_authorized" };
  }
  if (recoverableChanges.has(operation) && !evidence.verifiedRecoveryPoint) {
    return { ok: false, reason: "recovery_point_required" };
  }
  if (freshApprovalOps.has(operation) && !evidence.changeApprovalVerified) {
    return { ok: false, reason: "change_approval_required" };
  }
  return { ok: true, reason: "allowed" };
}

/**
 * Scope is deliberately locked to TAKATAK's EXISTING hosting services.
 * Not a new hosting plan, licensed cPanel service, WHM server or new product.
 */
export const HOSTING_CONTROL_SCOPE = Object.freeze({
  serviceCatalog: "existing-takatak-hosting-only",
  deploymentControlPlane: "existing-coolify",
  legacyDomainProvider: "mochahost-client-area-handoff",
  licenseOrExtraServerProvisioned: false,
  sourceFileEditingRequiresRealScopedAdapter: true,
  externalDnsEditingIsNotActive: true,
});
