import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

export const FLEXS_AD_EVENT_TYPES = [
  "lead",
  "call",
  "form_submit",
  "conversion",
] as const;

export type FlexsAdEventType =
  (typeof FLEXS_AD_EVENT_TYPES)[number];

export type FlexsAdAttributionInput = {
  attributionId: string;
  externalEventId: string;
  eventType: FlexsAdEventType;
  occurredAt: Date | null;
  sourceReference: string | null;
  valueCents: number | null;
  currency: string | null;
};

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "TAKATAK ADS attribution is temporarily unavailable.",
    );
  }
  return prisma;
}

export async function recordFlexsAdAttribution(
  input: FlexsAdAttributionInput,
): Promise<{
  duplicate: boolean;
  eventId: string | null;
  campaignId: string;
}> {
  const prisma = requirePrisma();

  const click = await prisma.adEvent.findUnique({
    where: {
      dedupeKey: `public:${input.attributionId}:click`,
    },
    select: {
      campaignId: true,
      creativeId: true,
      placementId: true,
      country: true,
      region: true,
      city: true,
      postalPrefix: true,
      locale: true,
    },
  });

  if (!click) {
    throw new ServiceError(
      "not_found",
      "No TAKATAK ADS click matches this attribution id.",
    );
  }

  const metadata: Record<string, string | number> = {
    source: "flexs",
    externalEventId: input.externalEventId,
  };
  if (input.sourceReference) {
    metadata.sourceReference = input.sourceReference;
  }
  if (input.valueCents !== null) {
    metadata.valueCents = input.valueCents;
  }
  if (input.currency) {
    metadata.currency = input.currency;
  }

  const dedupeKey =
    `flexs:${input.eventType}:${input.externalEventId}`;

  try {
    const event = await prisma.adEvent.create({
      data: {
        campaignId: click.campaignId,
        creativeId: click.creativeId,
        placementId: click.placementId,
        type: input.eventType,
        dedupeKey,
        occurredAt: input.occurredAt ?? undefined,
        country: click.country,
        region: click.region,
        city: click.city,
        postalPrefix: click.postalPrefix,
        locale: click.locale,
        metadata,
      },
      select: {
        id: true,
        campaignId: true,
      },
    });

    return {
      duplicate: false,
      eventId: event.id,
      campaignId: event.campaignId,
    };
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (code === "P2002") {
      return {
        duplicate: true,
        eventId: null,
        campaignId: click.campaignId,
      };
    }

    throw error;
  }
}
