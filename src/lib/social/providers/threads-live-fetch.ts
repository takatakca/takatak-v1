import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  dayKey,
  parseInsightSeries,
  parseInsightTotals,
  parseThreadsPosts,
  withThreadsInsights,
  type InstagramLiveMedia,
  type InstagramLiveStats,
} from "@/lib/social/instagram-live-stats";
import { buildSocialCredentialAad, decryptSocialTokenPayload } from "@/lib/social/security/social-crypto";

// Reads the connected Threads profile's real numbers from the Threads API with
// the workspace's own sealed token (Threads Login). Same shape as Instagram so
// the network screen shows them with the same panels. The token is sent the
// way the existing Threads connection code sends it, server to Threads only,
// and never logged.

const GRAPH = "https://graph.threads.net/v1.0";
const REQUEST_TIMEOUT_MS = 6_000;
const DEADLINE_MS = 9_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_POST_PAGES = 4;
const MAX_POSTS_WITH_INSIGHTS = 40;
const LOOKBACK_DAYS = 366;

const cache = new Map<string, { at: number; value: InstagramLiveStats }>();

type Result = { ok: true; body: unknown } | { ok: false; status: number };

async function threadsGet(token: string, path: string, params: Record<string, string>): Promise<Result> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function loadCredential(options: { clientId: string; socialAccountId: string }): Promise<{ userId: string; token: string } | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const account = await prisma.socialAccount.findFirst({
    where: { id: options.socialAccountId, clientId: options.clientId, platform: "threads" },
    select: {
      externalAccountId: true,
      providerConnection: {
        select: {
          id: true,
          clientId: true,
          provider: true,
          credential: { select: { status: true, encryptedPayload: true, iv: true, authTag: true, keyVersion: true } },
        },
      },
    },
  });
  const connection = account?.providerConnection;
  const userId = account?.externalAccountId?.trim() ?? "";
  if (!connection || connection.provider !== "threads" || connection.clientId !== options.clientId || !userId) return null;
  if (!connection.credential || connection.credential.status !== "active") return null;
  try {
    const payload = decryptSocialTokenPayload(
      {
        ciphertext: connection.credential.encryptedPayload,
        iv: connection.credential.iv,
        authTag: connection.credential.authTag,
        keyVersion: connection.credential.keyVersion,
      },
      buildSocialCredentialAad({ clientId: connection.clientId, connectionId: connection.id, provider: connection.provider }),
    );
    if (!payload.accessToken?.trim()) return null;
    if (payload.providerAccountId && payload.providerAccountId !== userId) return null;
    return { userId, token: payload.accessToken };
  } catch {
    console.error("[threads-live] credential could not be read");
    return null;
  }
}

async function fetchPosts(credential: { userId: string; token: string }, missing: string[]): Promise<InstagramLiveMedia[]> {
  const startedAt = Date.now();
  const oldest = startedAt - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const posts: InstagramLiveMedia[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_POST_PAGES; page += 1) {
    const params: Record<string, string> = { fields: "id,media_type,text,timestamp,permalink", limit: "50" };
    if (after) params.after = after;
    const result = await threadsGet(credential.token, `${credential.userId}/threads`, params);
    if (!result.ok) {
      if (page === 0) missing.push("media");
      break;
    }
    const batch = parseThreadsPosts(result.body);
    posts.push(...batch);
    const paging = (result.body as { paging?: { cursors?: { after?: unknown }; next?: unknown } }).paging;
    after = typeof paging?.cursors?.after === "string" && typeof paging.next === "string" ? paging.cursors.after : null;
    const last = batch.at(-1);
    if (!after || !last || Date.parse(last.publishedAt) < oldest || Date.now() - startedAt > DEADLINE_MS / 2) break;
  }
  const recent = posts.filter((item) => Date.parse(item.publishedAt) >= oldest);
  // Numbers per post: the most recent ones, five at a time, within the time budget.
  const withNumbers = recent.slice(0, MAX_POSTS_WITH_INSIGHTS);
  let refused = 0;
  for (let index = 0; index < withNumbers.length; index += 5) {
    if (Date.now() - startedAt > DEADLINE_MS) {
      missing.push("older_media");
      break;
    }
    await Promise.all(
      withNumbers.slice(index, index + 5).map(async (item, offset) => {
        const result = await threadsGet(credential.token, `${item.id}/insights`, { metric: "views,likes,replies,reposts,quotes,shares" });
        if (result.ok) withNumbers[index + offset] = withThreadsInsights(item, result.body);
        else refused += 1;
      }),
    );
  }
  if (refused) missing.push("media_insights");
  return [...withNumbers, ...recent.slice(MAX_POSTS_WITH_INSIGHTS)];
}

