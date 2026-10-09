import { timingSafeEqual } from "node:crypto";

import { resolveEffectiveSocialEntitlements } from "@/lib/billing/social/subscription-lifecycle";

export const AHMV_PUBLIC_TEAM_ID_RE = /^\d{8,24}$/;

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
    ? (value as Record<string, unknown>)
    : null;
}

export function ahmvTeamIdsFromMetadata(metadata: unknown): string[] {
  const root = metadataRecord(metadata);
  const ahmv = metadataRecord(root?.["ahmv"]);
  if (!ahmv) return [];

  const candidates: unknown[] = [];
  if (typeof ahmv["publicTeamId"] === "string") {
    candidates.push(ahmv["publicTeamId"]);
  }
  if (Array.isArray(ahmv["publicTeamIds"])) {
    candidates.push(...ahmv["publicTeamIds"]);
  }

  return [...new Set(
    candidates.filter(
      (value): value is string =>
        typeof value === "string" && AHMV_PUBLIC_TEAM_ID_RE.test(value),
    ),
  )].sort();
}

export function ahmvTeamIdFromServiceMetadata(metadata: unknown): string | null {
  const ids = ahmvTeamIdsFromMetadata(metadata);
  return ids.length === 1 ? ids[0] ?? null : null;
}

export function metadataHasAhmvTeamId(
  metadata: unknown,
  teamId: string,
): boolean {
  return (
    AHMV_PUBLIC_TEAM_ID_RE.test(teamId) &&
    ahmvTeamIdsFromMetadata(metadata).includes(teamId)
  );
}

export function bearerMatches(
  value: string | null,
  expected: string | undefined,
): boolean {
  if (!value || !expected || expected.length < 24) return false;

  const prefix = "Bearer ";
  if (!value.startsWith(prefix)) return false;

  const provided = value.slice(prefix.length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export function resolveAhmvTeamFeedAccess(
  service: AhmvMappedService,
): "ready" | "subscription_required" | "unavailable" {
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
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return undefined;
    }
    return url.toString();
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
