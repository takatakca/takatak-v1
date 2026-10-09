import "server-only";

import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getPrisma } from "@/lib/db/prisma";
import { parseBlogHost, takatakBlogPath } from "@/lib/social/connections/blog-page";
import { pickCanonicalProviderConnection } from "@/lib/social/connections/social-canonical-identity";

export type CanonicalBlogDashboardResolution =
  | {
      kind: "ready";
      connectionId: string;
      socialAccountId: string;
      accountName: string;
      siteUrl: string;
      blogUrl: string;
      connectionStatus: string;
    }
  | { kind: "missing" }
  | { kind: "ambiguous" }
  | { kind: "no_brand" }
  | { kind: "needs_website" };

const LIVE_DASHBOARD_STATUSES = [
  "connected",
  "authorized",
  "reauthorization_required",
] as const;

function siteUrlFromMetadata(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const siteUrl = (value as Record<string, unknown>).siteUrl;
  return typeof siteUrl === "string" ? siteUrl : null;
}

export async function resolveCanonicalBlogDashboard(options: {
  clientId: string;
  businessBrandId: string | null;
}): Promise<CanonicalBlogDashboardResolution> {
  if (!options.businessBrandId) return { kind: "no_brand" };

  const prisma = getPrisma();
  if (!prisma) return { kind: "missing" };

  const brand = await prisma.businessBrand.findFirst({
    where: {
      id: options.businessBrandId,
      clientId: options.clientId,
      status: { notIn: ["archived", "frozen"] },
    },
    select: { id: true },
  });

  if (!brand) return { kind: "missing" };

  const website = await prisma.socialAccount.findFirst({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      platform: "web",
      status: "connected",
    },
    select: { id: true },
  });

  const connections = await prisma.socialProviderConnection.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      provider: "blog",
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

  const connection = pickCanonicalProviderConnection(live, "blog");
  if (!connection) {
    return website ? { kind: "missing" } : { kind: "needs_website" };
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      providerConnectionId: connection.id,
      platform: "blog",
      status: "connected",
    },
    select: {
      id: true,
      accessStatus: true,
      displayName: true,
      handle: true,
      profileUrl: true,
      metadata: true,
    },
    take: 20,
  });

  const selected = accounts.filter(
    (account) =>
      account.accessStatus === "selected" || account.accessStatus == null,
  );

  if (selected.length > 1) return { kind: "ambiguous" };

  const account = selected[0];
  const host = account?.handle ? parseBlogHost(account.handle) : null;
  if (!account || !host) return { kind: "missing" };

  const siteUrl =
    siteUrlFromMetadata(account.metadata) ??
    account.profileUrl ??
    `https://${host}/`;

  return {
    kind: "ready",
    connectionId: connection.id,
    socialAccountId: account.id,
    accountName: account.displayName ?? `${host} blog`,
    siteUrl,
    blogUrl: new URL(takatakBlogPath(host), getApplicationOrigin()).toString(),
    connectionStatus: connection.status,
  };
}
