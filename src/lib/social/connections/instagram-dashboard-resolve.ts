import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  pickCanonicalProviderConnection,
  pickSelectedInstagramAccountStrict,
} from "@/lib/social/connections/social-canonical-identity";

/**
 * Server-side Instagram dashboard resolution:
 * authenticated workspace client → active brand → selected Instagram
 * professional account from the Facebook Page-linked account (preferred)
 * or Instagram Login (when the account is not linked through Meta).
 *
 * Never accepts accountId / connectionId / Instagram IDs from the URL.
 */

export type InstagramConnectionSource =
  | "instagram_login"
  | "facebook_page";

export type CanonicalInstagramDashboardResolution =
  | {
      kind: "ready";
      connectionId: string;
      socialAccountId: string;
      accountName: string;
      profileImageUrl: string | null;
      connectionStatus: string;
      source: InstagramConnectionSource;
    }
  | { kind: "missing" }
  | { kind: "ambiguous" }
  | { kind: "no_brand" };

const LIVE_DASHBOARD_STATUSES = [
  "connected",
  "authorized",
  "reauthorization_required",
] as const;

export async function resolveCanonicalInstagramDashboard(options: {
  clientId: string;
  businessBrandId: string | null;
}): Promise<CanonicalInstagramDashboardResolution> {
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

  const instagramConnections =
    await prisma.socialProviderConnection.findMany({
      where: {
        clientId: options.clientId,
        businessBrandId: brand.id,
        provider: { in: ["instagram", "meta"] },
      },
      select: {
        id: true,
        provider: true,
        status: true,
        externalSubjectId: true,
      },
    });

  const live = instagramConnections.filter((row) =>
    LIVE_DASHBOARD_STATUSES.includes(
      row.status as (typeof LIVE_DASHBOARD_STATUSES)[number],
    ),
  );

  const instagramLogin = pickCanonicalProviderConnection(
    live,
    "instagram",
  );
  const meta = pickCanonicalProviderConnection(live, "meta");

  const candidates: Array<{
    connection: NonNullable<typeof instagramLogin>;
    source: InstagramConnectionSource;
  }> = [];

  if (meta) {
    candidates.push({
      connection: meta,
      source: "facebook_page",
    });
  }
  if (instagramLogin) {
    candidates.push({
      connection: instagramLogin,
      source: "instagram_login",
    });
  }

  let ambiguous = false;

  for (const candidate of candidates) {
    const accounts = await prisma.socialAccount.findMany({
      where: {
        clientId: options.clientId,
        businessBrandId: brand.id,
        providerConnectionId: candidate.connection.id,
        platform: "instagram",
        accountType: "instagram_professional",
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

    const strict = pickSelectedInstagramAccountStrict(
      accounts,
      candidate.connection.id,
    );

    if (strict.kind === "ambiguous") {
      ambiguous = true;
      continue;
    }

    if (strict.kind === "ready") {
      return {
        kind: "ready",
        connectionId: candidate.connection.id,
        socialAccountId: strict.account.id,
        accountName:
          strict.account.displayName ??
          strict.account.handle ??
          "Instagram account",
        profileImageUrl: strict.account.profileImageUrl,
        connectionStatus: candidate.connection.status,
        source: candidate.source,
      };
    }
  }

  if (ambiguous) {
    return { kind: "ambiguous" };
  }

  return { kind: "missing" };
}
