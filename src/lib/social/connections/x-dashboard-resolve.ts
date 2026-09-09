import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  pickCanonicalProviderConnection,
  pickSelectedXAccountStrict,
} from "@/lib/social/connections/social-canonical-identity";

/**
 * Server-side X dashboard resolution:
 * authenticated workspace client → active brand → selected X account
 * from OAuth 2.0. Never accepts accountId / connectionId / user id from the URL.
 */

export type CanonicalXDashboardResolution =
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

export async function resolveCanonicalXDashboard(options: {
  clientId: string;
  businessBrandId: string | null;
}): Promise<CanonicalXDashboardResolution> {
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
      provider: "x",
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

  const connection = pickCanonicalProviderConnection(live, "x");
  if (!connection) {
    return { kind: "missing" };
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      providerConnectionId: connection.id,
      platform: "x",
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

  const strict = pickSelectedXAccountStrict(accounts, connection.id);
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
        "X account",
      profileImageUrl: strict.account.profileImageUrl,
      connectionStatus: connection.status,
    };
  }

  return { kind: "missing" };
}
