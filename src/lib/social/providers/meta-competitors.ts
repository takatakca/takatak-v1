import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { ServiceError } from "@/lib/services/service-error";
import {
  GRAPH_VERSION,
  MetaInsightError,
  type MetaInsightsTransport,
} from "@/lib/social/providers/meta-insights";
import { getMetaAppId } from "@/lib/social/providers/meta-oauth";
import { getMetaAppSecret } from "@/lib/social/providers/meta-token";

const META_GRAPH_HOST = "https://graph.facebook.com";
const REQUEST_TIMEOUT_MS = 12_000;

/**
 * Verified Meta capability matrix for competitor tracking (Graph v21).
 * Private insights are never claimed for competitor Pages.
 */
export const FACEBOOK_COMPETITOR_CAPABILITY_MATRIX = [
  {
    field: "page_name",
    metaSource: "Page.name",
    requires: "Page Public Metadata Access (PPMA) or Page Public Content Access (PPCA)",
    status: "conditional",
    notes: "Public Page name when app feature is approved.",
  },
  {
    field: "profile_image",
    metaSource: "Page.picture",
    requires: "PPMA or PPCA",
    status: "conditional",
    notes: "Public profile picture URL.",
  },
  {
    field: "category",
    metaSource: "Page.category",
    requires: "PPMA or PPCA",
    status: "conditional",
    notes: "Public category string when returned.",
  },
  {
    field: "follower_count",
    metaSource: "followers_count|fan_count",
    requires: "PPMA or PPCA",
    status: "conditional",
    notes: "Public follower/fan count only — not private growth insights.",
  },
  {
    field: "username_link",
    metaSource: "username|link",
    requires: "PPMA or PPCA",
    status: "conditional",
    notes: "Used for resolve/validation only.",
  },
  {
    field: "pages_search",
    metaSource: "GET /pages/search",
    requires: "PPMA (or PPCA superseding)",
    status: "conditional",
    notes: "Discovery/search of public Pages.",
  },
  {
    field: "public_feed_engagement",
    metaSource: "Page.feed reactions/comments/shares summaries",
    requires: "Page Public Content Access (PPCA)",
    status: "conditional",
    notes: "Visible public engagement only when PPCA granted.",
  },
  {
    field: "competitor_reach",
    metaSource: "n/a",
    requires: "not available",
    status: "unsupported",
    notes: "Competitor reach is private Page insight data.",
  },
  {
    field: "competitor_impressions",
    metaSource: "n/a",
    requires: "not available",
    status: "unsupported",
    notes: "Competitor impressions are private Page insight data.",
  },
  {
    field: "competitor_demographics",
    metaSource: "n/a",
    requires: "not available",
    status: "unsupported",
    notes: "Competitor demographics are never exposed via public competitor APIs.",
  },
  {
    field: "competitor_clicks",
    metaSource: "n/a",
    requires: "not available",
    status: "unsupported",
    notes: "Competitor clicks are private analytics.",
  },
  {
    field: "scraping_fallback",
    metaSource: "n/a",
    requires: "forbidden",
    status: "unsupported",
    notes: "Takatak never scrapes Facebook or bypasses Graph access controls.",
  },
] as const;

export type CompetitorCapabilityStatus =
  | "ready"
  | "feature_required"
  | "permission_denied"
  | "unavailable"
  | "rate_limited"
  | "unknown";

export type CompetitorCapabilityProbe = {
  status: CompetitorCapabilityStatus;
  graphApiVersion: string;
  pagesSearch: "supported" | "feature_required" | "permission_denied" | "unavailable" | "rate_limited";
  publicMetadata: "supported" | "feature_required" | "permission_denied" | "unavailable" | "rate_limited";
  publicContent: "unsupported_until_ppca" | "supported" | "feature_required" | "unavailable";
  reason: string;
  retrievedAt: string;
};

export type ParsedFacebookPageInput =
  | {
      ok: true;
      kind: "username" | "page_id";
      value: string;
      source: "url" | "username";
    }
  | {
      ok: false;
      category:
        | "invalid"
        | "ssrf"
        | "unsupported_host"
        | "empty";
      message: string;
    };

