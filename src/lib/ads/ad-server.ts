import "server-only";

import { getPrisma } from "@/lib/db/prisma";

import {
  adsPlanHasFeature,
  isAdsPlanCode,
} from "./plan-catalog";
import {
  resolveAdsSubscriptionAccess,
} from "./subscription-policy";
import {
  adsTargetingSpecificity,
  matchesAdsTargeting,
  parseAdsTargetingRules,
} from "./targeting";
import { createAdsTrackingToken } from "./tracking-token";
import type {
  AdsFeature,
  AdsTargetingContext,
  ServedAd,
} from "./types";

export type ServeAdsInput = {
  publisherCode: string;
  placementCode: string;
  context?: AdsTargetingContext;
  now?: Date;
};

export type RecordPublicAdsEventInput = {
  campaignId: string;
  creativeId: string;
  placementId: string;
  nonce: string;
  eventType: "impression" | "click";
  context?: AdsTargetingContext;
};

type Candidate = {
  id: string;
  scope: "single_site" | "local_network" | "max_lead_pro";
  pricingModel: "cpm" | "cpc" | "cpl" | "fixed";
  budgetCents: number;
  spentCents: number;
  bidCents: number | null;
  targeting: unknown;
  createdAt: Date;
  client: {
    adSubscription: {
      status: string;
      planCode: string | null;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
    } | null;
  };
  creatives: Array<{
    id: string;
    headline: string;
    body: string | null;
    callToAction: string | null;
    destinationUrl: string;
    imageUrl: string | null;
  }>;
};

function requiredFeature(
  scope: Candidate["scope"],
): AdsFeature {
  if (scope === "single_site") return "single_site_campaigns";
  if (scope === "max_lead_pro") return "max_lead_pro";
  return "network_campaigns";
}

function isSafeDestinationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function candidateScore(candidate: Candidate): number {
  const scopeScore =
    candidate.scope === "single_site"
      ? 300
      : candidate.scope === "max_lead_pro"
        ? 220
        : 180;

  const targetingScore =
    adsTargetingSpecificity(
      parseAdsTargetingRules(candidate.targeting),
    ) * 10;

  const utilization =
    candidate.budgetCents > 0
      ? Math.min(1, candidate.spentCents / candidate.budgetCents)
      : 1;

  return scopeScore + targetingScore - utilization * 50;
}

function cleanContext(
  context: AdsTargetingContext | undefined,
): AdsTargetingContext {
  const safe = (value: string | null | undefined, max: number) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed.slice(0, max) : null;
  };

  return {
    country: safe(context?.country, 80),
    region: safe(context?.region, 120),
    city: safe(context?.city, 120),
    postalPrefix: safe(context?.postalPrefix, 12),
    category: safe(context?.category, 120),
    locale: safe(context?.locale, 16),
    device: safe(context?.device, 24),
  };
}

