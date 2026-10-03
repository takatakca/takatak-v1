import "server-only";

import { getPrisma } from "@/lib/db/prisma";

export type OneLvMasterAdminData = {
  available: boolean;
  sourceLabel: string;
  customers: number;
  guests: number;
  verifiedEmail: number;
  verifiedPhone: number;
  masterMerchants: number;
  sourceMerchants: number;
  customerMerchantRelationships: number;
  processedEvents: number;
  failedEvents: number;
  lastSynchronizedAt: string | null;
  recentMerchants: Array<{
    id: string;
    storeName: string;
    marketplaceStatus: string | null;
    subscriptionStatus: string | null;
    subscriptionPlan: string | null;
    lastSynchronizedAt: string;
  }>;
  recentEvents: Array<{
    id: string;
    eventType: string;
    status: string;
    processedAt: string | null;
    createdAt: string;
  }>;
};

const EMPTY: OneLvMasterAdminData = {
  available: false,
  sourceLabel: "TAKATAK database unavailable",
  customers: 0,
  guests: 0,
  verifiedEmail: 0,
  verifiedPhone: 0,
  masterMerchants: 0,
  sourceMerchants: 0,
  customerMerchantRelationships: 0,
  processedEvents: 0,
  failedEvents: 0,
  lastSynchronizedAt: null,
  recentMerchants: [],
  recentEvents: [],
};

export async function getOneLvMasterAdminData(): Promise<OneLvMasterAdminData> {
  const prisma = getPrisma();
  if (!prisma) return EMPTY;

  try {
    const [
      customers,
      guests,
      verifiedEmail,
      verifiedPhone,
      sourceMerchants,
      customerMerchantRelationships,
      processedEvents,
      failedEvents,
      latestProfile,
      latestMerchant,
      latestEvent,
      recentMerchants,
      recentEvents,
    ] = await Promise.all([
      prisma.sourceProfile.count({
        where: {
          sourceApplication: "1lv",
          NOT: { accountStatus: "guest" },
        },
      }),
      prisma.sourceProfile.count({
        where: {
          sourceApplication: "1lv",
          accountStatus: "guest",
        },
      }),
      prisma.masterIdentity.count({
        where: {
          primaryEmailVerified: true,
          sourceProfiles: {
            some: { sourceApplication: "1lv" },
          },
        },
      }),
      prisma.masterIdentity.count({
        where: {
          primaryPhoneVerified: true,
          sourceProfiles: {
            some: { sourceApplication: "1lv" },
          },
        },
      }),
      prisma.sourceMerchant.count({
        where: { sourceApplication: "1lv" },
      }),
      prisma.marketplaceRelationship.count({
        where: { sourceApplication: "1lv" },
      }),
      prisma.sourceSynchronizationEvent.count({
        where: {
          sourceApplication: "1lv",
          status: "PROCESSED",
        },
      }),
      prisma.sourceSynchronizationEvent.count({
        where: {
          sourceApplication: "1lv",
          status: "FAILED",
        },
      }),
      prisma.sourceProfile.findFirst({
        where: { sourceApplication: "1lv" },
        orderBy: { lastSynchronizedAt: "desc" },
        select: { lastSynchronizedAt: true },
      }),
      prisma.sourceMerchant.findFirst({
        where: { sourceApplication: "1lv" },
        orderBy: { lastSynchronizedAt: "desc" },
        select: { lastSynchronizedAt: true },
      }),
      prisma.sourceSynchronizationEvent.findFirst({
        where: { sourceApplication: "1lv" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.sourceMerchant.findMany({
        where: { sourceApplication: "1lv" },
        orderBy: { lastSynchronizedAt: "desc" },
        take: 8,
        select: {
          id: true,
          storeName: true,
          marketplaceStatus: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          lastSynchronizedAt: true,
        },
      }),
      prisma.sourceSynchronizationEvent.findMany({
        where: { sourceApplication: "1lv" },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          eventType: true,
          status: true,
          processedAt: true,
          createdAt: true,
        },
      }),
    ]);

    const masterMerchants = await prisma.masterMerchant.count({
      where: {
        sourceMerchants: {
          some: { sourceApplication: "1lv" },
        },
      },
    });

    const timestamps = [
      latestProfile?.lastSynchronizedAt,
      latestMerchant?.lastSynchronizedAt,
      latestEvent?.createdAt,
    ].filter((value): value is Date => Boolean(value));

    const lastSynchronizedAt = timestamps.length
      ? new Date(Math.max(...timestamps.map((value) => value.getTime()))).toISOString()
      : null;

    return {
      available: true,
      sourceLabel: "TAKATAK master database",
      customers,
      guests,
      verifiedEmail,
      verifiedPhone,
      masterMerchants,
      sourceMerchants,
      customerMerchantRelationships,
      processedEvents,
      failedEvents,
      lastSynchronizedAt,
      recentMerchants: recentMerchants.map((merchant) => ({
        ...merchant,
        lastSynchronizedAt: merchant.lastSynchronizedAt.toISOString(),
      })),
      recentEvents: recentEvents.map((event) => ({
        ...event,
        processedAt: event.processedAt?.toISOString() ?? null,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error(
      "[one-lv-master-admin] Failed to read 1LV master projection:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return EMPTY;
  }
}
