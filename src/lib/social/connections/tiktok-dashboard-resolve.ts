import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  pickCanonicalProviderConnection,
  pickSelectedTikTokAccountStrict,
} from "@/lib/social/connections/social-canonical-identity";

/**
 * Server-side TikTok dashboard resolution:
 * authenticated workspace client → active brand → selected TikTok account
 * from Login Kit. Never accepts accountId / connectionId / open_id from the URL.
 */

export type CanonicalTikTokDashboardResolution =
  | {
      kind: "ready";
      connectionId: string;
      socialAccountId: string;
      accountName: string;
      profileImageUrl: string | null;
      connectionStatus: string;
    }
  | { kind: "missing" }
  | { kind: "ambiguous" }
  | { kind: "no_brand" };

const LIVE_DASHBOARD_STATUSES = [
  "connected",
  "authorized",
  "reauthorization_required",
] as const;

export async function resolveCanonicalTikTokDashboard(options: {
  clientId: string;
  businessBrandId: string | null;
}): Promise<CanonicalTikTokDashboardResolution> {
  if (!options.businessBrandId) {
    return { kind: "no_brand" };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return { kind: "missing" };
  }

  const brand = await prisma.businessBrand.findFirst({
    where: {
      id: options.businessBrandId,
      clientId: options.clientId,
      status: { notIn: ["archived", "frozen"] },
    },
    select: { id: true },
  });

  if (!brand) {
    return { kind: "missing" };
  }

  const connections = await prisma.socialProviderConnection.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      provider: "tiktok",
    },
    select: {
      id: true,
      provider: true,
      status: true,
      externalSubjectId: true,
    },
  });

  const live = connections.filter((row) =>
    LIVE_DASHBOARD_STATUSES.includes(
      row.status as (typeof LIVE_DASHBOARD_STATUSES)[number],
    ),
  );

  const connection = pickCanonicalProviderConnection(live, "tiktok");
  if (!connection) {
    return { kind: "missing" };
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      providerConnectionId: connection.id,
      platform: "tiktok",
    },
    select: {
      id: true,
      platform: true,
      status: true,
      accessStatus: true,
      displayName: true,
      handle: true,
      profileImageUrl: true,
      providerConnectionId: true,
    },
    take: 20,
  });

  const strict = pickSelectedTikTokAccountStrict(accounts, connection.id);
  if (strict.kind === "ambiguous") {
    return { kind: "ambiguous" };
  }
  if (strict.kind === "ready") {
    return {
      kind: "ready",
      connectionId: connection.id,
      socialAccountId: strict.account.id,
      accountName:
        strict.account.displayName ??
        strict.account.handle ??
        "TikTok account",
      profileImageUrl: strict.account.profileImageUrl,
      connectionStatus: connection.status,
    };
  }

  return { kind: "missing" };
}
