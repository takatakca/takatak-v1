import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  dayKey,
  parseInsightBreakdown,
  parseInsightSeries,
  parseInsightTotals,
  parseInstagramMedia,
  type InstagramLiveAccount,
  type InstagramLiveMedia,
  type InstagramLiveStats,
} from "@/lib/social/instagram-live-stats";
import { getMetaGraphApiVersion } from "@/lib/social/providers/meta-oauth";
import {
  buildSocialCredentialAad,
  decryptSocialTokenPayload,
  readMetaFacebookPageCredential,
} from "@/lib/social/security/social-crypto";

// Reads the connected Instagram professional account's real numbers from the
// Instagram Graph API, with the workspace's own sealed token. Instagram Login
// accounts are read on graph.instagram.com; accounts linked through a Facebook
// Page on graph.facebook.com with the Page token. Tokens never leave this file
// (they travel in the Authorization header, never in a URL that could be logged).

const REQUEST_TIMEOUT_MS = 6_000;
/** The page never waits longer than this for more media pages. */
const MEDIA_DEADLINE_MS = 8_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_MEDIA_PAGES = 4;
const MEDIA_PAGE_SIZE = 50;
const MEDIA_LOOKBACK_DAYS = 366;
const ACCOUNT_DAYS = 30;

const INSIGHT_SCOPES = new Set(["instagram_business_manage_insights", "instagram_manage_insights"]);

const cache = new Map<string, { at: number; value: InstagramLiveStats }>();

type Credential = { host: string; igUserId: string; accessToken: string; insights: boolean };

type GraphResult = { ok: true; body: unknown } | { ok: false; status: number };

