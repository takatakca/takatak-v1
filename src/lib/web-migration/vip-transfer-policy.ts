/**
 * TAKATAK VIP Transfer AI — pure, server-authoritative policy primitives.
 *
 * FOUNDATION ONLY: no provider calls, Stripe sessions, DNS updates, credential
 * storage, database writes or live migration jobs are implemented here.
 * The server MUST derive identity/membership, prices and payment truth from
 * trusted stores. Browser and AI messages are NOT authorization.
 */

export const VIP_TRANSFER_PRODUCT = Object.freeze({
  code: "takatak_vip_annual",
  currency: "cad",
  interval: "year" as const,
  amountCents: 50_000,
  includes: ["standard-dashboard-modules", "hosting-migration-labour", "ai-support"] as const,
});

export const VIP_DOMAIN_PRODUCT = Object.freeze({
  code: "takatak_vip_domain_annual",
  currency: "cad",
  interval: "year" as const,
  amountCents: 2_000,
  unit: "eligible-domain" as const,
});

export type MigrationProvider =
  | "mochahost"
  | "godaddy"
  | "enom"
  | "cpanel"
  | "plesk"
  | "wordpress"
  | "shopify"
  | "custom"
  | "unknown";

export type MigrationStatus =
  | "draft"
  | "awaiting_ownership"
  | "auditing"
  | "awaiting_payment"
  | "awaiting_credentials"
  | "backing_up"
  | "ready"
  | "copying"
  | "validating"
  | "awaiting_cutover_approval"
  | "cutting_over"
  | "monitoring"
  | "completed"
  | "blocked"
  | "rolling_back"
  | "rolled_back"
  | "canceled";

export const MIGRATION_STATUS_NEXT: Readonly<Record<MigrationStatus, readonly MigrationStatus[]>> = {
  draft: ["awaiting_ownership", "canceled"],
  awaiting_ownership: ["auditing", "blocked", "canceled"],
  auditing: ["awaiting_payment", "blocked", "canceled"],
  awaiting_payment: ["awaiting_credentials", "blocked", "canceled"],
  awaiting_credentials: ["backing_up", "blocked", "canceled"],
  backing_up: ["ready", "blocked"],
  ready: ["copying", "blocked", "canceled"],
  copying: ["validating", "blocked", "rolling_back"],
  validating: ["awaiting_cutover_approval", "blocked", "rolling_back"],
  awaiting_cutover_approval: ["cutting_over", "blocked", "rolling_back"],
  cutting_over: ["monitoring", "blocked", "rolling_back"],
  monitoring: ["completed", "blocked", "rolling_back"],
  blocked: ["auditing", "awaiting_payment", "awaiting_credentials", "backing_up", "ready", "copying", "validating", "awaiting_cutover_approval", "monitoring", "rolling_back", "canceled"],
  rolling_back: ["rolled_back", "blocked"],
  rolled_back: [],
  completed: [],
  canceled: [],
};

export type MigrationActor = "client" | "operator" | "system" | "ai_assistant";
export type MigrationAction =
  | "inspect_source"
  | "request_domain_code"
  | "connect_provider"
  | "backup"
  | "copy_to_destination"
  | "validate"
  | "set_secrets"
  | "deploy_preview"
  | "switch_dns"
  | "initiate_registrar_transfer"
  | "rollback"
  | "send_support_reply";

export type MigrationDecision = {
  ok: boolean;
  reason:
    | "allowed"
    | "unknown_transition"
    | "actor_not_authorized"
    | "ownership_unverified"
    | "payment_not_verified"
    | "missing_recovery_point"
    | "cutover_not_approved"
    | "domain_transfer_not_approved";
};

/** Derived exclusively on the server from verified records, never from a user/AI JSON payload. */
export type TrustedMigrationEvidence = {
  ownerVerified: boolean;
  stripePaymentVerified: boolean;
  recoverySnapshotVerified: boolean;
  cutoverApprovedByHuman: boolean;
  registrarTransferApprovedByHuman: boolean;
};