export type ResolvedCompetitorPage = {
  externalPageId: string;
  externalPageIdHash: string;
  usernameCanonical: string | null;
  pageName: string | null;
  profileImageUrl: string | null;
  category: string | null;
  followerCount: number | null;
  followerFieldSource: "followers_count" | "fan_count" | null;
  graphApiVersion: string;
  retrievedAt: string;
  metricStatus: {
    followerCount: "confirmed" | "confirmed_zero" | "unavailable" | "permission_denied";
    pageName: "confirmed" | "unavailable";
    profileImage: "confirmed" | "unavailable";
    category: "confirmed" | "unavailable";
  };
};

const ALLOWED_FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "fb.com",
  "www.fb.com",
  "m.fb.com",
]);

function graphUrl(path: string): URL {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${META_GRAPH_HOST}/${GRAPH_VERSION}${normalized}`);
}

export function hashExternalCompetitorPageId(externalPageId: string): string {
  return createHash("sha256")
    .update(`meta:facebook:competitor:${externalPageId}`)
    .digest("hex")
    .slice(0, 32);
}

export function createCompetitorPublicRef(): string {
  return randomBytes(12).toString("hex");
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  // Literal IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  // IPv6 literals / brackets
  if (host.includes(":") || host === "[::1]" || host.startsWith("[") ) {
    return true;
  }
  return false;
}

/**
 * Parse a Facebook Page URL or username. Never fetches arbitrary URLs.
 */
export function parseFacebookCompetitorInput(
  raw: string,
): ParsedFacebookPageInput {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, category: "empty", message: "Enter a Facebook Page URL or username." };
  }

  // Bare username (no scheme / path)
  if (!trimmed.includes("://") && !trimmed.includes("/") && !trimmed.includes("?")) {
    const username = trimmed.replace(/^@/, "").trim();
    if (!/^[A-Za-z0-9.]{1,100}$/.test(username)) {
      return {
        ok: false,
        category: "invalid",
        message: "Username must use letters, numbers, or periods only.",
      };
    }
    if (/^\d+$/.test(username) && username.length >= 5) {
      return { ok: true, kind: "page_id", value: username, source: "username" };
    }
    return { ok: true, kind: "username", value: username.toLowerCase(), source: "username" };
  }

  let url: URL;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    url = new URL(withScheme);
  } catch {
    return { ok: false, category: "invalid", message: "That Facebook Page URL is invalid." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, category: "ssrf", message: "Only https Facebook Page URLs are allowed." };
  }

  const hostname = url.hostname.toLowerCase();
  if (isPrivateOrLocalHostname(hostname)) {
    return {
      ok: false,
      category: "ssrf",
      message: "That host is not allowed.",
    };
  }

  if (!ALLOWED_FACEBOOK_HOSTS.has(hostname)) {
    return {
      ok: false,
      category: "unsupported_host",
      message: "Only facebook.com / fb.com Page URLs are supported.",
    };
  }

  // Block credential/userinfo URLs
  if (url.username || url.password) {
    return { ok: false, category: "ssrf", message: "That Facebook Page URL is invalid." };
  }

  const profileId = url.searchParams.get("id");
  if (url.pathname.includes("profile.php") && profileId && /^\d+$/.test(profileId)) {
    return { ok: true, kind: "page_id", value: profileId, source: "url" };
  }

  const parts = url.pathname.split("/").filter(Boolean);
  // /pages/Category/Name/123456
  if (parts[0]?.toLowerCase() === "pages" && parts.length >= 4) {
    const maybeId = parts[parts.length - 1] ?? "";
    if (/^\d+$/.test(maybeId)) {
      return { ok: true, kind: "page_id", value: maybeId, source: "url" };
    }
  }

  const first = parts[0] ?? "";
  const reserved = new Set([
    "watch",
    "reel",
    "reels",
    "stories",
    "marketplace",
    "groups",
    "events",
    "gaming",
    "login",
    "dialog",
    "share",
    "sharer",
    "privacy",
    "help",
    "settings",
  ]);
  if (!first || reserved.has(first.toLowerCase())) {
    return {
      ok: false,
      category: "invalid",
      message: "Paste a public Facebook Page URL or username.",
    };
  }

  if (/^\d+$/.test(first)) {
    return { ok: true, kind: "page_id", value: first, source: "url" };
  }

  if (!/^[A-Za-z0-9.]{1,100}$/.test(first)) {
    return {
      ok: false,
      category: "invalid",
      message: "That Facebook Page URL could not be understood.",
    };
  }

  return {
    ok: true,
    kind: "username",
    value: first.toLowerCase(),
    source: "url",
  };
}

async function defaultFetchJson(
  url: URL,
  stage: string,
): Promise<Record<string, unknown>> {
  if (url.origin !== META_GRAPH_HOST) {
    throw new MetaInsightError(
      "malformed",
      "Facebook competitor requests must use the Meta Graph host.",
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new MetaInsightError(
        "malformed",
        "Facebook returned an unexpected competitor response.",
        { status: 502 },
      );
    }
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok || body.error) {
      void stage;
      const err =
        typeof body.error === "object" &&
        body.error !== null &&
        !Array.isArray(body.error)
          ? (body.error as Record<string, unknown>)
          : {};
      const message = String(err.message ?? "");
      const code = readNumber(err, "code");
      const lower = message.toLowerCase();
      if (response.status === 429 || code === 4 || code === 17 || code === 32) {
        throw new MetaInsightError(
          "rate_limited",
          "Facebook rate-limited competitor access.",
          { status: 429 },
        );
      }
      if (
        lower.includes("permission") ||
        lower.includes("(#10)") ||
        lower.includes("(#200)") ||
        lower.includes("pages_read") ||
        lower.includes("public content") ||
        lower.includes("public metadata") ||
        code === 10 ||
        code === 200
      ) {
        throw new MetaInsightError(
          "permission_required",
          "Facebook did not authorize competitor Page access for this app.",
          { status: 403 },
        );
      }
      if (
        lower.includes("does not exist") ||
        lower.includes("unsupported get request") ||
        lower.includes("unknown path") ||
        code === 803 ||
        code === 100
      ) {
        throw new MetaInsightError(
          "unsupported",
          "That Facebook Page could not be resolved.",
        );
      }
      if (response.status === 401) {
        throw new MetaInsightError(
          "authorization_expired",
          "Facebook authorization expired.",
          { status: 401 },
        );
      }
      if (response.status >= 500) {
        throw new MetaInsightError(
          "temporary",
          "Facebook competitor lookup failed temporarily.",
          { status: 502 },
        );
      }
      throw new MetaInsightError(
        "temporary",
        "Facebook competitor lookup could not be completed.",
      );
    }
    return body;
  } catch (error) {
    if (error instanceof MetaInsightError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MetaInsightError(
        "temporary",
        "Facebook competitor lookup timed out.",
      );
    }
    throw new MetaInsightError(
      "temporary",
      "Facebook competitor lookup could not be completed.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMetaAppAccessToken(): Promise<string> {
  const appId = getMetaAppId();
  const secret = getMetaAppSecret();
  const url = graphUrl("/oauth/access_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", secret);
  url.searchParams.set("grant_type", "client_credentials");
  const body = await defaultFetchJson(url, "app_token");
  const token = readString(body, "access_token");
  if (!token) {
    throw new ServiceError(
      "unavailable",
      "Facebook app access token could not be obtained.",
      { status: 503 },
    );
  }
  return token;
}

function capabilityFromError(
  error: MetaInsightError,
): Pick<
  CompetitorCapabilityProbe,
  "status" | "pagesSearch" | "publicMetadata" | "reason"
> {
  if (error.category === "rate_limited") {
    return {
      status: "rate_limited",
      pagesSearch: "rate_limited",
      publicMetadata: "rate_limited",
      reason:
        "Meta rate-limited the capability probe. Competitor tracking is temporarily unavailable.",
    };
  }
  if (error.category === "permission_required") {
    return {
      status: "feature_required",
      pagesSearch: "feature_required",
      publicMetadata: "feature_required",
      reason:
        "Meta requires Page Public Metadata Access (or Page Public Content Access) App Review approval before competitor Page data can be read. Takatak will not scrape Facebook or invent competitor metrics.",
    };
  }
  if (error.category === "unsupported") {
    return {
      status: "unavailable",
      pagesSearch: "unavailable",
      publicMetadata: "unavailable",
      reason:
        "Meta did not permit competitor Page lookup for this app configuration.",
    };
  }
  return {
    status: "unavailable",
    pagesSearch: "unavailable",
    publicMetadata: "unavailable",
    reason:
      "Competitor Page access could not be verified with Meta. No scraping fallback is used.",
  };
}

/**
 * Probe whether this app may read public competitor Page metadata.
 * Never scrapes. Never claims private insights.
 */
export async function probeFacebookCompetitorCapability(options?: {
  transport?: MetaInsightsTransport;
  appAccessToken?: string;
}): Promise<CompetitorCapabilityProbe> {
  const forced = process.env.META_COMPETITOR_PUBLIC_ACCESS?.trim().toLowerCase();
  if (forced === "forced_unavailable" || forced === "0" || forced === "false") {
    return {
      status: "feature_required",
      graphApiVersion: GRAPH_VERSION,
      pagesSearch: "feature_required",
      publicMetadata: "feature_required",
      publicContent: "unsupported_until_ppca",
      reason:
        "Competitor public Page access is disabled for this environment. Meta Page Public Metadata Access is required; Takatak does not scrape Facebook.",
      retrievedAt: new Date().toISOString(),
    };
  }

  const transport = options?.transport ?? { fetchJson: defaultFetchJson };
  const retrievedAt = new Date().toISOString();

  try {
    const token =
      options?.appAccessToken ?? (await getMetaAppAccessToken());
    const url = graphUrl("/pages/search");
    url.searchParams.set("q", "a");
    url.searchParams.set("fields", "id,name");
    url.searchParams.set("limit", "1");
    url.searchParams.set("access_token", token);
    await transport.fetchJson(url, "competitor_capability_pages_search");

    return {
      status: "ready",
      graphApiVersion: GRAPH_VERSION,
      pagesSearch: "supported",
      publicMetadata: "supported",
      publicContent:
        forced === "ppca" || forced === "true_ppca"
          ? "supported"
          : "unsupported_until_ppca",
      reason:
        "Meta permitted pages/search for this app. Public competitor metadata may be resolved when Meta returns fields.",
      retrievedAt,
    };
  } catch (error) {
    if (error instanceof MetaInsightError) {
      const mapped = capabilityFromError(error);
      return {
        ...mapped,
        graphApiVersion: GRAPH_VERSION,
        publicContent: "unsupported_until_ppca",
        retrievedAt,
      };
    }
    return {
      status: "unavailable",
      graphApiVersion: GRAPH_VERSION,
      pagesSearch: "unavailable",
      publicMetadata: "unavailable",
      publicContent: "unsupported_until_ppca",
      reason:
        "Competitor capability probe failed. Takatak does not fall back to scraping.",
      retrievedAt,
    };
  }
}

function mapPageNode(
  body: Record<string, unknown>,
  retrievedAt: string,
): ResolvedCompetitorPage {
  const id = readString(body, "id");
  if (!id) {
    throw new MetaInsightError(
      "unsupported",
      "That Facebook Page could not be resolved.",
    );
  }

  const followers = readNumber(body, "followers_count");
  const fans = readNumber(body, "fan_count");
  let followerCount: number | null = null;
  let followerFieldSource: "followers_count" | "fan_count" | null = null;
  if (followers != null) {
    followerCount = Math.max(0, Math.trunc(followers));
    followerFieldSource = "followers_count";
  } else if (fans != null) {
    followerCount = Math.max(0, Math.trunc(fans));
    followerFieldSource = "fan_count";
  }

  const picture =
    typeof body.picture === "object" &&
    body.picture !== null &&
    !Array.isArray(body.picture)
      ? (body.picture as Record<string, unknown>)
      : null;
  const pictureData =
    picture &&
    typeof picture.data === "object" &&
    picture.data !== null &&
    !Array.isArray(picture.data)
      ? (picture.data as Record<string, unknown>)
      : null;
  const profileImageUrl = pictureData
    ? readString(pictureData, "url")
    : null;

  const pageName = readString(body, "name");
  const category = readString(body, "category");

  return {
    externalPageId: id,
    externalPageIdHash: hashExternalCompetitorPageId(id),
    usernameCanonical: readString(body, "username")?.toLowerCase() ?? null,
    pageName,
    profileImageUrl,
    category,
    followerCount,
    followerFieldSource,
    graphApiVersion: GRAPH_VERSION,
    retrievedAt,
    metricStatus: {
      followerCount:
        followerCount == null
          ? "unavailable"
          : followerCount === 0
            ? "confirmed_zero"
            : "confirmed",
      pageName: pageName ? "confirmed" : "unavailable",
      profileImage: profileImageUrl ? "confirmed" : "unavailable",
      category: category ? "confirmed" : "unavailable",
    },
  };
}

/**
 * Resolve a public Facebook Page through Meta Graph only.
 */
export async function resolveFacebookCompetitorPage(options: {
  input: string;
  transport?: MetaInsightsTransport;
  appAccessToken?: string;
}): Promise<ResolvedCompetitorPage> {
  const parsed = parseFacebookCompetitorInput(options.input);
  if (!parsed.ok) {
    throw new ServiceError("invalid_input", parsed.message, { status: 400 });
  }

  const capability = await probeFacebookCompetitorCapability({
    transport: options.transport,
    appAccessToken: options.appAccessToken,
  });
  if (capability.status !== "ready") {
    throw new ServiceError(
      "forbidden",
      capability.reason,
      { status: 403 },
    );
  }

  const transport = options.transport ?? { fetchJson: defaultFetchJson };
  const token =
    options.appAccessToken ?? (await getMetaAppAccessToken());
  const retrievedAt = new Date().toISOString();
  const pathValue = encodeURIComponent(parsed.value);
  const url = graphUrl(`/${pathValue}`);
  url.searchParams.set(
    "fields",
    "id,name,username,link,category,picture.type(large){url},fan_count,followers_count",
  );
  url.searchParams.set("access_token", token);

  try {
    const body = await transport.fetchJson(url, "competitor_page_resolve");
    return mapPageNode(body, retrievedAt);
  } catch (error) {
    if (error instanceof MetaInsightError) {
      if (error.category === "permission_required") {
        throw new ServiceError(
          "forbidden",
          "Meta did not authorize reading this public Page for competitor tracking.",
          { status: 403 },
        );
      }
      if (error.category === "rate_limited") {
        throw new ServiceError(
          "unavailable",
          "Facebook rate-limited competitor lookup. Try again later.",
          { status: 429 },
        );
      }
      if (error.category === "unsupported") {
        throw new ServiceError(
          "not_found",
          "That Facebook Page could not be found or is not publicly resolvable.",
          { status: 404 },
        );
      }
      throw new ServiceError(
        "unavailable",
        "Facebook competitor lookup failed temporarily.",
        { status: 502 },
      );
    }
    throw error;
  }
}

export type CompetitorPublicFeedProbe = {
  postCount: number | null;
  reactionsSum: number | null;
  commentsSum: number | null;
  sharesSum: number | null;
  status: "confirmed" | "unsupported" | "permission_denied" | "unavailable" | "empty";
};

/**
 * Probe public feed engagement only when PPCA may allow it.
 * Never invents engagement; marks unsupported without PPCA.
 */
export async function probeCompetitorPublicFeed(options: {
  externalPageId: string;
  appAccessToken: string;
  transport?: MetaInsightsTransport;
  enabled: boolean;
}): Promise<CompetitorPublicFeedProbe> {
  if (!options.enabled) {
    return {
      postCount: null,
      reactionsSum: null,
      commentsSum: null,
      sharesSum: null,
      status: "unsupported",
    };
  }

  const transport = options.transport ?? { fetchJson: defaultFetchJson };
  const url = graphUrl(`/${encodeURIComponent(options.externalPageId)}/feed`);
  url.searchParams.set(
    "fields",
    "id,created_time,reactions.summary(true).limit(0),comments.summary(true).limit(0),shares",
  );
  url.searchParams.set("limit", "25");
  url.searchParams.set("access_token", options.appAccessToken);

  try {
    const body = await transport.fetchJson(url, "competitor_public_feed");
    const data = Array.isArray(body.data) ? body.data : [];
    if (data.length === 0) {
      return {
        postCount: 0,
        reactionsSum: 0,
        commentsSum: 0,
        sharesSum: 0,
        status: "empty",
      };
    }
    let reactions = 0;
    let comments = 0;
    let shares = 0;
    let reactionSeen = false;
    let commentSeen = false;
    let shareSeen = false;
    for (const row of data) {
      if (typeof row !== "object" || row === null || Array.isArray(row)) continue;
      const record = row as Record<string, unknown>;
      const reactionsNode = record.reactions;
      if (
        typeof reactionsNode === "object" &&
        reactionsNode !== null &&
        !Array.isArray(reactionsNode)
      ) {
        const summary = (reactionsNode as Record<string, unknown>).summary;
        if (
          typeof summary === "object" &&
          summary !== null &&
          !Array.isArray(summary)
        ) {
          const total = readNumber(summary as Record<string, unknown>, "total_count");
          if (total != null) {
            reactions += Math.max(0, Math.trunc(total));
            reactionSeen = true;
          }
        }
      }
      const commentsNode = record.comments;
      if (
        typeof commentsNode === "object" &&
        commentsNode !== null &&
        !Array.isArray(commentsNode)
      ) {
        const summary = (commentsNode as Record<string, unknown>).summary;
        if (
          typeof summary === "object" &&
          summary !== null &&
          !Array.isArray(summary)
        ) {
          const total = readNumber(summary as Record<string, unknown>, "total_count");
          if (total != null) {
            comments += Math.max(0, Math.trunc(total));
            commentSeen = true;
          }
        }
      }
      const sharesNode = record.shares;
      if (
        typeof sharesNode === "object" &&
        sharesNode !== null &&
        !Array.isArray(sharesNode)
      ) {
        const count = readNumber(sharesNode as Record<string, unknown>, "count");
        if (count != null) {
          shares += Math.max(0, Math.trunc(count));
          shareSeen = true;
        }
      }
    }
    return {
      postCount: data.length,
      reactionsSum: reactionSeen ? reactions : null,
      commentsSum: commentSeen ? comments : null,
      sharesSum: shareSeen ? shares : null,
      status: "confirmed",
    };
  } catch (error) {
    if (
      error instanceof MetaInsightError &&
      error.category === "permission_required"
    ) {
      return {
        postCount: null,
        reactionsSum: null,
        commentsSum: null,
        sharesSum: null,
        status: "permission_denied",
      };
    }
    return {
      postCount: null,
      reactionsSum: null,
      commentsSum: null,
      sharesSum: null,
      status: "unavailable",
    };
  }
}

/** Benchmark helpers — only equivalent confirmed public metrics. */
export function computeFollowerDelta(
  newer: number | null,
  older: number | null,
): number | null {
  if (newer == null || older == null) return null;
  return newer - older;
}

export function canRankCompetitors(options: {
  selectedFollowers: number | null;
  competitorFollowers: Array<number | null>;
}): boolean {
  if (options.selectedFollowers == null) return false;
  return options.competitorFollowers.every((value) => value != null);
}
