import "server-only";

import type { Prisma, SocialConnectionProvider } from "@prisma/client";

import { assertClientCanConnectSocial } from "@/lib/billing/client-subscription-access";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { parseBlogHost, takatakBlogPath } from "@/lib/social/connections/blog-page";
import { runSocialDbTransaction } from "@/lib/social/connections/social-db-transaction";
import { normalizePublicWebsiteUrl } from "@/lib/social/connections/web-site-url";

const BLOG_PROVIDER = "blog" as SocialConnectionProvider;

const REUSABLE_STATUSES = [
  "not_connected",
  "disconnected",
  "failed",
  "expired",
  "error",
  "reauthorization_required",
] as const;

export type BlogWebsiteSummary = {
  siteUrl: string;
  host: string;
};

export type BlogConnectionView = {
  status: "connected";
  host: string;
  siteUrl: string;
  blogPath: string;
  blogUrl: string;
  displayName: string;
};

export type PublicTakatakBlog = {
  host: string;
  siteUrl: string;
  blogPath: string;
  title: string;
};

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
      { status: 503 },
    );
  }
  return prisma;
}

function readSiteUrl(value: Prisma.JsonValue | null): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const siteUrl = (value as Record<string, unknown>).siteUrl;
  return typeof siteUrl === "string" ? siteUrl : null;
}

function blogUrlForHost(host: string): string {
  return new URL(takatakBlogPath(host), getApplicationOrigin()).toString();
}

async function requireActiveBrand(options: {
  clientId: string;
  businessBrandId: string;
}) {
  const brand = await requirePrisma().businessBrand.findFirst({
    where: {
      id: options.businessBrandId,
      clientId: options.clientId,
      status: { notIn: ["archived", "frozen"] },
    },
    select: { id: true },
  });

  if (!brand) {
    throw new ServiceError(
      "not_found",
      "The selected brand could not be found in this workspace.",
    );
  }

  return brand;
}

async function connectedWebsite(options: {
  clientId: string;
  businessBrandId: string;
}): Promise<BlogWebsiteSummary | null> {
  const account = await requirePrisma().socialAccount.findFirst({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      platform: "web",
      status: "connected",
      accessStatus: "selected",
    },
    select: {
      handle: true,
      profileUrl: true,
    },
  });

  const host = account?.handle ? parseBlogHost(account.handle) : null;
  const siteUrl = account?.profileUrl?.trim() ?? "";
  if (!host || !siteUrl) return null;

  try {
    const website = normalizePublicWebsiteUrl(siteUrl);
    if (website.host !== host) return null;
    return website;
  } catch {
    return null;
  }
}

function viewFromAccount(options: {
  host: string;
  siteUrl: string;
  displayName: string | null;
}): BlogConnectionView {
  return {
    status: "connected",
    host: options.host,
    siteUrl: options.siteUrl,
    blogPath: takatakBlogPath(options.host),
    blogUrl: blogUrlForHost(options.host),
    displayName: options.displayName?.trim() || `${options.host} blog`,
  };
}

export async function getBlogConnection(options: {
  clientId: string;
  businessBrandId: string;
}): Promise<{
  website: BlogWebsiteSummary | null;
  connection: BlogConnectionView | null;
}> {
  await requireActiveBrand(options);
  const website = await connectedWebsite(options);
  const account = await requirePrisma().socialAccount.findFirst({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      platform: "blog",
      status: "connected",
      accessStatus: "selected",
    },
    select: {
      handle: true,
      displayName: true,
      profileUrl: true,
      metadata: true,
    },
  });

  const host = account?.handle ? parseBlogHost(account.handle) : null;
  if (!account || !host) {
    return { website, connection: null };
  }

  const siteUrl =
    readSiteUrl(account.metadata) ??
    website?.siteUrl ??
    account.profileUrl ??
    `https://${host}/`;

  return {
    website,
    connection: viewFromAccount({
      host,
      siteUrl,
      displayName: account.displayName,
    }),
  };
}

