import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  pickCanonicalProviderConnection,
  pickSelectedFacebookAccountStrict,
} from "@/lib/social/connections/social-canonical-identity";

/**
 * Server-side Facebook dashboard resolution:
 * authenticated workspace client → active brand → canonical Meta connection
 * → unique selected Page assignment.
 *
 * Never accepts accountId / connectionId / Page ID from the URL.
 */

export type CanonicalFacebookDashboardResolution =
  | {
      kind: "ready";
      /** Internal only — never put in URLs, HTML, or client props. */
      connectionId: string;
      socialAccountId: string;
      pageName: string;
      profileImageUrl: string | null;
      connectionStatus: string;
    }
  | { kind: "missing" }
  | { kind: "ambiguous" }
  | { kind: "no_brand" };

export async function resolveCanonicalFacebookDashboard(options: {
  clientId: string;
  businessBrandId: string | null;
}): Promise<CanonicalFacebookDashboardResolution> {
  if (!options.businessBrandId) {
    return { kind: "no_brand" };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return { kind: "missing" };
  }

  // Brand must belong to this workspace — cross-brand IDs resolve to missing.
  const brand = await prisma.businessBrand.findFirst({
    where: {
      id: options.businessBrandId,
      clientId: options.clientId,
      status: { not: "archived" },
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
      provider: "meta",
    },
    select: {
      id: true,
      provider: true,
      status: true,
      externalSubjectId: true,
    },
  });

  const canonical = pickCanonicalProviderConnection(
    connections.filter((row) =>
      ["connected", "authorized", "reauthorization_required"].includes(
        row.status,
      ),
    ).map((row) => ({
      ...row,
      // Treat reauthorization_required as connected-rank for picker priority.
      status:
        row.status === "reauthorization_required" ? "connected" : row.status,
    })),
    "meta",
  );

  const liveCanonical =
    canonical ??
    pickCanonicalProviderConnection(connections, "meta");

  if (!liveCanonical) {
    return { kind: "missing" };
  }

  const connectionRow =
    connections.find((row) => row.id === liveCanonical.id) ?? null;
  if (
    !connectionRow ||
    (connectionRow.status !== "connected" &&
      connectionRow.status !== "reauthorization_required" &&
      connectionRow.status !== "authorized")
  ) {
    return { kind: "missing" };
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      providerConnectionId: connectionRow.id,
      platform: "facebook",
      accountType: "facebook_page",
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

  const strict = pickSelectedFacebookAccountStrict(
    accounts,
    connectionRow.id,
  );
  if (strict.kind === "ambiguous") {
    return { kind: "ambiguous" };
  }
  if (strict.kind === "missing") {
    return { kind: "missing" };
  }

  if (
    strict.account.status !== "connected" ||
    strict.account.accessStatus !== "selected"
  ) {
    return { kind: "missing" };
  }

  return {
    kind: "ready",
    connectionId: connectionRow.id,
    socialAccountId: strict.account.id,
    pageName:
      strict.account.displayName ??
      strict.account.handle ??
      "Facebook Page",
    profileImageUrl: strict.account.profileImageUrl,
    connectionStatus: connectionRow.status,
  };
}

/** Resolve for reconnect — includes connected/authorized/reauthorization_required. */
export async function resolveCanonicalMetaConnectionForReauth(options: {
  clientId: string;
  businessBrandId: string;
}): Promise<
  | {
      kind: "ready";
      connectionId: string;
      status: string;
    }
  | { kind: "missing" }
  | { kind: "ambiguous" }
> {
  const prisma = getPrisma();
  if (!prisma) {
    return { kind: "missing" };
  }

  const brand = await prisma.businessBrand.findFirst({
    where: {
      id: options.businessBrandId,
      clientId: options.clientId,
      status: { not: "archived" },
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
      provider: "meta",
      status: {
        in: [
          "connected",
          "authorized",
          "reauthorization_required",
          "expired",
          "error",
          "failed",
        ],
      },
    },
    select: {
      id: true,
      provider: true,
      status: true,
      externalSubjectId: true,
    },
  });

  if (connections.length === 0) {
    return { kind: "missing" };
  }

  // Prefer live canonical; otherwise single reusable shell.
  const live = pickCanonicalProviderConnection(
    connections.filter((row) =>
      ["connected", "authorized"].includes(row.status),
    ),
    "meta",
  );

  if (live) {
    const rivals = connections.filter(
      (row) =>
        row.id !== live.id &&
        (row.status === "connected" || row.status === "authorized"),
    );
    if (rivals.length > 0) {
      return { kind: "ambiguous" };
    }
    return {
      kind: "ready",
      connectionId: live.id,
      status: live.status,
    };
  }

  if (connections.length !== 1) {
    return { kind: "ambiguous" };
  }

  return {
    kind: "ready",
    connectionId: connections[0]!.id,
    status: connections[0]!.status,
  };
}
