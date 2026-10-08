import "server-only";

import { getPrisma } from "@/lib/db/prisma";

export type GoogleBusinessDashboardResolution =
  | {
      kind: "ready";
      connectionId: string;
      socialAccountId: string;
      locationName: string;
      accountName: string;
      category: string | null;
      profileUrl: string | null;
    }
  | {
      kind: "ambiguous";
    }
  | {
      kind: "missing";
    };

export async function resolveCanonicalGoogleBusinessDashboard(
  options: {
    clientId: string;
    businessBrandId: string | null;
  },
): Promise<GoogleBusinessDashboardResolution> {
  if (!options.businessBrandId) {
    return { kind: "missing" };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return { kind: "missing" };
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      platform: "google_business",
      status: "connected",
      accessStatus: "selected",
      isAvailableThroughAuth: true,
      providerConnection: {
        provider: "google_business",
        status: "connected",
      },
    },
    select: {
      id: true,
      externalAccountId: true,
      displayName: true,
      category: true,
      profileUrl: true,
      providerConnectionId: true,
    },
  });

  const eligible = accounts
    .filter(
      (account) =>
        account.providerConnectionId &&
        account.externalAccountId &&
        /^locations\/[^/]+$/.test(account.externalAccountId),
    )
    .sort((left, right) => {
      const name = (left.displayName ?? "").localeCompare(
        right.displayName ?? "",
        undefined,
        { sensitivity: "base" },
      );
      if (name !== 0) return name;
      return left.id.localeCompare(right.id);
    });

  if (eligible.length === 0) {
    return { kind: "missing" };
  }

  const account = eligible[0];

  if (
    !account.providerConnectionId ||
    !account.externalAccountId ||
    !/^locations\/[^/]+$/.test(account.externalAccountId)
  ) {
    return { kind: "missing" };
  }

  return {
    kind: "ready",
    connectionId: account.providerConnectionId,
    socialAccountId: account.id,
    locationName: account.externalAccountId,
    accountName:
      account.displayName?.trim() ||
      "Google Business Profile",
    category: account.category,
    profileUrl: account.profileUrl,
  };
}
