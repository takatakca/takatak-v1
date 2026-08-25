import type {
  SocialAdPlatformKey,
  SocialPlatformKey,
} from "@/components/social/analytics/social-summary-tokens";

export type SocialSummaryData = {
  activeBrandId: string | null;
  activeBrandName: string | null;
  hasConnectedAccounts: boolean;
  dataUnavailable: boolean;

  accounts: Array<{
    id: string;
    platform: SocialPlatformKey;
    displayName: string | null;
    handle: string | null;
  }>;

  accountDaily: Array<{
    date: string;
    platform: SocialPlatformKey;
    followers: number;
    impressions: number;
    reach: number;
    engagement: number;
    clicks: number;
  }>;

  posts: Array<{
    id: string;
    platform: SocialPlatformKey;
    caption: string;
    status: string;
    scheduledAt: string | null;
    publishedAt: string | null;
    createdAt: string;
  }>;

  adAccounts: Array<{
    id: string;
    platform: SocialAdPlatformKey;
    displayName: string | null;
    externalAccountId: string;
    currency: string;
  }>;

  adDaily: Array<{
    date: string;
    platform: SocialAdPlatformKey;
    impressions: number;
    clicks: number;
    spendMinor: number;
    currency: string;
  }>;
};
