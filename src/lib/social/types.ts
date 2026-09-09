// Phase 5 — Social module view types (serializable, UI-facing).

export type DataSource = "database" | "mock" | "unavailable";

export interface SourceMeta {
  source: DataSource;
  sourceLabel: string;
}

export interface SocialAccountCard {
  id: string;
  platform: string;
  handle: string | null;
  displayName: string | null;
  status: string;
  brandName: string | null;
  lastSyncAt: string | null;
}

export interface CampaignSummary {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  brandName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  postCount: number;
}

export interface PostSummary {
  id: string;
  platform: string;
  captionPreview: string;
  status: string;
  campaignName: string | null;
  brandName: string | null;
  scheduledAt: string | null;
  approvalStatus: string | null;
}

export interface ApprovalSummary {
  id: string;
  status: string;
  comments: string | null;
  requestedAt: string;
  postCaptionPreview: string;
  postPlatform: string;
  brandName: string | null;
}

export interface CalendarItem {
  id: string;
  date: string | null; // scheduledAt or null → "Unscheduled" bucket
  platform: string;
  status: string;
  captionPreview: string;
  campaignName: string | null;
}

export interface AnalyticsSummary {
  hasData: boolean;
  source: string | null; // "internal_mock" | "metricool" | ... when present
  totals: { reach: number; impressions: number; engagement: number; clicks: number; followers: number };
  days: number;
}

export interface SocialKpis {
  socialAccounts: number;
  campaigns: number;
  draftPosts: number;
  pendingApprovals: number;
  approvedPosts: number;
}

export interface PostPipeline {
  draft: number;
  pending_approval: number;
  approved: number;
  scheduled: number;
  published: number;
  failed: number;
  blocked_by_plan: number;
}

export interface SocialOverviewData extends SourceMeta {
  kpis: SocialKpis;
  accounts: SocialAccountCard[];
  campaigns: CampaignSummary[];
  pipeline: PostPipeline;
  pendingApprovals: ApprovalSummary[];
}
