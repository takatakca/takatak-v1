import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  pickCanonicalProviderConnection,
  pickSelectedMetaAdsAccountStrict,
} from "@/lib/social/connections/social-canonical-identity";

/**
 * Server-side Meta Ads resolution:
 * workspace client → active brand → selected ad account.
 * Account ids from the URL are never accepted.
 */

export type MetaAdsChoice = {
  id: string;
  displayName: string;
  currency: string;
};

export type CanonicalMetaAdsDashboardResolution =
  | {
      kind: "ready";
      connectionId: string;
      socialAccountId: string;
      accountName: string;
      currency: string;
      connectionStatus: string;
    }
  | {
      kind: "choose";
      connectionId: string;
      accounts: MetaAdsChoice[];
    }
  | { kind: "empty"; connectionId: string }
  | { kind: "missing" }
  | { kind: "ambiguous" }
  | { kind: "no_brand" };

const LIVE_DASHBOARD_STATUSES = [
  "connected",
  "authorized",
  "reauthorization_required",
] as const;

function readCurrency(metadata: unknown): string {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return "CAD";
  }
  const currency = (metadata as Record<string, unknown>).currency;
  return typeof currency === "string" && /^[A-Z]{3}$/.test(currency)
    ? currency
    : "CAD";
}

export async function resolveCanonicalMetaAdsDashboard(options: {
  clientId: string;
  businessBrandId: string | null;
}): Promise<CanonicalMetaAdsDashboardResolution> {
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
      provider: "meta_ads",
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

  const connection = pickCanonicalProviderConnection(live, "meta_ads");
  if (!connection) {
    return { kind: "missing" };
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      providerConnectionId: connection.id,
      platform: "meta_ads",
      isAvailableThroughAuth: true,
    },
    select: {
      id: true,
      platform: true,
      status: true,
      accessStatus: true,
      displayName: true,
      handle: true,
      providerConnectionId: true,
      metadata: true,
    },
    orderBy: { displayName: "asc" },
    take: 100,
  });

  const strict = pickSelectedMetaAdsAccountStrict(accounts, connection.id);
  if (strict.kind === "ambiguous") {
    return { kind: "ambiguous" };
  }
  if (strict.kind === "ready") {
    return {
      kind: "ready",
      connectionId: connection.id,
      socialAccountId: strict.account.id,
      accountName: strict.account.displayName?.trim() || "Meta ad account",
      currency: readCurrency(strict.account.metadata),
      connectionStatus: connection.status,
    };
  }

  const choices = accounts.filter(
    (account) => account.status === "pending_connection",
  );
  if (choices.length > 0) {
    return {
      kind: "choose",
      connectionId: connection.id,
      accounts: choices.map((account) => ({
        id: account.id,
        displayName: account.displayName?.trim() || "Meta ad account",
        currency: readCurrency(account.metadata),
      })),
    };
  }

  if (connection.status === "authorized" || connection.status === "connected") {
    return { kind: "empty", connectionId: connection.id };
  }

  return { kind: "missing" };
}
