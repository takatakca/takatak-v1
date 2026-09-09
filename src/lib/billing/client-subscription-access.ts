import "server-only";

import type { Prisma } from "@prisma/client";

import {
  evaluateClientSocialConnectionAccess,
} from "@/lib/billing/client-subscription-access-policy";
import { assertClientCanConnectSocialNetwork } from "@/lib/billing/social/entitlement-gates";
import { ServiceError } from "@/lib/services/service-error";

export {
  evaluateClientSocialConnectionAccess,
  isProductionSocialRuntime,
  isTrustedSocialConnectionDevBypassEnabled,
  SOCIAL_CONNECTION_DEV_BYPASS_ENV,
  type SocialConnectionAccessDecision,
  type SocialConnectionAccessEvaluationInput,
} from "@/lib/billing/client-subscription-access-policy";

type DbClient =
  | Prisma.TransactionClient
  | {
      clientSubscription: Prisma.TransactionClient["clientSubscription"];
      socialAccount?: Prisma.TransactionClient["socialAccount"];
    };

export type AssertClientCanConnectSocialOptions = {
  provider?: string;
  reconnect?: boolean;
};

/**
 * Centralized premium-access decision for social provider connection.
 *
 * Allowed when:
 * - subscription lifecycle is paid (active, trial, past_due, grace, or
 *   canceled with time remaining) or Free (including expired fallback), or
 * - a trusted server-side development bypass is enabled AND runtime is not production
 *
 * Missing, incomplete, paused, and suspended are denied.
 * When `provider` is passed, the plan must also allow that network
 * (LinkedIn on Starter+, X only with add-on slots). Dev bypass does
 * not skip the network gate.
 * Preview helpers and any browser-supplied flag never grant access.
 * This never invents or writes fake paid subscription status.
 */
export async function assertClientCanConnectSocial(
  db: DbClient,
  clientId: string,
  options?: AssertClientCanConnectSocialOptions,
): Promise<void> {
  const subscription = await db.clientSubscription.findUnique({
    where: { clientId },
    select: {
      status: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
      developmentBypass: true,
    },
  });

  const decision = evaluateClientSocialConnectionAccess({
    status: subscription?.status,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
    currentPeriodEnd: subscription?.currentPeriodEnd,
    developmentBypass: Boolean(subscription?.developmentBypass),
  });

  if (!decision.allowed) {
    throw new ServiceError(
      "forbidden",
      "Social account connection is not available for this workspace.",
    );
  }

  if (options?.provider) {
    await assertClientCanConnectSocialNetwork(
      db,
      clientId,
      options.provider,
      { reconnect: options.reconnect },
    );
  }
}
