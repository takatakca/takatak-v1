import type { Prisma } from '@prisma/client';

import {
  SOCIAL_UNSUBSCRIBED_PLAN_CODE,
  SOCIAL_UNSUBSCRIBED_PLAN_NAME,
} from './plan-catalog';

type DbClient =
  | Prisma.TransactionClient
  | {
      clientSubscription: Prisma.TransactionClient['clientSubscription'];
    };

/**
 * Creates a blocked Social billing record when a Client has none.
 *
 * This record does not provide Social access and is never sold through Stripe.
 * Existing subscription records are never overwritten.
 */
export async function ensureDefaultSocialSubscription(
  db: DbClient,
  clientId: string,
): Promise<void> {
  await db.clientSubscription.createMany({
    data: [
      {
        clientId,
        status: 'incomplete',
        planCode: SOCIAL_UNSUBSCRIBED_PLAN_CODE,
        planName: SOCIAL_UNSUBSCRIBED_PLAN_NAME,
      },
    ],
    skipDuplicates: true,
  });
}
