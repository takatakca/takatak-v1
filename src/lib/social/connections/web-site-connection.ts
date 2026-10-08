import "server-only";

import { randomBytes } from "node:crypto";
import type { Prisma, SocialConnectionProvider } from "@prisma/client";

import { assertClientCanConnectSocial } from "@/lib/billing/client-subscription-access";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { runSocialDbTransaction } from "@/lib/social/connections/social-db-transaction";
import { pageContainsVerificationToken, buildSiteVerificationMetaTag } from "@/lib/social/connections/web-site-html";
import { normalizePublicWebsiteUrl } from "@/lib/social/connections/web-site-url";
import { fetchPublicHomepageHtml } from "@/lib/social/connections/web-site-verify-fetch";

const WEB_PROVIDER = "web" as SocialConnectionProvider;

const LIVE_STATUSES = [
  "pending_authorization",
  "authorized",
  "connected",
] as const;

export type WebSiteConnectionView = {
  status: "pending_verification" | "connected";
  siteUrl: string;
  host: string;
  displayName: string | null;
  metaTag: string | null;
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

function createVerificationToken(): string {
  return randomBytes(24).toString("base64url");
}

function readSiteMetadata(value: Prisma.JsonValue | null): {
  siteUrl: string;
  host: string;
  verificationToken: string | null;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const siteUrl = typeof record.siteUrl === "string" ? record.siteUrl : "";
  const host = typeof record.host === "string" ? record.host : "";
  const verificationToken =
    typeof record.verificationToken === "string"
      ? record.verificationToken
      : null;

  if (!siteUrl || !host) return null;
  return { siteUrl, host, verificationToken };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function requireActiveBrand(options: {
  clientId: string;
  businessBrandId: string;
}) {
  const prisma = requirePrisma();
  const brand = await prisma.businessBrand.findFirst({
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

export async function getWebSiteConnection(options: {
  clientId: string;
  businessBrandId: string;
}): Promise<WebSiteConnectionView | null> {
  const prisma = requirePrisma();
  await requireActiveBrand(options);

  const connection = await prisma.socialProviderConnection.findFirst({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      provider: WEB_PROVIDER,
      status: { in: [...LIVE_STATUSES] },
    },
    select: {
      status: true,
      displayName: true,
      metadata: true,
      socialAccounts: {
        where: {
          platform: "web",
          status: "connected",
        },
        select: {
          displayName: true,
          profileUrl: true,
          handle: true,
        },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!connection) return null;

  const metadata = readSiteMetadata(connection.metadata);
  const account = connection.socialAccounts[0] ?? null;

  if (connection.status === "connected" || connection.status === "authorized") {
    const siteUrl =
      account?.profileUrl ?? metadata?.siteUrl ?? null;
    const host =
      account?.handle ?? account?.displayName ?? metadata?.host ?? null;
    if (!siteUrl || !host) return null;
    return {
      status: "connected",
      siteUrl,
      host,
      displayName: account?.displayName ?? connection.displayName ?? host,
      metaTag: null,
    };
  }

  if (!metadata?.verificationToken) return null;

  return {
    status: "pending_verification",
    siteUrl: metadata.siteUrl,
    host: metadata.host,
    displayName: metadata.host,
    metaTag: buildSiteVerificationMetaTag(metadata.verificationToken),
  };
}

export async function startWebSiteConnection(options: {
  clientId: string;
  profileId: string;
  businessBrandId: string;
  siteUrl: string;
}): Promise<WebSiteConnectionView> {
  const prisma = requirePrisma();
  const website = normalizePublicWebsiteUrl(options.siteUrl);
  const brand = await requireActiveBrand(options);

  await assertClientCanConnectSocial(prisma, options.clientId, {
    provider: "web",
  });

  const token = createVerificationToken();
  const metadata = {
    kind: "web_site",
    siteUrl: website.siteUrl,
    host: website.host,
    verificationToken: token,
  };

  await runSocialDbTransaction(
    "web-site-start",
    async (transaction) => {
      await transaction.$executeRaw`
        SELECT id
        FROM social_provider_connections
        WHERE "clientId" = ${options.clientId}::uuid
          AND "businessBrandId" = ${brand.id}::uuid
          AND provider = ${"web"}::"SocialConnectionProvider"
        FOR UPDATE
      `;

      const current = await transaction.socialProviderConnection.findFirst({
        where: {
          clientId: options.clientId,
          businessBrandId: brand.id,
          provider: WEB_PROVIDER,
          status: { in: [...LIVE_STATUSES] },
        },
        select: {
          id: true,
          status: true,
          metadata: true,
        },
      });

      if (
        current &&
        (current.status === "connected" || current.status === "authorized")
      ) {
        throw new ServiceError(
          "conflict",
          "This brand already has a connected website. Disconnect it before connecting another address.",
        );
      }

      const existingMeta = current ? readSiteMetadata(current.metadata) : null;
      const nextToken =
        current?.status === "pending_authorization" &&
        existingMeta?.host === website.host &&
        existingMeta.verificationToken
          ? existingMeta.verificationToken
          : token;
      const nextMetadata = {
        ...metadata,
        verificationToken: nextToken,
      };

      if (current) {
        await transaction.socialProviderConnection.update({
          where: { id: current.id },
          data: {
            status: "pending_authorization",
            externalSubjectId: website.host,
            displayName: website.host,
            metadata: nextMetadata,
            lastErrorCode: null,
            lastErrorMessage: null,
            lastErrorAt: null,
            createdByProfileId: options.profileId,
          },
        });
        return;
      }

      const reusable = await transaction.socialProviderConnection.findFirst({
        where: {
          clientId: options.clientId,
          businessBrandId: brand.id,
          provider: WEB_PROVIDER,
          status: {
            in: [
              "not_connected",
              "disconnected",
              "failed",
              "expired",
              "error",
              "reauthorization_required",
            ],
          },
        },
        select: { id: true },
        orderBy: { updatedAt: "desc" },
      });

      if (reusable) {
        await transaction.socialProviderConnection.update({
          where: { id: reusable.id },
          data: {
            status: "pending_authorization",
            externalSubjectId: website.host,
            displayName: website.host,
            connectedAt: null,
            authorizedAt: null,
            disconnectedAt: null,
            metadata: nextMetadata,
            lastErrorCode: null,
            lastErrorMessage: null,
            lastErrorAt: null,
            createdByProfileId: options.profileId,
          },
        });
        return;
      }

      await transaction.socialProviderConnection.create({
        data: {
          clientId: options.clientId,
          businessBrandId: brand.id,
          provider: WEB_PROVIDER,
          status: "pending_authorization",
          externalSubjectId: website.host,
          displayName: website.host,
          createdByProfileId: options.profileId,
          metadata: nextMetadata,
        },
      });
    },
  );

  const view = await getWebSiteConnection({
    clientId: options.clientId,
    businessBrandId: options.businessBrandId,
  });

  if (!view || view.status !== "pending_verification") {
    throw new ServiceError(
      "unavailable",
      "Website verification could not be prepared.",
      { status: 503 },
    );
  }

  return view;
}

export async function verifyWebSiteConnection(options: {
  clientId: string;
  businessBrandId: string;
}): Promise<WebSiteConnectionView> {
  const prisma = requirePrisma();
  const brand = await requireActiveBrand(options);

  await assertClientCanConnectSocial(prisma, options.clientId, {
    provider: "web",
    reconnect: true,
  });

  const pending = await prisma.socialProviderConnection.findFirst({
    where: {
      clientId: options.clientId,
      businessBrandId: brand.id,
      provider: WEB_PROVIDER,
      status: "pending_authorization",
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  const metadata = pending ? readSiteMetadata(pending.metadata) : null;
  if (!pending || !metadata?.verificationToken) {
    throw new ServiceError(
      "invalid_input",
      "Start website verification before checking the homepage.",
    );
  }

  const html = await fetchPublicHomepageHtml(metadata.siteUrl);
  if (!pageContainsVerificationToken(html, metadata.verificationToken)) {
    throw new ServiceError(
      "invalid_input",
      "The verification tag was not found on the homepage. Add it inside the head element and try again.",
      { fieldErrors: { siteUrl: "Verification tag not found." } },
    );
  }

  const verifiedToken = metadata.verificationToken;
  const website = normalizePublicWebsiteUrl(metadata.siteUrl);
  const now = new Date();

  try {
    await runSocialDbTransaction("web-site-verify", async (transaction) => {
      const current = await transaction.socialProviderConnection.findFirst({
        where: {
          id: pending.id,
          clientId: options.clientId,
          businessBrandId: brand.id,
          provider: WEB_PROVIDER,
          status: "pending_authorization",
        },
        select: { id: true, metadata: true },
      });

      const currentMeta = current ? readSiteMetadata(current.metadata) : null;
      if (
        !current ||
        !currentMeta ||
        currentMeta.verificationToken !== verifiedToken ||
        currentMeta.host !== website.host
      ) {
        throw new ServiceError(
          "conflict",
          "Website verification changed. Start again and use the latest tag.",
        );
      }

      const duplicate = await transaction.socialAccount.findFirst({
        where: {
          clientId: options.clientId,
          platform: "web",
          status: "connected",
          externalAccountId: website.host,
          NOT: { providerConnectionId: current.id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new ServiceError(
          "conflict",
          "This website is already connected in this workspace.",
        );
      }

      const existing = await transaction.socialAccount.findFirst({
        where: {
          providerConnectionId: current.id,
          platform: "web",
          externalAccountId: website.host,
        },
        select: { id: true },
      });

      if (existing) {
        await transaction.socialAccount.update({
          where: { id: existing.id },
          data: {
            businessBrandId: brand.id,
            handle: website.host,
            displayName: website.host,
            profileUrl: website.siteUrl,
            accountType: "web_site",
            status: "connected",
            accessStatus: "selected",
            isAvailableThroughAuth: true,
            lastDiscoveredAt: now,
            metadata: { source: "web_site_verification" },
          },
        });
      } else {
        await transaction.socialAccount.create({
          data: {
            clientId: options.clientId,
            businessBrandId: brand.id,
            providerConnectionId: current.id,
            platform: "web",
            accountType: "web_site",
            externalAccountId: website.host,
            handle: website.host,
            displayName: website.host,
            profileUrl: website.siteUrl,
            status: "connected",
            accessStatus: "selected",
            isAvailableThroughAuth: true,
            firstDiscoveredAt: now,
            lastDiscoveredAt: now,
            metadata: { source: "web_site_verification" },
          },
        });
      }

      await transaction.socialAccount.updateMany({
        where: {
          clientId: options.clientId,
          providerConnectionId: current.id,
          platform: "web",
          status: "connected",
          NOT: { externalAccountId: website.host },
        },
        data: {
          status: "not_connected",
          accessStatus: "available",
        },
      });

      await transaction.socialProviderConnection.update({
        where: { id: current.id },
        data: {
          status: "connected",
          externalSubjectId: website.host,
          displayName: website.host,
          connectedAt: now,
          authorizedAt: now,
          lastValidatedAt: now,
          disconnectedAt: null,
          metadata: {
            kind: "web_site",
            siteUrl: website.siteUrl,
            host: website.host,
            verifiedAt: now.toISOString(),
          },
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ServiceError(
        "conflict",
        "This website is already connected in this workspace.",
      );
    }
    throw error;
  }

  const view = await getWebSiteConnection({
    clientId: options.clientId,
    businessBrandId: options.businessBrandId,
  });

  if (!view || view.status !== "connected") {
    throw new ServiceError(
      "unavailable",
      "The website was verified but could not be saved.",
      { status: 503 },
    );
  }

  return view;
}
