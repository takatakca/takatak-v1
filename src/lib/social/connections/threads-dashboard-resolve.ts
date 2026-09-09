/**
 * Server-side Threads dashboard resolution.
 * Prefers the Threads profile linked through Meta / Facebook, then
 * independent Threads Login.
 * Never accepts account/connection IDs from the URL.
 */

import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  pickCanonicalProviderConnection,
  pickSelectedThreadsAccountStrict,
} from "@/lib/social/connections/social-canonical-identity";

export type ThreadsConnectionSource = "facebook_page" | "threads_login";

export type CanonicalThreadsDashboardResolution =
  | {
      kind: "ready";
      connectionId: string;
      socialAccountId: string;
      accountName: string;
      profileImageUrl: string | null;
      connectionStatus: string;
      source: ThreadsConnectionSource;
    }
  | { kind: "missing" }
  | { kind: "ambiguous" }
  | { kind: "no_brand" };

const LIVE_DASHBOARD_STATUSES = [
  "connected",
  "authorized",
  "reauthorization_required",
] as const;

export async function resolveCanonicalThreadsDashboard(options: {
  clientId: string;
  businessBrandId: string | null;
}): Promise<CanonicalThreadsDashboardResolution> {
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
      provider: { in: ["threads", "meta"] },
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

  const meta = pickCanonicalProviderConnection(live, "meta");
  const threadsLogin = pickCanonicalProviderConnection(live, "threads");

  const candidates: Array<{
    connection: NonNullable<typeof meta>;
    source: ThreadsConnectionSource;
  }> = [];

  if (meta) {
    candidates.push({ connection: meta, source: "facebook_page" });
  }
  if (threadsLogin) {
    candidates.push({ connection: threadsLogin, source: "threads_login" });
  }

  let ambiguous = false;

  for (const candidate of candidates) {
    const accounts = await prisma.socialAccount.findMany({
      where: {
        clientId: options.clientId,
        businessBrandId: brand.id,
        providerConnectionId: candidate.connection.id,
        platform: "threads",
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

    const strict = pickSelectedThreadsAccountStrict(
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
          "Threads account",
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
