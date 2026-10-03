import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

import { adsSubscriptionAllows } from "./subscription-policy";
import type { CreateAdsCampaignInput } from "./management-validation";
import type { AdsFeature } from "./types";

function requiredFeatureForScope(
  scope: CreateAdsCampaignInput["scope"],
): AdsFeature {
  if (scope === "single_site") return "single_site_campaigns";
  if (scope === "max_lead_pro") return "max_lead_pro";
  return "network_campaigns";
}

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "TAKATAK ADS is temporarily unavailable.",
    );
  }
  return prisma;
}

export async function getAdsWorkspaceSnapshot(
  clientId: string,
) {
  const prisma = requirePrisma();

  const [subscription, campaigns, publishers, aggregate] =
    await Promise.all([
      prisma.adSubscription.findUnique({
        where: { clientId },
        select: {
          status: true,
          planCode: true,
          planName: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      }),
      prisma.adCampaign.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          scope: true,
          pricingModel: true,
          budgetCents: true,
          spentCents: true,
          currency: true,
          startsAt: true,
          endsAt: true,
          createdAt: true,
          businessBrand: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              creatives: true,
              placements: true,
              events: true,
            },
          },
        },
      }),
      prisma.adPublisher.findMany({
        where: { status: "active" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          domain: true,
          category: true,
          placements: {
            where: { status: "active" },
            orderBy: { name: "asc" },
            select: {
              id: true,
              code: true,
              name: true,
              format: true,
              device: true,
            },
          },
        },
      }),
      prisma.adEvent.groupBy({
        by: ["type"],
        where: {
          campaign: { clientId },
        },
        _count: { _all: true },
      }),
    ]);

  const eventCounts = Object.fromEntries(
    aggregate.map((row) => [row.type, row._count._all]),
  );

  return {
    subscription,
    campaigns,
    publishers,
    totals: {
      campaigns: campaigns.length,
      budgetCents: campaigns.reduce(
        (total, campaign) => total + campaign.budgetCents,
        0,
      ),
      spentCents: campaigns.reduce(
        (total, campaign) => total + campaign.spentCents,
        0,
      ),
      impressions: eventCounts.impression ?? 0,
      clicks: eventCounts.click ?? 0,
      leads: eventCounts.lead ?? 0,
      conversions: eventCounts.conversion ?? 0,
    },
  };
}

