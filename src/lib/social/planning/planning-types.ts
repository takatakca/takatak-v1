export type PlanningPublication = {
  state: "sending" | "confirmed" | "failed" | "uncertain" | "needs_reconnect" | null;
  remotePostId: string | null;
  permalinkUrl: string | null;
  errorMessage: string | null;
  confirmedAt: string | null;
};

export type PlanningPost = {
  id: string;
  platform: string;
  caption: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  approvalStatus: string | null;
  publication: PlanningPublication | null;
};

export type PlanningPageData = {
  posts: PlanningPost[];
  connectedPlatforms: string[];
  postsUsedThisMonth: number;
  monthlyPostAllowance: number | null;
  /** Best posting times from the brand's own measured posts, or null when there is not enough data. */
  bestTimes?: BestTimes | null;
};

/** 7 × 24 scores (Sunday first, hour 0–23) from 0 to 1, from real engagement. */
export type BestTimes = { scores: number[][]; sample: number; timeZone: string };

/** Fewer measured posts than this and no best times are shown (they would be noise). */
export const BEST_TIMES_MIN_SAMPLE = 5;

/**
 * Average engagement per weekday and hour in the workspace's time zone,
 * scaled to 0–1. Pure, so it is tested without a database. Only posts with a
 * confirmed engagement value count; nothing is invented for empty slots.
 */
export function bestTimeScores(
  items: Array<{ publishedAt: Date; engagement: number | null }>,
  timeZone: string,
): BestTimes | null {
  const sums = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const counts = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  let safeZone = timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    safeZone = "UTC";
  }
  const format = new Intl.DateTimeFormat("en-US", { timeZone: safeZone, weekday: "short", hour: "2-digit", hourCycle: "h23" });
  const DAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let sample = 0;
  for (const item of items) {
    if (item.engagement === null || !Number.isFinite(item.engagement) || item.engagement < 0) continue;
    const parts = format.formatToParts(item.publishedAt);
    const day = DAYS[parts.find((p) => p.type === "weekday")?.value ?? ""];
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    if (day === undefined || !Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    sums[day][hour] += item.engagement;
    counts[day][hour] += 1;
    sample += 1;
  }
  if (sample < BEST_TIMES_MIN_SAMPLE) return null;
  const averages = sums.map((row, d) => row.map((total, h) => (counts[d][h] ? total / counts[d][h] : 0)));
  const max = Math.max(...averages.flat());
  if (max <= 0) return null;
  return { scores: averages.map((row) => row.map((value) => Math.round((value / max) * 100) / 100)), sample, timeZone: safeZone };
}

export type PlanningGroups = {
  /** Scheduled for later, in time order. */
  upcoming: PlanningPost[];
  /** Failed, waiting for reconnection, or awaiting verification. */
  attention: PlanningPost[];
  /** Confirmed with a provider post id, newest first. */
  published: PlanningPost[];
  /** Scheduled time already passed but not published and not failed (queued or publishing). */
  inProgress: PlanningPost[];
};

/** Pure grouping for the Scheduled & published view. */
export function groupPlanningPosts(posts: PlanningPost[], now: Date): PlanningGroups {
  const groups: PlanningGroups = { upcoming: [], attention: [], published: [], inProgress: [] };
  for (const post of posts) {
    const state = post.publication?.state ?? null;
    if (post.status === "published" || state === "confirmed") {
      groups.published.push(post);
      continue;
    }
    if (post.status === "failed" || state === "failed" || state === "needs_reconnect" || state === "uncertain") {
      groups.attention.push(post);
      continue;
    }
    if (post.status === "scheduled" && post.scheduledAt) {
      if (Date.parse(post.scheduledAt) > now.getTime()) groups.upcoming.push(post);
      else groups.inProgress.push(post);
    }
  }
  groups.upcoming.sort((a, b) => Date.parse(a.scheduledAt ?? "") - Date.parse(b.scheduledAt ?? ""));
  groups.published.sort((a, b) => Date.parse(b.publishedAt ?? b.publication?.confirmedAt ?? "") - Date.parse(a.publishedAt ?? a.publication?.confirmedAt ?? ""));
  return groups;
}
