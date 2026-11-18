/**
 * TAKATAK Intelligence OS — pure, server-side experiment allocation foundation.
 *
 * No runtime is wired to this module. Callers must derive tenant/workspace
 * authority and approvals from authenticated server state, never browser input.
 * No cookies, analytics, writes, provider calls, or billing happen here.
 */
import { createHmac } from "node:crypto";

export type ExperimentLifecycle = "draft" | "approved" | "running" | "paused" | "completed";

export type ExperimentAllocationConfig = Readonly<{
  clientId: string;
  experimentId: string;
  revision: number;
  status: ExperimentLifecycle;
  allocationBps: number; // 0–10,000 basis points
  variants: readonly Readonly<{ id: string; weightBps: number }>[];
}>;

export type ExperimentAllocationInput = Readonly<{
  enabled: boolean;
  activeClientId: string | null; // server-resolved, never from request body
  hasHumanLaunchApproval: boolean; // server-verified, audited approval
  siteOwnershipVerified: boolean; // verified first-party site
  hasAnalyticsConsent: boolean; // consent applicable to this visitor and purpose
  anonymousSubjectId: string | null; // opaque UUID, not email/IP/customer ID
  serverSecret: string; // stable, random, server-only >= 32 characters
  experiment: ExperimentAllocationConfig;
}>;

export type ExperimentAllocationResult =
  | Readonly<{
      assigned: true;
      experimentId: string;
      revision: number;
      variantId: string;
    }>
  | Readonly<{
      assigned: false;
      reason:
        | "disabled"
        | "tenant_mismatch"
        | "not_running"
        | "approval_required"
        | "unverified_site"
        | "consent_required"
        | "invalid_configuration"
        | "not_enrolled";
    }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VARIANT_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_VARIANTS = 5;
const BASIS_POINTS = 10_000;

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
function validBps(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= BASIS_POINTS;
}

/** Fail closed: invalid configuration never silently enters traffic. */
export function isValidExperimentAllocationConfig(config: ExperimentAllocationConfig): boolean {
  if (!config || typeof config !== "object") return false;
  if (!validUuid(config.clientId) || !validUuid(config.experimentId)) return false;
  if (!Number.isSafeInteger(config.revision) || config.revision < 1) return false;
  if (!["draft", "approved", "running", "paused", "completed"].includes(config.status)) return false;
  if (!validBps(config.allocationBps)) return false;
  if (!Array.isArray(config.variants) || config.variants.length < 2 || config.variants.length > MAX_VARIANTS) return false;

  const names = new Set<string>();
  let total = 0;
  for (const variant of config.variants) {
    if (!variant || typeof variant.id !== "string" || !VARIANT_ID_RE.test(variant.id) || names.has(variant.id)) return false;
    if (!validBps(variant.weightBps) || variant.weightBps === 0) return false;
    names.add(variant.id);
    total += variant.weightBps;
  }
  return total === BASIS_POINTS;
}

/**
 * Stable, private allocation using a server-only HMAC key. A specific
 * anonymous visitor keeps its variant for the same client/experiment/revision.
 * Revision changes intentionally rebucket; production must persist assignments
 * and use sticky assignment policy before exposing live experiments.
 */
export function assignExperiment(input: ExperimentAllocationInput): ExperimentAllocationResult {
  if (input.enabled !== true) return { assigned: false, reason: "disabled" };
  const config = input.experiment;
  if (!isValidExperimentAllocationConfig(config)) return { assigned: false, reason: "invalid_configuration" };
  if (!validUuid(input.activeClientId) || input.activeClientId !== config.clientId) {
    return { assigned: false, reason: "tenant_mismatch" };
  }
  if (config.status !== "running") return { assigned: false, reason: "not_running" };
  if (input.hasHumanLaunchApproval !== true) return { assigned: false, reason: "approval_required" };
  if (input.siteOwnershipVerified !== true) return { assigned: false, reason: "unverified_site" };
  if (input.hasAnalyticsConsent !== true) return { assigned: false, reason: "consent_required" };
  if (!validUuid(input.anonymousSubjectId) || typeof input.serverSecret !== "string" || input.serverSecret.length < 32) {
    return { assigned: false, reason: "invalid_configuration" };
  }
  if (config.allocationBps === 0) return { assigned: false, reason: "not_enrolled" };

  // JSON arrays avoid delimiter collisions; raw subject identifiers never leave this function.
  const digest = createHmac("sha256", input.serverSecret)
    .update(JSON.stringify([config.clientId, config.experimentId, config.revision, input.anonymousSubjectId]))
    .digest();
  if (digest.readUInt32BE(0) % BASIS_POINTS >= config.allocationBps) {
    return { assigned: false, reason: "not_enrolled" };
  }

  const variantBucket = digest.readUInt32BE(4) % BASIS_POINTS;
  let cumulative = 0;
  for (const variant of config.variants) {
    cumulative += variant.weightBps;
    if (variantBucket < cumulative) {
      return { assigned: true, experimentId: config.experimentId, revision: config.revision, variantId: variant.id };
    }
  }
  return { assigned: false, reason: "invalid_configuration" };
}