export async function createAdsCampaign(
  clientId: string,
  input: CreateAdsCampaignInput,
) {
  const prisma = requirePrisma();

  const subscription = await prisma.adSubscription.findUnique({
    where: { clientId },
    select: {
      status: true,
      planCode: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  const requiredFeature = requiredFeatureForScope(input.scope);
  if (
    !subscription ||
    !adsSubscriptionAllows(subscription, requiredFeature)
  ) {
    throw new ServiceError(
      "forbidden",
      "Your TAKATAK ADS subscription does not allow this campaign type.",
    );
  }

  if (input.businessBrandId) {
    const brand = await prisma.businessBrand.findFirst({
      where: {
        id: input.businessBrandId,
        clientId,
      },
      select: { id: true },
    });
    if (!brand) {
      throw new ServiceError(
        "invalid_input",
        "The selected brand does not belong to this workspace.",
        {
          fieldErrors: {
            businessBrandId: "Choose a brand from this workspace.",
          },
        },
      );
    }
  }

  let placements: Array<{ id: string }> = [];
  if (input.placementIds.length > 0) {
    placements = await prisma.adPlacement.findMany({
      where: {
        id: { in: input.placementIds },
        status: "active",
        publisher: { status: "active" },
      },
      select: { id: true },
    });

    if (placements.length !== input.placementIds.length) {
      throw new ServiceError(
        "invalid_input",
        "One or more ad placements are unavailable.",
        {
          fieldErrors: {
            placementIds: "Choose only active TAKATAK ADS placements.",
          },
        },
      );
    }
  }

  if (input.scope === "single_site" && placements.length === 0) {
    throw new ServiceError(
      "invalid_input",
      "TAKATAK ADS Direct requires a placement.",
    );
  }

  return prisma.adCampaign.create({
    data: {
      clientId,
      businessBrandId: input.businessBrandId,
      name: input.name,
      scope: input.scope,
      objective: input.objective,
      pricingModel: input.pricingModel,
      budgetCents: input.budgetCents,
      dailyBudgetCents: input.dailyBudgetCents,
      bidCents: input.bidCents,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      targeting: input.targeting,
      status: "draft",
      creatives: {
        create: {
          name: input.creative.name,
          headline: input.creative.headline,
          body: input.creative.body,
          callToAction: input.creative.callToAction,
          destinationUrl: input.creative.destinationUrl,
          imageUrl: input.creative.imageUrl,
          status: "draft",
        },
      },
      placements:
        placements.length > 0
          ? {
              create: placements.map((placement) => ({
                placementId: placement.id,
              })),
            }
          : undefined,
    },
    select: {
      id: true,
      name: true,
      status: true,
      scope: true,
      pricingModel: true,
      budgetCents: true,
      currency: true,
      createdAt: true,
    },
  });
}

export async function updateAdsCampaignStatus(
  clientId: string,
  campaignId: string,
  status: "draft" | "active" | "paused" | "completed" | "canceled",
) {
  const prisma = requirePrisma();

  const campaign = await prisma.adCampaign.findFirst({
    where: { id: campaignId, clientId },
    select: {
      id: true,
      scope: true,
      budgetCents: true,
      spentCents: true,
      _count: {
        select: {
          creatives: {
            where: { status: "active" },
          },
          placements: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new ServiceError("not_found", "Campaign not found.");
  }

  if (status === "active") {
    const subscription = await prisma.adSubscription.findUnique({
      where: { clientId },
      select: {
        status: true,
        planCode: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    });

    if (
      !subscription ||
      !adsSubscriptionAllows(
        subscription,
        requiredFeatureForScope(campaign.scope),
      )
    ) {
      throw new ServiceError(
        "forbidden",
        "An active TAKATAK ADS entitlement is required to launch this campaign.",
      );
    }

    if (campaign.spentCents >= campaign.budgetCents) {
      throw new ServiceError(
        "conflict",
        "This campaign budget is already exhausted.",
      );
    }

    if (campaign._count.creatives === 0) {
      throw new ServiceError(
        "conflict",
        "Activate at least one approved creative before launching this campaign.",
      );
    }

    if (
      campaign.scope === "single_site" &&
      campaign._count.placements === 0
    ) {
      throw new ServiceError(
        "conflict",
        "TAKATAK ADS Direct needs at least one placement before launch.",
      );
    }
  }

  return prisma.adCampaign.update({
    where: { id: campaign.id },
    data: { status },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
    },
  });
}


export async function updateAdsCreativeStatus(
  clientId: string,
  creativeId: string,
  status: "draft" | "active" | "paused" | "rejected" | "archived",
) {
  const prisma = requirePrisma();

  const creative = await prisma.adCreative.findFirst({
    where: {
      id: creativeId,
      campaign: { clientId },
    },
    select: {
      id: true,
      campaignId: true,
      destinationUrl: true,
      headline: true,
    },
  });

  if (!creative) {
    throw new ServiceError("not_found", "Creative not found.");
  }

  if (
    status === "active" &&
    (!creative.headline.trim() || !creative.destinationUrl.trim())
  ) {
    throw new ServiceError(
      "conflict",
      "A headline and destination URL are required before activation.",
    );
  }

  return prisma.adCreative.update({
    where: { id: creative.id },
    data: { status },
    select: {
      id: true,
      campaignId: true,
      name: true,
      status: true,
      updatedAt: true,
    },
  });
}
