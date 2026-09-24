import { getPrisma } from "@/lib/db/prisma";

export type SocialHistoryScope = {
  clientId: string;
  businessBrandId: string | null;
};

/**
 * Durable Social usage evidence.
 *
 * This is deliberately independent from:
 * - the current subscription status;
 * - the current provider connection status;
 * - the temporary OAuth setup allowlist.
 *
 * Once a workspace has subscribed or used Social, it permanently receives
 * the real Social interface. Billing and active-account checks still decide
 * whether live or stored provider values may be displayed.
 */
export async function hasSocialHistory({
  clientId,
  businessBrandId,
}: SocialHistoryScope): Promise<boolean> {
  const prisma = getPrisma();

  if (!prisma) {
    return false;
  }

  const brandWhere = businessBrandId
    ? {
        clientId,
        businessBrandId,
      }
    : {
        clientId,
      };

  const [
    previousConnection,
    previousAccount,
    previousAnalytics,
    previousPost,
    previousAdAccount,
    previousPaidSubscription,
    previousStripeSubscriptionEvent,
  ] = await Promise.all([
    prisma.socialProviderConnection.findFirst({
      where: brandWhere,
      select: { id: true },
    }),
    prisma.socialAccount.findFirst({
      where: brandWhere,
      select: { id: true },
    }),
    prisma.socialAnalyticsDaily.findFirst({
      where: brandWhere,
      select: { id: true },
    }),
    prisma.socialPost.findFirst({
      where: brandWhere,
      select: { id: true },
    }),
    prisma.socialAdAccount.findFirst({
      where: brandWhere,
      select: { id: true },
    }),
    prisma.clientSubscription.findFirst({
      where: {
        clientId,
        OR: [
          {
            externalSubscriptionId: {
              not: null,
            },
          },
          {
            currentPeriodStart: {
              not: null,
            },
          },
          {
            currentPeriodEnd: {
              not: null,
            },
          },
          {
            planCode: {
              notIn: ["social_unsubscribed"],
            },
          },
        ],
      },
      select: { id: true },
    }),
    prisma.stripeWebhookEvent.findFirst({
      where: {
        clientId,
        type: {
          in: [
            "checkout.session.completed",
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
            "invoice.paid",
          ],
        },
      },
      select: { id: true },
    }),
  ]);

  return Boolean(
    previousConnection ||
      previousAccount ||
      previousAnalytics ||
      previousPost ||
      previousAdAccount ||
      previousPaidSubscription ||
      previousStripeSubscriptionEvent,
  );
}
