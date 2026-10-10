import "server-only";

import { getPrisma } from "@/lib/db/prisma";

export type BlueskyDashboardResolution =
  | {
      kind: "ready";
      connectionId: string;
      socialAccountId: string;
      handle: string;
      accountName: string;
    }
  | { kind: "missing" };

export async function resolveCanonicalBlueskyDashboard(options: {
  clientId: string;
  businessBrandId: string | null;
}): Promise<BlueskyDashboardResolution> {
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
      platform: "bluesky",
      status: "connected",
      providerConnection: {
        provider: "bluesky",
        status: { in: ["connected", "authorized", "reauthorization_required"] },
      },
    },
    select: {
      id: true,
      handle: true,
      displayName: true,
      providerConnectionId: true,
    },
  });

  const eligible = accounts
    .filter((account) => account.providerConnectionId && account.handle?.trim())
    .sort((left, right) =>
      (left.displayName ?? left.handle ?? "").localeCompare(
        right.displayName ?? right.handle ?? "",
      ),
    );

  const account = eligible[0];
  if (!account?.providerConnectionId || !account.handle) {
    return { kind: "missing" };
  }

  return {
    kind: "ready",
    connectionId: account.providerConnectionId,
    socialAccountId: account.id,
    handle: account.handle.replace(/^@/, ""),
    accountName: account.displayName?.trim() || account.handle.replace(/^@/, ""),
  };
}
