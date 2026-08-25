import "server-only";

import type { Prisma } from "@prisma/client";

import {
  evaluateClientSocialConnectionAccess,
} from "@/lib/billing/client-subscription-access-policy";
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
    };

/**
 * Centralized premium-access decision for social provider connection.
 *
 * Allowed when:
 * - ClientSubscription.status is active or trial, or
 * - a trusted server-side development bypass is enabled AND runtime is not production
 *
 * Missing subscription, past_due, canceled, and expired are denied.
 * Preview helpers and any browser-supplied flag never grant access.
 * This never invents or writes fake paid subscription status.
 */
export async function assertClientCanConnectSocial(
  db: DbClient,
  clientId: string,
): Promise<void> {
  const subscription = await db.clientSubscription.findUnique({
    where: { clientId },
    select: {
      status: true,
      developmentBypass: true,
    },
  });

  const decision = evaluateClientSocialConnectionAccess({
    status: subscription?.status,
    developmentBypass: Boolean(subscription?.developmentBypass),
  });

  if (decision.allowed) {
    return;
  }

  throw new ServiceError(
    "forbidden",
    "Social account connection requires an active subscription for this workspace.",
  );
}
