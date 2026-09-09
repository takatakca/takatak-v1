import type { Prisma } from "@prisma/client";

import {
  SOCIAL_FREE_PLAN_CODE,
  SOCIAL_FREE_PLAN_NAME,
} from "./plan-catalog";

type DbClient =
  | Prisma.TransactionClient
  | {
      clientSubscription: Prisma.TransactionClient["clientSubscription"];
    };

/**
 * Give a Client a Free Social subscription row if none exists.
 * Never overwrites an existing row (paid or otherwise).
 */
export async function ensureDefaultSocialSubscription(
  db: DbClient,
  clientId: string,
): Promise<void> {
  await db.clientSubscription.createMany({
    data: [
      {
        clientId,
        status: "free",
        planCode: SOCIAL_FREE_PLAN_CODE,
        planName: SOCIAL_FREE_PLAN_NAME,
      },
    ],
    skipDuplicates: true,
  });
}