async function graphGet(credential: Credential, path: string, params: Record<string, string>): Promise<GraphResult> {
  const url = new URL(`${credential.host}/${getMetaGraphApiVersion()}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${credential.accessToken}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/** Loads the token of the dashboard's Instagram account, scoped to the workspace. */
async function loadCredential(options: { clientId: string; socialAccountId: string }): Promise<Credential | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const account = await prisma.socialAccount.findFirst({
    where: { id: options.socialAccountId, clientId: options.clientId, platform: "instagram" },
    select: {
      externalAccountId: true,
      providerConnection: {
        select: {
          id: true,
          clientId: true,
          provider: true,
          status: true,
          scopes: true,
          credential: {
            select: { status: true, encryptedPayload: true, iv: true, authTag: true, keyVersion: true },
          },
        },
      },
    },
  });
  const connection = account?.providerConnection;
  const igUserId = account?.externalAccountId?.trim() ?? "";
  if (!account || !connection || !igUserId || connection.clientId !== options.clientId) return null;
  if (!connection.credential || connection.credential.status !== "active") return null;
  if (connection.provider !== "instagram" && connection.provider !== "meta") return null;
  let payload;
  try {
    payload = decryptSocialTokenPayload(
      {
        ciphertext: connection.credential.encryptedPayload,
        iv: connection.credential.iv,
        authTag: connection.credential.authTag,
        keyVersion: connection.credential.keyVersion,
      },
      buildSocialCredentialAad({ clientId: connection.clientId, connectionId: connection.id, provider: connection.provider }),
    );
  } catch {
    console.error("[instagram-live] credential could not be read");
    return null;
  }
  const insights = connection.scopes.some((scope) => INSIGHT_SCOPES.has(scope));
  if (connection.provider === "instagram") {
    if (!payload.accessToken?.trim()) return null;
    if (payload.providerAccountId && payload.providerAccountId !== igUserId) return null;
    return { host: "https://graph.instagram.com", igUserId, accessToken: payload.accessToken, insights };
  }
  const page = readMetaFacebookPageCredential(payload);
  const accessToken = page?.accessToken ?? payload.accessToken;
  if (!accessToken?.trim()) return null;
  return { host: "https://graph.facebook.com", igUserId, accessToken, insights };
}

const MEDIA_FIELDS = "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count";

async function fetchMedia(credential: Credential, missing: string[]): Promise<InstagramLiveMedia[]> {
  const startedAt = Date.now();
  const oldest = startedAt - MEDIA_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const withInsights = credential.insights ? `${MEDIA_FIELDS},insights.metric(views,reach,saved,shares)` : MEDIA_FIELDS;
  let fields = withInsights;
  const media: InstagramLiveMedia[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_MEDIA_PAGES; page += 1) {
    const params: Record<string, string> = { fields, limit: String(MEDIA_PAGE_SIZE) };
    if (after) params.after = after;
    let result = await graphGet(credential, `${credential.igUserId}/media`, params);
    if (!result.ok && fields !== MEDIA_FIELDS) {
      // One media can refuse a metric (very old post, music rights): fall back to the counts.
      fields = MEDIA_FIELDS;
      missing.push("media_insights");
      result = await graphGet(credential, `${credential.igUserId}/media`, { ...params, fields });
    }
    if (!result.ok) {
      if (page === 0) missing.push("media");
      break;
    }
    const batch = parseInstagramMedia(result.body);
    media.push(...batch);
    const cursors = (result.body as { paging?: { cursors?: { after?: unknown }; next?: unknown } }).paging;
    after = typeof cursors?.cursors?.after === "string" && typeof cursors.next === "string" ? cursors.cursors.after : null;
    const last = batch.at(-1);
    if (!after || !last || Date.parse(last.publishedAt) < oldest) break;
    if (Date.now() - startedAt > MEDIA_DEADLINE_MS) {
      missing.push("older_media");
      break;
    }
  }
  return media.filter((item) => Date.parse(item.publishedAt) >= oldest);
}

async function fetchAccount(credential: Credential, missing: string[]): Promise<InstagramLiveAccount | null> {
  if (!credential.insights) {
    missing.push("account_insights");
    return null;
  }
  const untilDate = new Date();
  const sinceDate = new Date(untilDate.getTime() - (ACCOUNT_DAYS - 1) * 24 * 60 * 60 * 1000);
  const since = String(Math.floor(sinceDate.getTime() / 1000));
  const until = String(Math.floor(untilDate.getTime() / 1000));
  const path = `${credential.igUserId}/insights`;
  const [reach, followers, totals, follows] = await Promise.all([
    graphGet(credential, path, { metric: "reach", period: "day", since, until }),
    graphGet(credential, path, { metric: "follower_count", period: "day", since, until }),
    graphGet(credential, path, {
      metric: "views,accounts_engaged,total_interactions,likes,comments,saves,shares,profile_links_taps",
      period: "day",
      metric_type: "total_value",
      since,
      until,
    }),
    graphGet(credential, path, { metric: "follows_and_unfollows", period: "day", metric_type: "total_value", breakdown: "follow_type", since, until }),
  ]);
  if (!reach.ok && !followers.ok && !totals.ok && !follows.ok) {
    missing.push("account_insights");
    return null;
  }
  if (!followers.ok) missing.push("new_followers");
  const sums = totals.ok ? parseInsightTotals(totals.body) : {};
  const followSplit = follows.ok ? parseInsightBreakdown(follows.body, "follows_and_unfollows") : {};
  return {
    since: dayKey(sinceDate),
    until: dayKey(untilDate),
    reachSeries: reach.ok ? parseInsightSeries(reach.body, "reach") : [],
    newFollowersSeries: followers.ok ? parseInsightSeries(followers.body, "follower_count") : [],
    views: sums.views ?? null,
    accountsEngaged: sums.accounts_engaged ?? null,
    totalInteractions: sums.total_interactions ?? null,
    likes: sums.likes ?? null,
    comments: sums.comments ?? null,
    saves: sums.saves ?? null,
    shares: sums.shares ?? null,
    profileLinksTaps: sums.profile_links_taps ?? null,
    follows: followSplit.FOLLOWER ?? null,
    unfollows: followSplit.NON_FOLLOWER ?? null,
  };
}

/**
 * The account's live numbers, or null when the account has no readable token.
 * Each part fails on its own: what Instagram refused is listed in `missing`.
 */
export async function loadInstagramLiveStats(options: { clientId: string; socialAccountId: string }): Promise<InstagramLiveStats | null> {
  const key = `${options.clientId}:${options.socialAccountId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const credential = await loadCredential(options);
  if (!credential) return null;

  const missing: string[] = [];
  const [profile, media, account] = await Promise.all([
    graphGet(credential, credential.igUserId, { fields: "username,followers_count,follows_count,media_count" }),
    fetchMedia(credential, missing),
    fetchAccount(credential, missing),
  ]);
  if (!profile.ok) missing.push("profile");
  const body = profile.ok ? (profile.body as Record<string, unknown>) : {};
  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const value: InstagramLiveStats = {
    fetchedAt: new Date().toISOString(),
    username: typeof body.username === "string" ? body.username : null,
    followers: num(body.followers_count),
    following: num(body.follows_count),
    mediaCount: num(body.media_count),
    media,
    account,
    missing: [...new Set(missing)],
  };
  if (!profile.ok && !media.length && !account) {
    console.error("[instagram-live] Instagram answered no part of the request");
  }
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}
