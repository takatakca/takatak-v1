import {
  SocialSummaryDashboard,
  type SocialAdPlatformKey,
  type SocialPlatformKey,
  type SocialSummaryData,
} from "@/components/social/analytics/social-summary-dashboard";
import { getPrisma } from "@/lib/db/prisma";
import { getSocialShellBilling } from "@/lib/billing/social/billing-banner";
import { hasSocialHistory } from "@/lib/social/social-history";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic =
  "force-dynamic";

export default async function SocialSummaryPage() {
  const access =
    await requireWorkspacePermission(
      "view_social",
      "/dashboard/social",
    );

  const brand =
    await resolveBrandSessionContextFromRequest(
      access,
    );

  const data: SocialSummaryData = {
    activeBrandId:
      brand.activeBrandId,

    activeBrandName:
      brand.activeBrandName,

    hasConnectedAccounts:
      false,

    hasSocialHistory: false,
    dataUnavailable:
      false,

    accounts: [],
    accountDaily: [],
    posts: [],
    adAccounts: [],
    adDaily: [],
  };

  const prisma =
    getPrisma();

  if (!prisma) {
    data.dataUnavailable =
      true;

    return (
      <SocialSummaryDashboard
        data={data}
      />
    );
  }

  if (
    !brand.activeBrandId
  ) {
    return (
      <SocialSummaryDashboard
        data={data}
      />
    );
  }

  // First-time onboarding and current access are different.
  // Returning users keep the real dashboard permanently.
  try {
    data.hasSocialHistory = await hasSocialHistory({
      clientId: access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });
  } catch (error) {
    data.dataUnavailable = true;
    console.error(
      "[social-summary] Social history could not be determined:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return <SocialSummaryDashboard data={data} />;
  }

  // Analytics remain subscription-gated. The temporary setup allowlist
  // permits OAuth connection only and must never expose saved analytics.
  const billing = await getSocialShellBilling(
    access.activeClientId,
  );

  if (!billing?.hasPaidPlan) {
    return (
      <SocialSummaryDashboard
        data={data}
      />
    );
  }

  const rangeStart =
    new Date();

  rangeStart.setUTCHours(
    0,
    0,
    0,
    0,
  );

  rangeStart.setUTCDate(
    rangeStart.getUTCDate() -
      365,
  );

  try {
    const [
      accounts,
      accountDaily,
      posts,
      adAccounts,
      adDaily,
    ] = await Promise.all([
      prisma.socialAccount.findMany(
        {
          where: {
            clientId:
              access.activeClientId,

            businessBrandId:
              brand.activeBrandId,

            status:
              "connected",

            providerConnectionId:
              {
                not: null,
              },

            externalAccountId:
              {
                not: null,
              },
            providerConnection: {
              is: {
                clientId:
                  access.activeClientId,
                businessBrandId:
                  brand.activeBrandId,
                status:
                  "connected",
                disconnectedAt:
                  null,
              },
            },
          },

          select: {
            id: true,
            platform: true,
            displayName: true,
            handle: true,
          },

          orderBy: [
            {
              platform:
                "asc",
            },
            {
              displayName:
                "asc",
            },
          ],
        },
      ),

      prisma.socialAnalyticsDaily.findMany(
        {
          where: {
            clientId:
              access.activeClientId,

            businessBrandId:
              brand.activeBrandId,

            source:
              "provider_api",

            date: {
              gte: rangeStart,
            },
            socialAccount: {
              is: {
                clientId:
                  access.activeClientId,
                businessBrandId:
                  brand.activeBrandId,
                status:
                  "connected",
                providerConnectionId: {
                  not: null,
                },
                externalAccountId: {
                  not: null,
                },
                providerConnection: {
                  is: {
                    clientId:
                      access.activeClientId,
                    businessBrandId:
                      brand.activeBrandId,
                    status:
                      "connected",
                    disconnectedAt:
                      null,
                  },
                },
              },
            },
          },

          select: {
            date: true,
            platform: true,
            followers: true,
            impressions: true,
            reach: true,
            engagement: true,
            clicks: true,
          },

          orderBy: [
            {
              date: "asc",
            },
            {
              platform:
                "asc",
            },
          ],
        },
      ),

      prisma.socialPost.findMany(
        {
          where: {
            clientId:
              access.activeClientId,

            businessBrandId:
              brand.activeBrandId,

            OR: [
              {
                publishedAt:
                  {
                    gte: rangeStart,
                  },
              },
              {
                scheduledAt:
                  {
                    gte: rangeStart,
                  },
              },
            ],
            socialAccount: {
              is: {
                clientId:
                  access.activeClientId,
                businessBrandId:
                  brand.activeBrandId,
                status:
                  "connected",
                providerConnectionId: {
                  not: null,
                },
                externalAccountId: {
                  not: null,
                },
                providerConnection: {
                  is: {
                    clientId:
                      access.activeClientId,
                    businessBrandId:
                      brand.activeBrandId,
                    status:
                      "connected",
                    disconnectedAt:
                      null,
                  },
                },
              },
            },
          },

          select: {
            id: true,
            platform: true,
            caption: true,
            status: true,
            scheduledAt: true,
            publishedAt: true,
            createdAt: true,
          },

          orderBy: {
            createdAt:
              "desc",
          },

          take: 500,
        },
      ),

      prisma.socialAdAccount.findMany(
        {
          where: {
            clientId:
              access.activeClientId,

            businessBrandId:
              brand.activeBrandId,

            status:
              "connected",
            providerConnection: {
              is: {
                clientId:
                  access.activeClientId,
                businessBrandId:
                  brand.activeBrandId,
                status:
                  "connected",
                disconnectedAt:
                  null,
              },
            },
          },

          select: {
            id: true,
            platform: true,
            displayName: true,
            externalAccountId:
              true,
            currency: true,
          },

          orderBy: [
            {
              platform:
                "asc",
            },
            {
              displayName:
                "asc",
            },
          ],
        },
      ),

      prisma.socialAdAnalyticsDaily.findMany(
        {
          where: {
            clientId:
              access.activeClientId,

            businessBrandId:
              brand.activeBrandId,

            source:
              "provider_api",

            date: {
              gte: rangeStart,
            },
            adAccount: {
              is: {
                clientId:
                  access.activeClientId,
                businessBrandId:
                  brand.activeBrandId,
                status:
                  "connected",
                providerConnectionId: {
                  not: null,
                },
                providerConnection: {
                  is: {
                    clientId:
                      access.activeClientId,
                    businessBrandId:
                      brand.activeBrandId,
                    status:
                      "connected",
                    disconnectedAt:
                      null,
                  },
                },
              },
            },
          },

          select: {
            date: true,
            platform: true,
            impressions: true,
            clicks: true,
            spendMinor: true,
            currency: true,
          },

          orderBy: [
            {
              date: "asc",
            },
            {
              platform:
                "asc",
            },
          ],
        },
      ),
    ]);

    data.accounts =
      accounts.map(
        (account) => ({
          ...account,

          platform:
            account.platform as SocialPlatformKey,
        }),
      );

    data.accountDaily =
      accountDaily.map(
        (row) => ({
          date: row.date
            .toISOString()
            .slice(0, 10),

          platform:
            row.platform as SocialPlatformKey,

          followers:
            row.followers,

          impressions:
            row.impressions,

          reach:
            row.reach,

          engagement:
            row.engagement,

          clicks:
            row.clicks,
        }),
      );

    data.posts =
      posts.map(
        (post) => ({
          id: post.id,

          platform:
            post.platform as SocialPlatformKey,

          caption:
            post.caption,

          status:
            post.status,

          scheduledAt:
            post.scheduledAt?.toISOString() ??
            null,

          publishedAt:
            post.publishedAt?.toISOString() ??
            null,

          createdAt:
            post.createdAt.toISOString(),
        }),
      );

    data.adAccounts =
      adAccounts.map(
        (account) => ({
          ...account,

          platform:
            account.platform as SocialAdPlatformKey,
        }),
      );

    data.adDaily =
      adDaily.map(
        (row) => ({
          date: row.date
            .toISOString()
            .slice(0, 10),

          platform:
            row.platform as SocialAdPlatformKey,

          impressions:
            row.impressions,

          clicks:
            row.clicks,

          spendMinor:
            row.spendMinor,

          currency:
            row.currency,
        }),
      );

    data.hasConnectedAccounts =
      data.accounts.length >
        0 ||
      data.adAccounts.length >
        0;
  } catch (error) {
    data.dataUnavailable =
      true;

    console.error(
      "[social-summary] Dashboard data could not be loaded:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );
  }

  return (
    <SocialSummaryDashboard
      data={data}
    />
  );
}