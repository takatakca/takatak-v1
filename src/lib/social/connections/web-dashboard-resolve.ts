import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { pickCanonicalProviderConnection } from "@/lib/social/connections/social-canonical-identity";

/**
 * Server-side website dashboard resolution:
 * authenticated workspace client → active brand → verified website.
 * Never accepts a site URL or account id from the page URL.
 */

export type CanonicalWebDashboardResolution =
  | {
      kind: "ready";
      connectionId: string;
      socialAccountId: string;
      accountName: string;
      siteUrl: string;
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

export async function resolveCanonicalWebDashboard(options: {
  clientId: string;
  businessBrandId: string | null;
}): Promise<CanonicalWebDashboardResolution> {
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
      provider: "web",
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

  const connection = pickCanonicalProviderConnection(live, "web");
  if (!connection) {
    return { kind: "missing" };
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      providerConnectionId: connection.id,
      platform: "web",
      status: "connected",
    },
    select: {
      id: true,
      status: true,
      accessStatus: true,
      displayName: true,
      handle: true,
      profileUrl: true,
    },
    take: 20,
  });

  const selected = accounts.filter(
    (account) =>
      account.accessStatus === "selected" || account.accessStatus == null,
  );

  if (selected.length > 1) {
    return { kind: "ambiguous" };
  }

  const account = selected[0];
  if (!account?.profileUrl) {
    return { kind: "missing" };
  }

  return {
    kind: "ready",
    connectionId: connection.id,
    socialAccountId: account.id,
    accountName: account.displayName ?? account.handle ?? account.profileUrl,
    siteUrl: account.profileUrl,
    connectionStatus: connection.status,
  };
}
