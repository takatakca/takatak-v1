import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  pickCanonicalProviderConnection,
  pickSelectedYoutubeAccountStrict,
} from "@/lib/social/connections/social-canonical-identity";

/**
 * Server-side YouTube dashboard resolution:
 * authenticated workspace client → active brand → selected YouTube channel
 * on the Google provider connection.
 *
 * Never accepts accountId / connectionId / channel IDs from the URL.
 */

export type CanonicalYoutubeDashboardResolution =
  | {
      kind: "ready";
      connectionId: string;
      socialAccountId: string;
      accountName: string;
      profileImageUrl: string | null;
      connectionStatus: string;
    }
  | {
      kind: "needs_selection";
      connectionId: string;
    }
  | { kind: "missing" }
  | { kind: "ambiguous" }
  | { kind: "no_brand" }
  | { kind: "pending" };

const LIVE_DASHBOARD_STATUSES = [
  "connected",
  "authorized",
  "reauthorization_required",
  "pending_authorization",
] as const;

export async function resolveCanonicalYoutubeDashboard(options: {
  clientId: string;
  businessBrandId: string | null;
}): Promise<CanonicalYoutubeDashboardResolution> {
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
      provider: "google",
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

  const connection = pickCanonicalProviderConnection(live, "google");
  if (!connection) {
    return { kind: "missing" };
  }

  if (connection.status === "pending_authorization") {
    return { kind: "pending" };
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      providerConnectionId: connection.id,
      platform: "youtube",
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
  });

  const selected = pickSelectedYoutubeAccountStrict(accounts, connection.id);
  if (selected.kind === "ambiguous") {
    return { kind: "ambiguous" };
  }
  if (selected.kind === "ready") {
    return {
      kind: "ready",
      connectionId: connection.id,
      socialAccountId: selected.account.id,
      accountName:
        selected.account.displayName?.trim() ||
        selected.account.handle?.trim() ||
        "YouTube channel",
      profileImageUrl: selected.account.profileImageUrl,
      connectionStatus: connection.status,
    };
  }

  if (
    connection.status === "authorized" ||
    connection.status === "connected" ||
    connection.status === "reauthorization_required"
  ) {
    return {
      kind: "needs_selection",
      connectionId: connection.id,
    };
  }

  return { kind: "missing" };
}
