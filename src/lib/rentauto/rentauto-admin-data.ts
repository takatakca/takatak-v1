import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { getPlatformAdminAccess } from "@/lib/security/platform-admin-access";

export type RentautoAdminData = {
  available: boolean;
  sourceLabel: string;
  customers: number;
  verifiedEmailProfiles: number;
  verifiedPhoneProfiles: number;
  paymentSummaries: number;
  paidAmountMinor: number;
  refundedAmountMinor: number;
  currency: string;
  lastSynchronizedAt: string | null;
  recentEvents: Array<{
    id: string;
    eventType: string;
    status: string;
    createdAt: string;
    processedAt: string | null;
  }>;
};

const emptyData = (sourceLabel: string): RentautoAdminData => ({
  available: false,
  sourceLabel,
  customers: 0,
  verifiedEmailProfiles: 0,
  verifiedPhoneProfiles: 0,
  paymentSummaries: 0,
  paidAmountMinor: 0,
  refundedAmountMinor: 0,
  currency: "CAD",
  lastSynchronizedAt: null,
  recentEvents: [],
});

export async function getRentautoAdminData(): Promise<RentautoAdminData> {
  const access = await getPlatformAdminAccess();

  if (access.mode !== "authorized") {
    return emptyData("Platform administration access is required.");
  }

  const prisma = getPrisma();
  if (!prisma) {
    return emptyData("TAKATAK database is unavailable.");
  }

  try {
    const [profiles, payments, recentEvents] = await Promise.all([
      prisma.sourceProfile.findMany({
        where: { sourceApplication: "RENTAUTO" },
        select: {
          id: true,
          verifiedFields: true,
          lastSynchronizedAt: true,
        },
      }),
      prisma.sourcePaymentSummary.findMany({
        where: { sourceApplication: "RENTAUTO" },
        select: {
          status: true,
          amountMinor: true,
          refundedAmountMinor: true,
          currency: true,
          transactionDate: true,
        },
      }),
      prisma.sourceSynchronizationEvent.findMany({
        where: { sourceApplication: "RENTAUTO" },
        select: {
          id: true,
          eventType: true,
          status: true,
          createdAt: true,
          processedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

    const verifiedEmailProfiles = profiles.filter((profile) =>
      profile.verifiedFields.includes("email"),
    ).length;

    const verifiedPhoneProfiles = profiles.filter((profile) =>
      profile.verifiedFields.includes("phone"),
    ).length;

    const paid = payments.filter((payment) =>
      payment.status === "PAID" ||
      payment.status === "PARTIALLY_REFUNDED" ||
      payment.status === "REFUNDED",
    );

    const paidAmountMinor = paid.reduce(
      (total, payment) => total + Math.max(0, payment.amountMinor),
      0,
    );

    const refundedAmountMinor = paid.reduce(
      (total, payment) =>
        total + Math.max(0, payment.refundedAmountMinor ?? 0),
      0,
    );

    const latestProfileSync = profiles.reduce<Date | null>(
      (latest, profile) =>
        !latest || profile.lastSynchronizedAt > latest
          ? profile.lastSynchronizedAt
          : latest,
      null,
    );

    const latestPaymentSync = payments.reduce<Date | null>(
      (latest, payment) =>
        !latest || payment.transactionDate > latest
          ? payment.transactionDate
          : latest,
      null,
    );

    const latestEvent = recentEvents[0]?.createdAt ?? null;
    const lastSynchronized =
      [latestProfileSync, latestPaymentSync, latestEvent]
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const currency =
      payments.find((payment) => payment.currency)?.currency?.toUpperCase() ??
      "CAD";

    return {
      available: true,
      sourceLabel:
        "Live TAKATAK master-data projection from Rentauto. Rental operations remain authoritative in Rentauto.",
      customers: profiles.length,
      verifiedEmailProfiles,
      verifiedPhoneProfiles,
      paymentSummaries: payments.length,
      paidAmountMinor,
      refundedAmountMinor,
      currency,
      lastSynchronizedAt: lastSynchronized?.toISOString() ?? null,
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        status: event.status,
        createdAt: event.createdAt.toISOString(),
        processedAt: event.processedAt?.toISOString() ?? null,
      })),
    };
  } catch (error) {
    console.error(
      "[rentauto-admin] Projection query failed:",
      error instanceof Error ? error.message : "unknown_error",
    );

    return emptyData("Rentauto projection data is temporarily unavailable.");
  }
}
