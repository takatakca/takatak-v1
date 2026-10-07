import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  pickCanonicalProviderConnection,
  pickSelectedLookerStudioAccountStrict,
} from "@/lib/social/connections/social-canonical-identity";
import { lookerStudioReportUrl } from "@/lib/social/providers/looker-studio-accounts";

/**
 * Server-side Looker Studio resolution:
 * workspace client → active brand → selected report.
 * Report ids from the URL are never accepted.
 */

export type LookerStudioChoice = {
  id: string;
  displayName: string;
  owner: string;
};

export type CanonicalLookerStudioDashboardResolution =
  | {
      kind: "ready";
      connectionId: string;
      socialAccountId: string;
      accountName: string;
      owner: string;
      reportUrl: string | null;
      connectionStatus: string;
    }
  | {
      kind: "choose";
      connectionId: string;
      reports: LookerStudioChoice[];
    }
  | { kind: "empty"; connectionId: string; accountName: string }
  | { kind: "missing" }
  | { kind: "ambiguous" }
  | { kind: "no_brand" };

const LIVE_DASHBOARD_STATUSES = [
  "connected",
  "authorized",
  "reauthorization_required",
] as const;

function readOwner(metadata: unknown): string {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return "Google account";
  }
  const owner = (metadata as Record<string, unknown>).owner;
  return typeof owner === "string" && owner.trim()
    ? owner.trim().slice(0, 254)
    : "Google account";
}

function readReportUrl(metadata: unknown, externalAccountId: string | null): string | null {
  const fromId = externalAccountId
    ? lookerStudioReportUrl(externalAccountId)
    : null;
  if (fromId) return fromId;

  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return null;
  }
  const stored = (metadata as Record<string, unknown>).reportUrl;
  if (typeof stored !== "string") return null;
  try {
    const parsed = new URL(stored);
    if (parsed.origin !== "https://lookerstudio.google.com") return null;
    if (!/^\/reporting\/[A-Za-z0-9_-]{8,128}$/.test(parsed.pathname)) {
      return null;
    }
    if (parsed.search || parsed.hash) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export async function resolveCanonicalLookerStudioDashboard(options: {
  clientId: string;
  businessBrandId: string | null;
}): Promise<CanonicalLookerStudioDashboardResolution> {
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
      provider: "looker_studio",
    },
    select: {
      id: true,
      provider: true,
      status: true,
      displayName: true,
      externalSubjectId: true,
    },
  });

  const live = connections.filter((row) =>
    LIVE_DASHBOARD_STATUSES.includes(
      row.status as (typeof LIVE_DASHBOARD_STATUSES)[number],
    ),
  );

  const connection = pickCanonicalProviderConnection(live, "looker_studio");
  if (!connection) {
    return { kind: "missing" };
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      providerConnectionId: connection.id,
      platform: "looker_studio",
      isAvailableThroughAuth: true,
    },
    select: {
      id: true,
      platform: true,
      status: true,
      accessStatus: true,
      displayName: true,
      handle: true,
      externalAccountId: true,
      providerConnectionId: true,
      metadata: true,
    },
    orderBy: { displayName: "asc" },
    take: 100,
  });

  const strict = pickSelectedLookerStudioAccountStrict(accounts, connection.id);
  if (strict.kind === "ambiguous") {
    return { kind: "ambiguous" };
  }
  if (strict.kind === "ready") {
    return {
      kind: "ready",
      connectionId: connection.id,
      socialAccountId: strict.account.id,
      accountName: strict.account.displayName?.trim() || "Looker Studio report",
      owner: readOwner(strict.account.metadata),
      reportUrl: readReportUrl(
        strict.account.metadata,
        strict.account.externalAccountId,
      ),
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
      reports: choices.map((account) => ({
        id: account.id,
        displayName: account.displayName?.trim() || "Looker Studio report",
        owner: readOwner(account.metadata),
      })),
    };
  }

  if (connection.status === "authorized" || connection.status === "connected") {
    return {
      kind: "empty",
      connectionId: connection.id,
      accountName: connection.displayName?.trim() || "Looker Studio",
    };
  }

  return { kind: "missing" };
}