export async function serveAds(
  input: ServeAdsInput,
): Promise<ServedAd | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  const publisherCode = input.publisherCode.trim();
  const placementCode = input.placementCode.trim();
  if (!publisherCode || !placementCode) return null;

  const placement = await prisma.adPlacement.findFirst({
    where: {
      code: placementCode,
      status: "active",
      publisher: {
        code: publisherCode,
        status: "active",
      },
    },
    select: {
      id: true,
      publisher: {
        select: {
          category: true,
          country: true,
          region: true,
        },
      },
    },
  });

  if (!placement) return null;

  const now = input.now ?? new Date();
  const candidates = await prisma.adCampaign.findMany({
    where: {
      status: "active",
      spentCents: { lt: prisma.adCampaign.fields.budgetCents },
      AND: [
        {
          OR: [
            { startsAt: null },
            { startsAt: { lte: now } },
          ],
        },
        {
          OR: [
            { endsAt: null },
            { endsAt: { gt: now } },
          ],
        },
        {
          OR: [
            {
              scope: "single_site",
              placements: {
                some: { placementId: placement.id },
              },
            },
            {
              scope: {
                in: ["local_network", "max_lead_pro"],
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      scope: true,
      pricingModel: true,
      budgetCents: true,
      spentCents: true,
      bidCents: true,
      targeting: true,
      createdAt: true,
      client: {
        select: {
          adSubscription: {
            select: {
              status: true,
              planCode: true,
              currentPeriodEnd: true,
              cancelAtPeriodEnd: true,
            },
          },
        },
      },
      creatives: {
        where: { status: "active" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          id: true,
          headline: true,
          body: true,
          callToAction: true,
          destinationUrl: true,
          imageUrl: true,
        },
      },
    },
    take: 50,
  });

  const context = cleanContext({
    ...input.context,
    country:
      input.context?.country ??
      placement.publisher.country,
    region:
      input.context?.region ??
      placement.publisher.region,
    category:
      input.context?.category ??
      placement.publisher.category,
  });

  const eligible = (candidates as Candidate[])
    .filter((candidate) => {
      const subscription = candidate.client.adSubscription;
      if (!subscription) return false;

      if (
        resolveAdsSubscriptionAccess(subscription) !== "paid" ||
        !isAdsPlanCode(subscription.planCode)
      ) {
        return false;
      }

      if (
        !adsPlanHasFeature(
          subscription.planCode,
          requiredFeature(candidate.scope),
        )
      ) {
        return false;
      }

      if (!candidate.creatives[0]) return false;
      if (!isSafeDestinationUrl(candidate.creatives[0].destinationUrl)) {
        return false;
      }

      return matchesAdsTargeting(
        parseAdsTargetingRules(candidate.targeting),
        context,
      );
    })
    .sort((a, b) => {
      const scoreDiff = candidateScore(b) - candidateScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  const campaign = eligible[0];
  const creative = campaign?.creatives[0];
  if (!campaign || !creative) return null;

  const trackingToken = createAdsTrackingToken({
    campaignId: campaign.id,
    creativeId: creative.id,
    placementId: placement.id,
  });

  const locale = (context.locale ?? "").toLowerCase();
  return {
    campaignId: campaign.id,
    creativeId: creative.id,
    placementId: placement.id,
    headline: creative.headline,
    body: creative.body,
    callToAction: creative.callToAction,
    destinationUrl: creative.destinationUrl,
    imageUrl: creative.imageUrl,
    label: locale.startsWith("fr") ? "Publicité" : "Advertisement",
    trackingToken,
    trackingEnabled: Boolean(trackingToken),
  };
}

export async function recordPublicAdsEvent(
  input: RecordPublicAdsEventInput,
): Promise<{ duplicate: boolean }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("ADS_DATABASE_UNAVAILABLE");
  }

  const context = cleanContext(input.context);
  const dedupeKey =
    `public:${input.nonce}:${input.eventType}`;

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: input.campaignId },
    select: {
      id: true,
      pricingModel: true,
      bidCents: true,
    },
  });
  if (!campaign) {
    throw new Error("ADS_CAMPAIGN_NOT_FOUND");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adEvent.create({
        data: {
          campaignId: input.campaignId,
          creativeId: input.creativeId,
          placementId: input.placementId,
          type: input.eventType,
          dedupeKey,
          country: context.country,
          region: context.region,
          city: context.city,
          postalPrefix: context.postalPrefix,
          locale: context.locale,
          metadata: context.device
            ? { device: context.device }
            : undefined,
        },
      });

      if (
        input.eventType === "click" &&
        campaign.pricingModel === "cpc" &&
        (campaign.bidCents ?? 0) > 0
      ) {
        await tx.adCampaign.update({
          where: { id: campaign.id },
          data: {
            spentCents: {
              increment: campaign.bidCents ?? 0,
            },
          },
        });
      }
    });
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (code === "P2002") {
      return { duplicate: true };
    }
    throw error;
  }

  return { duplicate: false };
}