/** Mutation actions should be performed by a scoped backend worker, not an LLM directly. */
export function authorizeMigrationAction(input: {
  action: MigrationAction;
  actor: MigrationActor;
  evidence: TrustedMigrationEvidence;
}): MigrationDecision {
  const { action, actor, evidence } = input;
  if (actor === "ai_assistant") {
    return { ok: false, reason: "actor_not_authorized" };
  }
  if (actor === "client" && !["request_domain_code", "send_support_reply"].includes(action)) {
    return { ok: false, reason: "actor_not_authorized" };
  }
  if (!evidence.ownerVerified && action !== "send_support_reply") {
    return { ok: false, reason: "ownership_unverified" };
  }
  if (action === "send_support_reply" || action === "request_domain_code") {
    return { ok: true, reason: "allowed" };
  }
  if (!evidence.stripePaymentVerified && !["inspect_source", "connect_provider"].includes(action)) {
    return { ok: false, reason: "payment_not_verified" };
  }
  const riskyActions: readonly MigrationAction[] = [
    "copy_to_destination", "set_secrets", "deploy_preview", "switch_dns",
    "initiate_registrar_transfer", "rollback",
  ];
  if (riskyActions.includes(action) && actor !== "operator" && actor !== "system") {
    return { ok: false, reason: "actor_not_authorized" };
  }
  if (["copy_to_destination", "set_secrets", "deploy_preview", "switch_dns"].includes(action)
      && !evidence.recoverySnapshotVerified) {
    return { ok: false, reason: "missing_recovery_point" };
  }
  if (action === "switch_dns" && !evidence.cutoverApprovedByHuman) {
    return { ok: false, reason: "cutover_not_approved" };
  }
  if (action === "initiate_registrar_transfer" && !evidence.registrarTransferApprovedByHuman) {
    return { ok: false, reason: "domain_transfer_not_approved" };
  }
  return { ok: true, reason: "allowed" };
}

export function mayTransitionMigration(input: {
  from: MigrationStatus;
  to: MigrationStatus;
  actor: MigrationActor;
  evidence: TrustedMigrationEvidence;
}): MigrationDecision {
  const { from, to, actor, evidence } = input;
  if (!MIGRATION_STATUS_NEXT[from].includes(to)) return { ok: false, reason: "unknown_transition" };
  if (actor === "ai_assistant") return { ok: false, reason: "actor_not_authorized" };
  if (["cutting_over", "completed", "rolled_back"].includes(to) && actor !== "operator" && actor !== "system") {
    return { ok: false, reason: "actor_not_authorized" };
  }
  if (to === "auditing" && !evidence.ownerVerified) return { ok: false, reason: "ownership_unverified" };
  if (["awaiting_credentials", "backing_up", "ready", "copying", "validating", "awaiting_cutover_approval", "cutting_over", "monitoring", "completed"].includes(to)
      && !evidence.stripePaymentVerified) return { ok: false, reason: "payment_not_verified" };
  if (["ready", "copying", "validating", "awaiting_cutover_approval", "cutting_over", "monitoring", "completed"].includes(to)
      && !evidence.recoverySnapshotVerified) return { ok: false, reason: "missing_recovery_point" };
  if (["cutting_over", "monitoring", "completed"].includes(to) && !evidence.cutoverApprovedByHuman) {
    return { ok: false, reason: "cutover_not_approved" };
  }
  return { ok: true, reason: "allowed" };
}

export type VipQuote = Readonly<{
  currency: "cad";
  vipAnnualCents: number;
  domainAnnualCents: number;
  subtotalCents: number;
  taxesCents: null; // trusted Stripe Tax / billing service must compute
  totalCents: null; // do not invent a jurisdiction or taxable treatment
  domainCount: number;
  marketingAddonsIncluded: false;
}>;

/** Price preview only; Stripe product+price IDs and verified subscription drive actual access. */
export function buildVipQuote(domainCount: number): VipQuote {
  if (!Number.isSafeInteger(domainCount) || domainCount < 0 || domainCount > 100) {
    throw new RangeError("domainCount must be an integer between 0 and 100");
  }
  const domainAnnualCents = domainCount * VIP_DOMAIN_PRODUCT.amountCents;
  return {
    currency: "cad",
    vipAnnualCents: VIP_TRANSFER_PRODUCT.amountCents,
    domainAnnualCents,
    subtotalCents: VIP_TRANSFER_PRODUCT.amountCents + domainAnnualCents,
    taxesCents: null,
    totalCents: null,
    domainCount,
    marketingAddonsIncluded: false,
  };
}

/** No credential values: external source authorization lives only in a vault. */
export type MigrationIntake = Readonly<{
  clientId: string;
  domain: string;
  sourceProvider: MigrationProvider;
  websiteType: "wordpress" | "static" | "node" | "woocommerce" | "custom" | "unknown";
  domainRegistrarTransferRequested: boolean;
  mailboxesPresent: boolean;
  ecommercePresent: boolean;
  authorizedContactId: string;
  consentVersion: string;
  // Credentials are intentionally excluded.
}>;