async function fetchAccount(credential: { userId: string; token: string }, missing: string[]): Promise<{ account: InstagramLiveStats["account"]; followers: number | null }> {
  const untilDate = new Date();
  const sinceDate = new Date(untilDate.getTime() - 29 * 24 * 60 * 60 * 1000);
  const since = String(Math.floor(sinceDate.getTime() / 1000));
  const until = String(Math.floor(untilDate.getTime() / 1000));
  const path = `${credential.userId}/threads_insights`;
  const [views, totals, followers] = await Promise.all([
    threadsGet(credential.token, path, { metric: "views", since, until }),
    threadsGet(credential.token, path, { metric: "likes,replies,reposts,quotes,clicks", since, until }),
    threadsGet(credential.token, path, { metric: "followers_count" }),
  ]);
  const followerTotals = followers.ok ? parseInsightTotals(followers.body) : {};
  if (!views.ok && !totals.ok) {
    missing.push("account_insights");
    return { account: null, followers: followerTotals.followers_count ?? null };
  }
  const sums = totals.ok ? parseInsightTotals(totals.body) : {};
  const viewSeries = views.ok ? parseInsightSeries(views.body, "views") : [];
  const shared = [sums.reposts, sums.quotes].filter((value): value is number => typeof value === "number");
  return {
    followers: followerTotals.followers_count ?? null,
    account: {
      since: dayKey(sinceDate),
      until: dayKey(untilDate),
      reachSeries: viewSeries,
      newFollowersSeries: [],
      views: viewSeries.length ? viewSeries.reduce((total, point) => total + point.value, 0) : null,
      accountsEngaged: null,
      totalInteractions: null,
      likes: sums.likes ?? null,
      comments: sums.replies ?? null,
      saves: null,
      shares: shared.length ? shared.reduce((total, value) => total + value, 0) : null,
      profileLinksTaps: sums.clicks ?? null,
      follows: null,
      unfollows: null,
    },
  };
}

/** The Threads profile's live numbers, or null when there is no readable Threads Login token. */
export async function loadThreadsLiveStats(options: { clientId: string; socialAccountId: string }): Promise<InstagramLiveStats | null> {
  const key = `${options.clientId}:${options.socialAccountId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const credential = await loadCredential(options);
  if (!credential) return null;
  const missing: string[] = [];
  const [profile, media, account] = await Promise.all([
    threadsGet(credential.token, credential.userId, { fields: "id,username" }),
    fetchPosts(credential, missing),
    fetchAccount(credential, missing),
  ]);
  if (!profile.ok) missing.push("profile");
  const username = profile.ok && typeof (profile.body as { username?: unknown }).username === "string" ? (profile.body as { username: string }).username : null;
  const value: InstagramLiveStats = {
    fetchedAt: new Date().toISOString(),
    username,
    followers: account.followers,
    following: null,
    // Threads gives no total post count: the screen counts the posts it read (last 12 months).
    mediaCount: missing.includes("media") ? null : media.length,
    media,
    account: account.account,
    canTrackCompetitors: false,
    missing: [...new Set(missing)],
  };
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}
