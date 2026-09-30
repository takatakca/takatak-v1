import "server-only";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { getPrisma } from "@/lib/db/prisma";

export type RentautoClientData = {
  linked: boolean;
  sourceLabel: string;
  accountStatus: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastSynchronizedAt: string | null;
  paymentSummaries: Array<{
    bookingNumber: string;
    status: string;
    amountMinor: number;
    refundedAmountMinor: number | null;
    currency: string;
    transactionDate: string;
  }>;
};

export async function getRentautoClientData(): Promise<RentautoClientData> {
  const user = await getSessionUser();
  const prisma = getPrisma();

  if (!user || !prisma) {
    return {
      linked: false,
      sourceLabel: "Rentauto account link is unavailable.",
      accountStatus: null,
      emailVerified: false,
      phoneVerified: false,
      lastSynchronizedAt: null,
      paymentSummaries: [],
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { authUserId: user.id },
    select: {
      id: true,
      masterIdentity: {
        select: {
          id: true,
          primaryEmailVerified: true,
          primaryPhoneVerified: true,
        },
      },
    },
  });

  if (!profile?.masterIdentity) {
    return {
      linked: false,
      sourceLabel: "No Rentauto identity is linked to this TAKATAK account yet.",
      accountStatus: null,
      emailVerified: false,
      phoneVerified: false,
      lastSynchronizedAt: null,
      paymentSummaries: [],
    };
  }

  const source = await prisma.sourceProfile.findUnique({
    where: {
      sourceApplication_externalUserId: {
        sourceApplication: "RENTAUTO",
        externalUserId: user.id,
      },
    },
    select: {
      id: true,
      accountStatus: true,
      verifiedFields: true,
      lastSynchronizedAt: true,
      paymentSummaries: {
        select: {
          bookingNumber: true,
          status: true,
          amountMinor: true,
          refundedAmountMinor: true,
          currency: true,
          transactionDate: true,
        },
        orderBy: { transactionDate: "desc" },
        take: 12,
      },
    },
  });

  if (!source) {
    const identitySource = await prisma.sourceProfile.findFirst({
      where: {
        identityId: profile.masterIdentity.id,
        sourceApplication: "RENTAUTO",
      },
      select: {
        id: true,
        accountStatus: true,
        verifiedFields: true,
        lastSynchronizedAt: true,
        paymentSummaries: {
          select: {
            bookingNumber: true,
            status: true,
            amountMinor: true,
            refundedAmountMinor: true,
            currency: true,
            transactionDate: true,
          },
          orderBy: { transactionDate: "desc" },
          take: 12,
        },
      },
    });

    if (!identitySource) {
      return {
        linked: false,
        sourceLabel: "No Rentauto profile is linked to this master identity yet.",
        accountStatus: null,
        emailVerified: profile.masterIdentity.primaryEmailVerified,
        phoneVerified: profile.masterIdentity.primaryPhoneVerified,
        lastSynchronizedAt: null,
        paymentSummaries: [],
      };
    }

    return {
      linked: true,
      sourceLabel: "Rentauto account linked through your TAKATAK master identity.",
      accountStatus: identitySource.accountStatus,
      emailVerified:
        identitySource.verifiedFields.includes("email") ||
        profile.masterIdentity.primaryEmailVerified,
      phoneVerified:
        identitySource.verifiedFields.includes("phone") ||
        profile.masterIdentity.primaryPhoneVerified,
      lastSynchronizedAt: identitySource.lastSynchronizedAt.toISOString(),
      paymentSummaries: identitySource.paymentSummaries.map((payment) => ({
        bookingNumber: payment.bookingNumber,
        status: payment.status,
        amountMinor: payment.amountMinor,
        refundedAmountMinor: payment.refundedAmountMinor,
        currency: payment.currency,
        transactionDate: payment.transactionDate.toISOString(),
      })),
    };
  }

  return {
    linked: true,
    sourceLabel: "Rentauto account linked to your TAKATAK master identity.",
    accountStatus: source.accountStatus,
    emailVerified:
      source.verifiedFields.includes("email") ||
      profile.masterIdentity.primaryEmailVerified,
    phoneVerified:
      source.verifiedFields.includes("phone") ||
      profile.masterIdentity.primaryPhoneVerified,
    lastSynchronizedAt: source.lastSynchronizedAt.toISOString(),
    paymentSummaries: source.paymentSummaries.map((payment) => ({
      bookingNumber: payment.bookingNumber,
      status: payment.status,
      amountMinor: payment.amountMinor,
      refundedAmountMinor: payment.refundedAmountMinor,
      currency: payment.currency,
      transactionDate: payment.transactionDate.toISOString(),
    })),
  };
}
