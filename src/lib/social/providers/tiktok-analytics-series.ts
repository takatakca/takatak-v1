export type TikTokSeriesPost = {
  publishedOn: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
};

export type TikTokFollowerSnapshot = {
  date: string;
  followers: number;
};

export type TikTokDailyPoint = {
  date: string;
  posts: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  interactions: number | null;
  followerBalance: number | null;
  followerGrowth: number | null;
};

export type TikTokSeriesTotals = {
  posts: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  interactions: number | null;
};

function dateKeys(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);

  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function previousDate(value: string): string {
  const cursor = new Date(`${value}T12:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  return cursor.toISOString().slice(0, 10);
}

function sumKnown(values: Array<number | null>): number | null {
  const known = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (!known.length) return null;
  return known.reduce((total, value) => total + value, 0);
}

function coveredValue(
  covered: boolean,
  values: Array<number | null>,
): number | null {
  if (!values.length) {
    return covered ? 0 : null;
  }

  return sumKnown(values);
}

export function buildTikTokSeries(options: {
  start: string;
  end: string;
  /**
   * First day whose video list is complete.
   * Days before this stay unknown instead of being drawn as zero.
   */
  zeroFillFrom: string | null;
  posts: TikTokSeriesPost[];
  followerSnapshots: TikTokFollowerSnapshot[];
}): {
  points: TikTokDailyPoint[];
  totals: TikTokSeriesTotals;
} {
  const dates = dateKeys(options.start, options.end);
  const snapshots = new Map(
    options.followerSnapshots.map((snapshot) => [
      snapshot.date,
      snapshot.followers,
    ]),
  );

  const byDay = new Map<string, TikTokSeriesPost[]>();
  for (const post of options.posts) {
    if (post.publishedOn < options.start || post.publishedOn > options.end) {
      continue;
    }
    const bucket = byDay.get(post.publishedOn) ?? [];
    bucket.push(post);
    byDay.set(post.publishedOn, bucket);
  }

  const points = dates.map((date) => {
    const dayPosts = byDay.get(date) ?? [];
    const covered =
      options.zeroFillFrom != null && date >= options.zeroFillFrom;
    const views = coveredValue(
      covered,
      dayPosts.map((post) => post.views),
    );
    const likes = coveredValue(
      covered,
      dayPosts.map((post) => post.likes),
    );
    const comments = coveredValue(
      covered,
      dayPosts.map((post) => post.comments),
    );
    const shares = coveredValue(
      covered,
      dayPosts.map((post) => post.shares),
    );
    const posts = covered
      ? dayPosts.length
      : dayPosts.length > 0
        ? dayPosts.length
        : null;

    const interactionParts = [likes, comments, shares];
    const interactions =
      posts === 0
        ? 0
        : interactionParts.every((value) => value == null)
          ? null
          : interactionParts.reduce<number>(
              (total, value) => total + (value ?? 0),
              0,
            );

    const followerBalance = snapshots.has(date)
      ? (snapshots.get(date) ?? null)
      : null;
    const previous = snapshots.get(previousDate(date));
    const followerGrowth =
      followerBalance != null && previous != null
        ? followerBalance - previous
        : null;

    return {
      date,
      posts,
      views,
      likes,
      comments,
      shares,
      interactions,
      followerBalance,
      followerGrowth,
    };
  });

  return {
    points,
    totals: {
      posts: sumKnown(points.map((point) => point.posts)),
      views: sumKnown(points.map((point) => point.views)),
      likes: sumKnown(points.map((point) => point.likes)),
      comments: sumKnown(points.map((point) => point.comments)),
      shares: sumKnown(points.map((point) => point.shares)),
      interactions: sumKnown(points.map((point) => point.interactions)),
    },
  };
}