export async function startBlogConnection(options: {
  clientId: string;
  profileId: string;
  businessBrandId: string;
}): Promise<BlogConnectionView> {
  const prisma = requirePrisma();
  const brand = await requireActiveBrand(options);
  const website = await connectedWebsite(options);

  if (!website) {
    throw new ServiceError(
      "conflict",
      "Connect a web page before creating a blog page.",
    );
  }

  await assertClientCanConnectSocial(prisma, options.clientId, {
    provider: "blog",
  });

  const now = new Date();
  const displayName = `${website.host} blog`;
  const blogPath = takatakBlogPath(website.host);
  const metadata = {
    kind: "takatak_blog",
    siteUrl: website.siteUrl,
    host: website.host,
    blogPath,
  };

  try {
    await runSocialDbTransaction("blog-connection-start", async (transaction) => {
      await transaction.$executeRaw`
        SELECT id
        FROM social_provider_connections
        WHERE "clientId" = ${options.clientId}::uuid
          AND "businessBrandId" = ${brand.id}::uuid
          AND provider = ${"blog"}::"SocialConnectionProvider"
        FOR UPDATE
      `;

      const websiteStillConnected = await transaction.socialAccount.findFirst({
        where: {
          clientId: options.clientId,
          businessBrandId: brand.id,
          platform: "web",
          status: "connected",
          handle: website.host,
        },
        select: { id: true },
      });

      if (!websiteStillConnected) {
        throw new ServiceError(
          "conflict",
          "Connect a web page before creating a blog page.",
        );
      }

      const duplicate = await transaction.socialAccount.findFirst({
        where: {
          clientId: options.clientId,
          platform: "blog",
          status: "connected",
          externalAccountId: website.host,
          NOT: { businessBrandId: brand.id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new ServiceError(
          "conflict",
          "This website already has a blog page in this workspace.",
        );
      }

      const current = await transaction.socialProviderConnection.findFirst({
        where: {
          clientId: options.clientId,
          businessBrandId: brand.id,
          provider: BLOG_PROVIDER,
          status: { in: ["pending_authorization", "authorized", "connected"] },
        },
        select: { id: true, status: true },
      });

      if (current && current.status !== "connected") {
        throw new ServiceError(
          "conflict",
          "A blog connection is already in progress for this brand.",
        );
      }

      const connectionId = current
        ? current.id
        : (
            await (async () => {
              const reusable = await transaction.socialProviderConnection.findFirst({
                where: {
                  clientId: options.clientId,
                  businessBrandId: brand.id,
                  provider: BLOG_PROVIDER,
                  status: { in: [...REUSABLE_STATUSES] },
                },
                select: { id: true },
                orderBy: { updatedAt: "desc" },
              });

              if (reusable) {
                await transaction.socialProviderConnection.update({
                  where: { id: reusable.id },
                  data: {
                    status: "connected",
                    externalSubjectId: website.host,
                    displayName,
                    connectedAt: now,
                    authorizedAt: now,
                    lastValidatedAt: now,
                    disconnectedAt: null,
                    metadata,
                    createdByProfileId: options.profileId,
                    lastErrorCode: null,
                    lastErrorMessage: null,
                    lastErrorAt: null,
                  },
                });
                return reusable;
              }

              return transaction.socialProviderConnection.create({
                data: {
                  clientId: options.clientId,
                  businessBrandId: brand.id,
                  provider: BLOG_PROVIDER,
                  status: "connected",
                  externalSubjectId: website.host,
                  displayName,
                  connectedAt: now,
                  authorizedAt: now,
                  lastValidatedAt: now,
                  createdByProfileId: options.profileId,
                  metadata,
                },
                select: { id: true },
              });
            })()
          ).id;

      if (current) {
        await transaction.socialProviderConnection.update({
          where: { id: current.id },
          data: {
            status: "connected",
            externalSubjectId: website.host,
            displayName,
            connectedAt: now,
            authorizedAt: now,
            lastValidatedAt: now,
            metadata,
            lastErrorCode: null,
            lastErrorMessage: null,
            lastErrorAt: null,
          },
        });
      }

      const existing = await transaction.socialAccount.findFirst({
        where: {
          providerConnectionId: connectionId,
          platform: "blog",
          externalAccountId: website.host,
        },
        select: { id: true },
      });

      const accountData = {
        businessBrandId: brand.id,
        handle: website.host,
        displayName,
        profileUrl: website.siteUrl,
        accountType: "takatak_blog",
        status: "connected" as const,
        accessStatus: "selected" as const,
        isAvailableThroughAuth: true,
        lastDiscoveredAt: now,
        metadata,
      };

      if (existing) {
        await transaction.socialAccount.update({
          where: { id: existing.id },
          data: accountData,
        });
      } else {
        await transaction.socialAccount.create({
          data: {
            ...accountData,
            clientId: options.clientId,
            providerConnectionId: connectionId,
            platform: "blog",
            externalAccountId: website.host,
            firstDiscoveredAt: now,
          },
        });
      }
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new ServiceError(
        "conflict",
        "This website already has a blog page in this workspace.",
      );
    }
    throw error;
  }

  const saved = await getBlogConnection(options);
  if (!saved.connection) {
    throw new ServiceError(
      "unavailable",
      "The blog page could not be created.",
      { status: 503 },
    );
  }

  return saved.connection;
}

export async function loadPublicTakatakBlog(
  host: string,
): Promise<PublicTakatakBlog | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  const accounts = await prisma.socialAccount.findMany({
    where: {
      platform: "blog",
      status: "connected",
      externalAccountId: host,
      accessStatus: "selected",
    },
    select: {
      handle: true,
      displayName: true,
      metadata: true,
    },
    take: 2,
  });

  if (accounts.length !== 1) return null;

  const account = accounts[0];
  const siteUrl = readSiteUrl(account?.metadata ?? null);
  if (!account || !siteUrl) return null;

  try {
    const website = normalizePublicWebsiteUrl(siteUrl);
    if (website.host !== host) return null;
    return {
      host,
      siteUrl: website.siteUrl,
      blogPath: takatakBlogPath(host),
      title: account.displayName?.trim() || `${host} blog`,
    };
  } catch {
    return null;
  }
}
