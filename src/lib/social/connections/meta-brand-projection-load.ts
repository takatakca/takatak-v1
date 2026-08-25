import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  pickMetaSurfaceConnection,
  pickSelectedFacebookAccountStrict,
} from "@/lib/social/connections/social-canonical-identity";
import {
  projectMetaBrandSurface,
  type MetaSurfaceProjection,
} from "@/lib/social/connections/meta-brand-projection";

/**
 * Load the canonical Meta projection for one workspace brand.
 * Never accepts connection/account IDs from the client URL.
 */
export async function loadMetaBrandProjection(options: {
  clientId: string;
  businessBrandId: string;
}): Promise<MetaSurfaceProjection> {
  const prisma = getPrisma();
  if (!prisma) {
    return projectMetaBrandSurface({ connection: null, selectedPage: null });
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
    return projectMetaBrandSurface({ connection: null, selectedPage: null });
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
      lastErrorCode: true,
      externalSubjectId: true,
    },
  });

  const fallback = pickMetaSurfaceConnection(connections, "meta");

  if (!fallback) {
    return projectMetaBrandSurface({ connection: null, selectedPage: null });
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      providerConnectionId: fallback.id,
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
    take: 10,
  });

  const strict = pickSelectedFacebookAccountStrict(accounts, fallback.id);
  const selected =
    strict.kind === "ready"
      ? strict.account
      : accounts.find((row) => row.status === "connected") ?? null;

  let syncStatus: string | null = null;
  if (selected) {
    const sync = await prisma.socialAccountSyncState.findUnique({
      where: { socialAccountId: selected.id },
      select: { status: true },
    });
    syncStatus = sync?.status ?? null;
  }

  const pendingOAuth = await prisma.socialOAuthState.findFirst({
    where: {
      clientId: options.clientId,
      connectionId: fallback.id,
      status: { in: ["pending", "processing"] },
    },
    select: { id: true },
  });

  return projectMetaBrandSurface({
    connection: {
      id: fallback.id,
      status: fallback.status,
      lastErrorCode: fallback.lastErrorCode,
    },
    selectedPage: selected,
    syncStatus,
    hasPendingOAuthAttempt: Boolean(pendingOAuth),
  });
}
