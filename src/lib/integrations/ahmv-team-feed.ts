import "server-only";

import { timingSafeEqual } from "node:crypto";

import { resolveEffectiveSocialEntitlements } from "@/lib/billing/social/subscription-lifecycle";

export type AhmvMappedService = {
  clientId: string;
  businessBrandId: string | null;
  status: string;
  metadata: unknown;
  businessBrand: { status: string } | null;
  client: {
    subscription: {
      status: string;
      planCode: string | null;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: Date | null;
      xAccountAllowance: number;
      advancedAnalytics: boolean;
    } | null;
  };
};

export type AhmvPublicContentRow = {
  externalIdHash: string;
  publishedAt: Date;
  captionExcerpt: string | null;
  permalinkUrl: string | null;
  thumbnailUrl: string | null;
  socialAccount: { platform: string };
};

const ALLOWED_PLATFORMS = new Set([
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "youtube",
]);

function metadataRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function ahmvTeamIdFromServiceMetadata(metadata: unknown): string | null {
  const root = metadataRecord(metadata);
  const ahmv = metadataRecord(root?.["ahmv"]);
  const value = ahmv?.["publicTeamId"];
  if (typeof value !== "string" || !/^\d{8,24}$/.test(value)) return null;
  return value;
}

export function bearerMatches(value: string | null, expected: string | undefined): boolean {
  if (!value || !expected || expected.length < 24) return false;
  const prefix = "Bearer ";
  if (!value.startsWith(prefix)) return false;
  const provided = value.slice(prefix.length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function resolveAhmvTeamFeedAccess(service: AhmvMappedService):
  | "ready"
  | "subscription_required"
  | "unavailable" {
  if (
    service.status !== "active" ||
    !service.businessBrandId ||
    service.businessBrand?.status !== "active"
  ) {
    return "unavailable";
  }

  const subscription = service.client.subscription;
  if (!subscription) return "subscription_required";

  const { lifecycle } = resolveEffectiveSocialEntitlements({
    status: subscription.status,
    planCode: subscription.planCode,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodEnd: subscription.currentPeriodEnd,
    addOns: {
      xAccountAllowance: subscription.xAccountAllowance,
      advancedAnalytics: subscription.advancedAnalytics,
    },
  });

  return lifecycle.access === "paid" ? "ready" : "subscription_required";
}

function secureUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function publicAhmvFeedItem(row: AhmvPublicContentRow) {
  const platform = row.socialAccount.platform;
  const url = secureUrl(row.permalinkUrl);
  if (!ALLOWED_PLATFORMS.has(platform) || !url) return null;

  const mediaUrl = secureUrl(row.thumbnailUrl);
  return {
    id: row.externalIdHash.slice(0, 160),
    platform,
    publishedAt: row.publishedAt.toISOString(),
    text: (row.captionExcerpt ?? "").slice(0, 1200),
    url,
    ...(mediaUrl ? { mediaUrl } : {}),
  };
}
