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
};

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
