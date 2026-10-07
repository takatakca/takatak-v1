import "server-only";

const PROFILE_URL = "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile";
const FEED_URL = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed";
const TIMEOUT_MS = 8_000;
const MAX_FEED_PAGES = 2;

export type BlueskyPostItem = {
  id: string;
  text: string;
  createdAt: string;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
};

export type BlueskyAnalytics = {
  followers: number | null;
  following: number | null;
  posts: number | null;
  dailyPosts: number | null;
  postsPerWeek: number | null;
  postsInRange: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  interactions: number | null;
  dailyLikes: number | null;
  likesPerPost: number | null;
  dailyReposts: number | null;
  repostsPerPost: number | null;
  avatarUrl: string | null;
  postItems: BlueskyPostItem[];
};

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function avatarUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("https://")) return null;
  try {
    const url = new URL(value);
    if (url.hostname !== "cdn.bsky.app") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : null;
}

async function getJson(url: URL): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    return object(body);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function dayCount(start: string, end: string): number {
  const from = new Date(`${start}T00:00:00Z`).getTime();
  const to = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 1;
  return Math.round((to - from) / 86_400_000) + 1;
}

function rate(total: number, divisor: number): number | null {
  if (divisor <= 0) return null;
  return Math.round((total / divisor) * 10) / 10;
}

async function fetchPostsInRange(actor: string, start: string, end: string): Promise<{
  loaded: boolean;
  items: BlueskyPostItem[];
}> {
  const items: BlueskyPostItem[] = [];
  let cursor: string | null = null;
  let pages = 0;
  let loaded = false;

  do {
    const feedUrl = new URL(FEED_URL);
    feedUrl.searchParams.set("actor", actor);
    feedUrl.searchParams.set("limit", "100");
    feedUrl.searchParams.set("filter", "posts_and_author_threads");
    if (cursor) feedUrl.searchParams.set("cursor", cursor);

    const feed = await getJson(feedUrl);
    if (!feed) break;
    loaded = true;

    const rows = Array.isArray(feed.feed) ? feed.feed : [];
    if (!rows.length) break;

    let reachedOlder = false;
    for (const rowValue of rows) {
      const row = object(rowValue);
      const reason = object(row?.reason);
      const reasonType = typeof reason?.$type === "string" ? reason.$type : "";
      if (reasonType.includes("reasonRepost")) continue;

      const post = object(row?.post);
      const record = object(post?.record);
      const createdAt = typeof record?.createdAt === "string" ? record.createdAt : null;
      if (!createdAt) continue;
      const day = createdAt.slice(0, 10);
      if (day > end) continue;
      if (day < start) {
        reachedOlder = true;
        continue;
      }

      const uri = typeof post?.uri === "string" ? post.uri : createdAt;
      items.push({
        id: uri,
        text: typeof record?.text === "string" ? record.text.slice(0, 280) : "",
        createdAt,
        likes: count(post?.likeCount) ?? 0,
        replies: count(post?.replyCount) ?? 0,
        reposts: count(post?.repostCount) ?? 0,
        quotes: count(post?.quoteCount) ?? 0,
      });
    }

    cursor = typeof feed.cursor === "string" ? feed.cursor : null;
    pages += 1;
    if (reachedOlder || !cursor) break;
  } while (pages < MAX_FEED_PAGES);

  return { loaded, items };
}

export async function fetchBlueskyAnalytics(options: {
  handle: string;
  start: string;
  end: string;
}): Promise<BlueskyAnalytics> {
  const empty: BlueskyAnalytics = {
    followers: null,
    following: null,
    posts: null,
    dailyPosts: null,
    postsPerWeek: null,
    postsInRange: null,
    likes: null,
    replies: null,
    reposts: null,
    quotes: null,
    interactions: null,
    dailyLikes: null,
    likesPerPost: null,
    dailyReposts: null,
    repostsPerPost: null,
    avatarUrl: null,
    postItems: [],
  };

  const actor = options.handle.replace(/^@/, "").trim();
  if (!actor) return empty;

  const profileUrl = new URL(PROFILE_URL);
  profileUrl.searchParams.set("actor", actor);
  const [profile, posts] = await Promise.all([
    getJson(profileUrl),
    fetchPostsInRange(actor, options.start, options.end),
  ]);

  const days = dayCount(options.start, options.end);
  const weekStart = new Date(`${options.end}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const weekKey = weekStart.toISOString().slice(0, 10);
  const items = posts.items;
  const likes = posts.loaded ? items.reduce((sum, item) => sum + item.likes, 0) : null;
  const replies = posts.loaded ? items.reduce((sum, item) => sum + item.replies, 0) : null;
  const reposts = posts.loaded ? items.reduce((sum, item) => sum + item.reposts, 0) : null;
  const quotes = posts.loaded ? items.reduce((sum, item) => sum + item.quotes, 0) : null;
  const postsInRange = posts.loaded ? items.length : null;
  const postsInWeek = posts.loaded
    ? items.filter((item) => item.createdAt.slice(0, 10) >= weekKey).length
    : null;

  return {
    followers: count(profile?.followersCount),
    following: count(profile?.followsCount),
    posts: count(profile?.postsCount),
    avatarUrl: avatarUrl(profile?.avatar),
    dailyPosts: postsInRange == null ? null : Math.round(postsInRange / days),
    postsPerWeek: postsInWeek,
    postsInRange,
    likes,
    replies,
    reposts,
    quotes,
    interactions:
      likes == null || replies == null || reposts == null || quotes == null
        ? null
        : likes + replies + reposts + quotes,
    dailyLikes: likes == null ? null : Math.round(likes / days),
    likesPerPost: likes == null || postsInRange == null ? null : rate(likes, postsInRange),
    dailyReposts: reposts == null ? null : Math.round(reposts / days),
    repostsPerPost:
      reposts == null || postsInRange == null ? null : rate(reposts, postsInRange),
    postItems: items,
  };
}
