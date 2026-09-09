export type PlanningPost = {
  id: string;
  platform: string;
  caption: string;
  status: string;
  scheduledAt: string | null;
};

export type PlanningPageData = {
  posts: PlanningPost[];
  connectedPlatforms: string[];
  postsUsedThisMonth: number;
  monthlyPostAllowance: number | null;
};
