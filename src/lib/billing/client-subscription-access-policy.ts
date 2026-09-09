import type { SubscriptionStatus } from "@prisma/client";

import { resolveSocialSubscriptionLifecycle } from "@/lib/billing/social/subscription-lifecycle";

export type SocialConnectionAccessDecision =
  | { allowed: true; via: "subscription" | "trusted_dev_bypass" }
  | { allowed: false; via: "denied" };

export type SocialConnectionAccessEvaluationInput = {
  status: SubscriptionStatus | null | undefined;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | string | null;
  now?: Date;
  /** Server-persisted flag only — never from the browser. */
  developmentBypass: boolean;
  /**
   * Optional overrides for deterministic tests.
   * Production callers omit these and use process.env.
   */
  nodeEnv?: string;
  vercelEnv?: string | null;
  /** Trusted server env SOCIAL_CONNECTION_DEV_BYPASS — never from the request. */
  serverDevBypassFlag?: string | null;
  /** Trusted server env SOCIAL_CONNECTION_REQUIRE_SUBSCRIPTION. */
  requireSubscriptionFlag?: string | null;
};

export const SOCIAL_CONNECTION_DEV_BYPASS_ENV =
  "SOCIAL_CONNECTION_DEV_BYPASS";

function readEnv(name: string): string | undefined {
  return process.env[name];
}

/**
 * Production means either Node or Vercel reports production.
 * Bypass is impossible whenever either signal is production.
 */
export function isProductionSocialRuntime(
  nodeEnv: string | undefined = readEnv("NODE_ENV"),
  vercelEnv: string | null | undefined = readEnv("VERCEL_ENV") ?? null,
): boolean {
  return nodeEnv === "production" || vercelEnv === "production";
}

function isTruthyServerFlag(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

/**
 * Trusted non-production bypass sources (server-only inputs):
 * - Non-production application runtime (NODE_ENV / VERCEL_ENV), or
 * - ClientSubscription.developmentBypass in the database, or
 * - SOCIAL_CONNECTION_DEV_BYPASS process env
 *
 * Browser values (`?preview=`, request body `bypass`, headers) are never inputs.
 * Set SOCIAL_CONNECTION_REQUIRE_SUBSCRIPTION=true to force real subscription
 * checks even outside production.
 */
export function isTrustedSocialConnectionDevBypassEnabled(
  input: Pick<
    SocialConnectionAccessEvaluationInput,
    | "developmentBypass"
    | "nodeEnv"
    | "vercelEnv"
    | "serverDevBypassFlag"
  > & {
    requireSubscriptionFlag?: string | null;
  },
): boolean {
  if (
    isProductionSocialRuntime(
      input.nodeEnv ?? readEnv("NODE_ENV"),
      input.vercelEnv === undefined
        ? (readEnv("VERCEL_ENV") ?? null)
        : input.vercelEnv,
    )
  ) {
    return false;
  }

  const requireSubscription =
    input.requireSubscriptionFlag === undefined
      ? readEnv("SOCIAL_CONNECTION_REQUIRE_SUBSCRIPTION")
      : input.requireSubscriptionFlag;

  const envFlag =
    input.serverDevBypassFlag === undefined
      ? readEnv(SOCIAL_CONNECTION_DEV_BYPASS_ENV)
      : input.serverDevBypassFlag;

  // Explicit flags always count as trusted bypass outside production.
  if (
    Boolean(input.developmentBypass) ||
    isTruthyServerFlag(envFlag)
  ) {
    return true;
  }

  // Default outside production: runtime itself is the trusted server signal
  // for local/manual Meta OAuth testing (no fake paid status written).
  // Operators can opt into strict subscription checks with
  // SOCIAL_CONNECTION_REQUIRE_SUBSCRIPTION=true.
  if (isTruthyServerFlag(requireSubscription)) {
    return false;
  }

  return true;
}

/**
 * Pure access decision used by assertClientCanConnectSocial and tests.
 * Does not read request/query/body — callers must never pass browser values here.
 */
export function evaluateClientSocialConnectionAccess(
  input: SocialConnectionAccessEvaluationInput,
): SocialConnectionAccessDecision {
  if (
    isTrustedSocialConnectionDevBypassEnabled({
      developmentBypass: input.developmentBypass,
      nodeEnv: input.nodeEnv,
      vercelEnv: input.vercelEnv,
      serverDevBypassFlag: input.serverDevBypassFlag,
      requireSubscriptionFlag: input.requireSubscriptionFlag,
    })
  ) {
    return { allowed: true, via: "trusted_dev_bypass" };
  }

  const lifecycle = resolveSocialSubscriptionLifecycle({
    status: input.status,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    currentPeriodEnd: input.currentPeriodEnd,
    now: input.now,
  });

  if (lifecycle.access === "paid" || lifecycle.access === "free") {
    return { allowed: true, via: "subscription" };
  }

  return { allowed: false, via: "denied" };
}
