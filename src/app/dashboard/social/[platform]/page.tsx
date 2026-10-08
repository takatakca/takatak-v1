import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FacebookConnectPage } from "@/components/social/platforms/facebook-connect-page";
import { GoogleBusinessConnectPage } from "@/components/social/platforms/google-business-connect-page";
import {
  InstagramConnectPage,
  ThreadsConnectPage,
} from "@/components/social/platforms/instagram-connect-page";
import { TikTokConnectPage } from "@/components/social/platforms/tiktok-connect-page";
import { YoutubeConnectPage } from "@/components/social/platforms/youtube-connect-page";
import { BlogConnectPage } from "@/components/social/platforms/blog-connect-page";
import { WebConnectPage } from "@/components/social/platforms/web-connect-page";
import { GoogleAdsConnectPage } from "@/components/social/platforms/google-ads-connect-page";
import { LookerStudioConnectPage } from "@/components/social/platforms/looker-studio-connect-page";
import { MetaAdsConnectPage } from "@/components/social/platforms/meta-ads-connect-page";
import { BlueskySubscribedDashboard } from "@/components/social/platforms/bluesky-subscribed-dashboard";
import { TwitchConnectPage } from "@/components/social/platforms/twitch-connect-page";
import { XConnectPage } from "@/components/social/platforms/x-connect-page";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { resolveCanonicalFacebookDashboard } from "@/lib/social/connections/facebook-dashboard-resolve";
import { resolveCanonicalGoogleBusinessDashboard } from "@/lib/social/connections/google-business-dashboard-resolve";
import { resolveCanonicalInstagramDashboard } from "@/lib/social/connections/instagram-dashboard-resolve";
import { resolveCanonicalThreadsDashboard } from "@/lib/social/connections/threads-dashboard-resolve";
import { resolveCanonicalTikTokDashboard } from "@/lib/social/connections/tiktok-dashboard-resolve";
import { resolveCanonicalYoutubeDashboard } from "@/lib/social/connections/youtube-dashboard-resolve";
import { resolveCanonicalBlogDashboard } from "@/lib/social/connections/blog-dashboard-resolve";
import { resolveCanonicalWebDashboard } from "@/lib/social/connections/web-dashboard-resolve";
import { resolveCanonicalGoogleAdsDashboard } from "@/lib/social/connections/google-ads-dashboard-resolve";
import { resolveCanonicalLookerStudioDashboard } from "@/lib/social/connections/looker-studio-dashboard-resolve";
import { resolveCanonicalMetaAdsDashboard } from "@/lib/social/connections/meta-ads-dashboard-resolve";
import { resolveCanonicalBlueskyDashboard } from "@/lib/social/connections/bluesky-dashboard-resolve";
import { resolveCanonicalTwitchDashboard } from "@/lib/social/connections/twitch-dashboard-resolve";
import { resolveCanonicalXDashboard } from "@/lib/social/connections/x-dashboard-resolve";
import {
  toAccountPictureSrc,
  toClientSocialImageUrl,
} from "@/lib/social/media/remote-image";
import { getSelectedFacebookPageSyncSnapshot } from "@/lib/social/sync/facebook-page-initial-sync";
import { hasSocialHistory } from "@/lib/social/social-history";

const SOCIAL_PLATFORMS = {
  instagram: {
    name: "Instagram",
    description:
      "Understand your Instagram audience, content performance, reach and engagement.",
  },
  facebook: {
    name: "Facebook",
    description:
      "Review Facebook Page activity, audience growth, content performance and engagement.",
  },
  tiktok: {
    name: "TikTok",
    description:
      "Analyze TikTok videos, audience development, views and engagement.",
  },
  youtube: {
    name: "YouTube",
    description:
      "Measure YouTube channel growth, video performance and audience activity.",
  },
  linkedin: {
    name: "LinkedIn",
    description:
      "Understand your LinkedIn audience, company activity and content performance.",
  },
  threads: {
    name: "Threads",
    description:
      "Review Threads account activity, audience growth and content performance.",
  },
  x: {
    name: "X",
    description:
      "Analyze X account activity, audience growth and post performance.",
  },
  bluesky: {
    name: "Bluesky",
    description:
      "Review Bluesky audience development and post activity.",
  },
  pinterest: {
    name: "Pinterest",
    description:
      "Analyze Pinterest profile, board and pin performance.",
  },
  twitch: {
    name: "Twitch",
    description:
      "Review Twitch channel growth, streams and audience activity.",
  },
  google_business: {
    name: "Google Business Profile",
    description:
      "Review business-profile visibility, interactions and customer activity.",
  },
  web: {
    name: "Web",
    description:
      "Connect a public website and confirm it with a homepage verification tag.",
  },
  blog: {
    name: "Blog",
    description:
      "Create a TAKATAK blog page for a website that is already connected.",
  },
  meta_ads: {
    name: "Meta Ads",
    description:
      "Connect a Meta ad account and review the account chosen for this brand.",
  },
  google_ads: {
    name: "Google Ads",
    description:
      "Connect a Google Ads account and review the account chosen for this brand.",
  },
  looker_studio: {
    name: "Looker Studio",
    description:
      "Connect a Looker Studio report and open it for this brand.",
  },
} as const;

type PlatformKey = keyof typeof SOCIAL_PLATFORMS;

export default async function SocialPlatformPage({
  params,
  searchParams,
}: {
  params: Promise<{
    platform: string;
  }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { platform } = await params;

  if (platform === "users") {
    redirect("/dashboard/social/users");
  }

  if (platform === "settings") {
    const query = await searchParams;
    const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
    redirect(
      tab
        ? `/dashboard/profile?tab=${encodeURIComponent(tab)}`
        : "/dashboard/profile",
    );
  }

  if (platform === "brands") {
    redirect("/dashboard/social/brands/settings");
  }

  const configuration =
    SOCIAL_PLATFORMS[platform as PlatformKey];

  if (!configuration) {
    notFound();
  }

  if (platform === "instagram") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/instagram",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);
    const hasPreviousSocialHistory = await hasSocialHistory({
      clientId: access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    let isConnected = false;
    let connectedLabel: string | null = null;
    let profileImageUrl: string | null = null;
    let resolutionIssue: "ambiguous" | "missing" | null = null;
    let connectedVia: "instagram_login" | "facebook_page" | null = null;
    let facebookConnectionId: string | null = null;
    let facebookPageSelected = false;
    let facebookNeedsPage = false;

    try {
      const facebook = await resolveCanonicalFacebookDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (facebook.kind === "ready") {
        facebookPageSelected = true;
        facebookConnectionId = facebook.connectionId;
      } else if (facebook.kind === "missing" && brand.activeBrandId) {
        const { getPrisma } = await import("@/lib/db/prisma");
        const prisma = getPrisma();
        const authorized = prisma
          ? await prisma.socialProviderConnection.findFirst({
              where: {
                clientId: access.activeClientId,
                businessBrandId: brand.activeBrandId,
                provider: "meta",
                status: "authorized",
              },
              select: { id: true },
            })
          : null;
        facebookNeedsPage = Boolean(authorized);
      }

      const instagram = await resolveCanonicalInstagramDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (instagram.kind === "ambiguous") {
        resolutionIssue = "ambiguous";
      } else if (instagram.kind === "ready") {
        isConnected = true;
        connectedLabel = instagram.accountName;
        profileImageUrl = toAccountPictureSrc(instagram.socialAccountId);
        connectedVia = instagram.source;
      }
    } catch (error) {
      console.error(
        "[social-instagram] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <InstagramConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(
          access,
          "manage_social_accounts",
        )}
        isConnected={isConnected}
        hasSocialHistory={hasPreviousSocialHistory}
        connectedLabel={connectedLabel}
        profileImageUrl={profileImageUrl}
        resolutionIssue={resolutionIssue}
        connectedVia={connectedVia}
        facebookConnectionId={facebookConnectionId}
        facebookPageSelected={facebookPageSelected}
        facebookNeedsPage={facebookNeedsPage}
      />
    );
  }

  if (platform === "threads") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/threads",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);
    const hasPreviousSocialHistory = await hasSocialHistory({
      clientId: access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    let isConnected = false;
    let connectedLabel: string | null = null;
    let profileImageUrl: string | null = null;
    let resolutionIssue: "ambiguous" | "missing" | null = null;
    let connectedVia: "threads_login" | "facebook_page" | null = null;
    let facebookConnectionId: string | null = null;
    let facebookPageSelected = false;
    let facebookNeedsPage = false;
    let instagramLinkedViaFacebook = false;

    try {
      const facebook = await resolveCanonicalFacebookDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (facebook.kind === "ready") {
        facebookPageSelected = true;
        facebookConnectionId = facebook.connectionId;
      } else if (facebook.kind === "missing" && brand.activeBrandId) {
        const { getPrisma } = await import("@/lib/db/prisma");
        const prisma = getPrisma();
        const authorized = prisma
          ? await prisma.socialProviderConnection.findFirst({
              where: {
                clientId: access.activeClientId,
                businessBrandId: brand.activeBrandId,
                provider: "meta",
                status: "authorized",
              },
              select: { id: true },
            })
          : null;
        facebookNeedsPage = Boolean(authorized);
      }

      const instagram = await resolveCanonicalInstagramDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });
      instagramLinkedViaFacebook =
        instagram.kind === "ready" && instagram.source === "facebook_page";

      const threads = await resolveCanonicalThreadsDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (threads.kind === "ambiguous") {
        resolutionIssue = "ambiguous";
      } else if (threads.kind === "ready") {
        isConnected = true;
        connectedLabel = threads.accountName;
        profileImageUrl = toAccountPictureSrc(threads.socialAccountId);
        connectedVia = threads.source;
      }
    } catch (error) {
      console.error(
        "[social-threads] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <ThreadsConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(
          access,
          "manage_social_accounts",
        )}
        isConnected={isConnected}
        hasSocialHistory={hasPreviousSocialHistory}
        connectedLabel={connectedLabel}
        profileImageUrl={profileImageUrl}
        resolutionIssue={resolutionIssue}
        connectedVia={connectedVia}
        facebookConnectionId={facebookConnectionId}
        facebookPageSelected={facebookPageSelected}
        facebookNeedsPage={facebookNeedsPage}
        instagramLinkedViaFacebook={instagramLinkedViaFacebook}
      />
    );
  }

  if (platform === "facebook") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/facebook",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);
    const hasPreviousSocialHistory = await hasSocialHistory({
      clientId: access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    let isConnected = false;
    let connectedLabel: string | null = null;
    let profileImageUrl: string | null = null;
    let resolutionIssue: "ambiguous" | "missing" | null = null;
    let syncStatus:
      | "idle"
      | "syncing"
      | "ready"
      | "empty"
      | "degraded"
      | "action_required"
      | "failed"
      | null = null;

    try {
      const resolved = await resolveCanonicalFacebookDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (resolved.kind === "ambiguous") {
        resolutionIssue = "ambiguous";
      } else if (resolved.kind === "ready") {
        isConnected = true;
        connectedLabel = resolved.pageName;
        profileImageUrl = resolved.profileImageUrl;

        if (brand.activeBrandId) {
          const sync = await getSelectedFacebookPageSyncSnapshot({
            clientId: access.activeClientId,
            businessBrandId: brand.activeBrandId,
          });
          syncStatus = sync?.status ?? "idle";
        }
      }
    } catch (error) {
      console.error(
        "[social-facebook] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <FacebookConnectPage
        activeBrandId={brand.activeBrandId}
        activeBrandName={brand.activeBrandName}
        canManage={hasEffectivePermission(
          access,
          "manage_social_accounts",
        )}
        isConnected={isConnected}
        hasSocialHistory={hasPreviousSocialHistory}
        connectedLabel={connectedLabel}
        profileImageUrl={profileImageUrl}
        initialSyncStatus={syncStatus}
        resolutionIssue={resolutionIssue}
      />
    );
  }

  if (platform === "youtube") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/youtube",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);
    const hasPreviousSocialHistory = await hasSocialHistory({
      clientId: access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    let isConnected = false;
    let connectedLabel: string | null = null;
    let profileImageUrl: string | null = null;
    let resolutionIssue: "ambiguous" | "missing" | null = null;
    let needsSelectionConnectionId: string | null = null;

    try {
      const youtube = await resolveCanonicalYoutubeDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (youtube.kind === "ambiguous") {
        resolutionIssue = "ambiguous";
      } else if (youtube.kind === "ready") {
        isConnected = true;
        connectedLabel = youtube.accountName;
        profileImageUrl = youtube.profileImageUrl;
      } else if (youtube.kind === "needs_selection") {
        needsSelectionConnectionId = youtube.connectionId;
      }
    } catch (error) {
      console.error(
        "[social-youtube] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <YoutubeConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(
          access,
          "manage_social_accounts",
        )}
        isConnected={isConnected}
        hasSocialHistory={hasPreviousSocialHistory}
        connectedLabel={connectedLabel}
        profileImageUrl={profileImageUrl}
        resolutionIssue={resolutionIssue}
        needsSelectionConnectionId={needsSelectionConnectionId}
      />
    );
  }

  if (platform === "tiktok") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/tiktok",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);
    const hasPreviousSocialHistory = await hasSocialHistory({
      clientId: access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    let isConnected = false;
    let connectedLabel: string | null = null;
    let profileImageUrl: string | null = null;
    let resolutionIssue: "ambiguous" | "missing" | null = null;

    try {
      const tiktok = await resolveCanonicalTikTokDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (tiktok.kind === "ambiguous") {
        resolutionIssue = "ambiguous";
      } else if (tiktok.kind === "ready") {
        isConnected = true;
        connectedLabel = tiktok.accountName;
        profileImageUrl = toClientSocialImageUrl(tiktok.profileImageUrl);
      }
    } catch (error) {
      console.error(
        "[social-tiktok] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <TikTokConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(
          access,
          "manage_social_accounts",
        )}
        isConnected={isConnected}
        hasSocialHistory={hasPreviousSocialHistory}
        connectedLabel={connectedLabel}
        profileImageUrl={profileImageUrl}
        resolutionIssue={resolutionIssue}
      />
    );
  }

  if (platform === "google_business") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/google_business",
    );

    const brand =
      await resolveBrandSessionContextFromRequest(
        access,
      );

    let isConnected = false;
    let accountName: string | null = null;
    let profileImageUrl: string | null = null;
    let resolutionIssue:
      | "ambiguous"
      | "missing"
      | null = null;

    try {
      const googleBusiness =
        await resolveCanonicalGoogleBusinessDashboard({
          clientId: access.activeClientId,
          businessBrandId: brand.activeBrandId,
        });

      if (googleBusiness.kind === "ambiguous") {
        resolutionIssue = "ambiguous";
      } else if (googleBusiness.kind === "ready") {
        isConnected = true;
        accountName = googleBusiness.accountName;
        profileImageUrl = toAccountPictureSrc(googleBusiness.socialAccountId);
      }
    } catch (error) {
      console.error(
        "[social-google-business] Connection status could not be loaded:",
        error instanceof Error
          ? error.message
          : "Unknown error",
      );
    }

    return (
      <GoogleBusinessConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(
          access,
          "manage_social_accounts",
        )}
        isConnected={isConnected}
        accountName={accountName}
        profileImageUrl={profileImageUrl}
        resolutionIssue={resolutionIssue}
      />
    );
  }

  if (platform === "blog") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/blog",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);

    let isConnected = false;
    let siteUrl: string | null = null;
    let blogUrl: string | null = null;
    let accountName: string | null = null;
    let needsWebsite = false;
    let resolutionIssue: "ambiguous" | "missing" | null = null;

    try {
      const blogAccount = await resolveCanonicalBlogDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (blogAccount.kind === "ambiguous") {
        resolutionIssue = "ambiguous";
      } else if (blogAccount.kind === "needs_website") {
        needsWebsite = true;
      } else if (blogAccount.kind === "ready") {
        isConnected = true;
        siteUrl = blogAccount.siteUrl;
        blogUrl = blogAccount.blogUrl;
        accountName = blogAccount.accountName;
      }
    } catch (error) {
      console.error(
        "[social-blog] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <BlogConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(access, "manage_social_accounts")}
        isConnected={isConnected}
        siteUrl={siteUrl}
        blogUrl={blogUrl}
        accountName={accountName}
        needsWebsite={needsWebsite}
        resolutionIssue={resolutionIssue}
      />
    );
  }

  if (platform === "web") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/web",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);

    let isConnected = false;
    let siteUrl: string | null = null;
    let accountName: string | null = null;
    let resolutionIssue: "ambiguous" | "missing" | null = null;

    try {
      const website = await resolveCanonicalWebDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (website.kind === "ambiguous") {
        resolutionIssue = "ambiguous";
      } else if (website.kind === "ready") {
        isConnected = true;
        siteUrl = website.siteUrl;
        accountName = website.accountName;
      }
    } catch (error) {
      console.error(
        "[social-web] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <WebConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(
          access,
          "manage_social_accounts",
        )}
        isConnected={isConnected}
        siteUrl={siteUrl}
        accountName={accountName}
        resolutionIssue={resolutionIssue}
      />
    );
  }

  if (platform === "x") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/x",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);
    const hasPreviousSocialHistory = await hasSocialHistory({
      clientId: access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    let isConnected = false;
    let connectedLabel: string | null = null;
    let profileImageUrl: string | null = null;
    let resolutionIssue: "ambiguous" | "missing" | null = null;

    try {
      const xAccount = await resolveCanonicalXDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (xAccount.kind === "ambiguous") {
        resolutionIssue = "ambiguous";
      } else if (xAccount.kind === "ready") {
        isConnected = true;
        connectedLabel = xAccount.accountName;
        profileImageUrl = toAccountPictureSrc(xAccount.socialAccountId);
      }
    } catch (error) {
      console.error(
        "[social-x] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <XConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(
          access,
          "manage_social_accounts",
        )}
        isConnected={isConnected}
        hasSocialHistory={hasPreviousSocialHistory}
        connectedLabel={connectedLabel}
        profileImageUrl={profileImageUrl}
        resolutionIssue={resolutionIssue}
      />
    );
  }

  if (platform === "meta_ads") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/meta_ads",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);

    let state: "connect" | "choose" | "empty" | "ready" | "ambiguous" =
      "connect";
    let connectionId: string | null = null;
    let connectedLabel: string | null = null;
    let currency: string | null = null;
    let choices: { id: string; displayName: string; currency: string }[] = [];

    try {
      const metaAds = await resolveCanonicalMetaAdsDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (metaAds.kind === "ambiguous") {
        state = "ambiguous";
      } else if (metaAds.kind === "ready") {
        state = "ready";
        connectionId = metaAds.connectionId;
        connectedLabel = metaAds.accountName;
        currency = metaAds.currency;
      } else if (metaAds.kind === "choose") {
        state = "choose";
        connectionId = metaAds.connectionId;
        choices = metaAds.accounts;
      } else if (metaAds.kind === "empty") {
        state = "empty";
        connectionId = metaAds.connectionId;
      }
    } catch (error) {
      console.error(
        "[social-meta-ads] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <MetaAdsConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(access, "manage_social_accounts")}
        connectionId={connectionId}
        state={state}
        connectedLabel={connectedLabel}
        currency={currency}
        choices={choices}
      />
    );
  }

  if (platform === "google_ads") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/google_ads",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);

    let state: "connect" | "choose" | "empty" | "ready" | "ambiguous" =
      "connect";
    let connectionId: string | null = null;
    let connectedLabel: string | null = null;
    let currency: string | null = null;
    let choices: { id: string; displayName: string; currency: string }[] = [];

    try {
      const googleAds = await resolveCanonicalGoogleAdsDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (googleAds.kind === "ambiguous") {
        state = "ambiguous";
      } else if (googleAds.kind === "ready") {
        state = "ready";
        connectionId = googleAds.connectionId;
        connectedLabel = googleAds.accountName;
        currency = googleAds.currency;
      } else if (googleAds.kind === "choose") {
        state = "choose";
        connectionId = googleAds.connectionId;
        choices = googleAds.accounts;
      } else if (googleAds.kind === "empty") {
        state = "empty";
        connectionId = googleAds.connectionId;
      }
    } catch (error) {
      console.error(
        "[social-google-ads] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <GoogleAdsConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(access, "manage_social_accounts")}
        connectionId={connectionId}
        state={state}
        connectedLabel={connectedLabel}
        currency={currency}
        choices={choices}
      />
    );
  }

  if (platform === "looker_studio") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/looker_studio",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);
    const hasPreviousSocialHistory = await hasSocialHistory({
      clientId: access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    let state: "connect" | "choose" | "empty" | "ready" | "ambiguous" =
      "connect";
    let connectionId: string | null = null;
    let connectedLabel: string | null = null;
    let owner: string | null = null;
    let reportUrl: string | null = null;
    let choices: { id: string; displayName: string; owner: string }[] = [];

    try {
      const looker = await resolveCanonicalLookerStudioDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (looker.kind === "ambiguous") {
        state = "ambiguous";
      } else if (looker.kind === "ready") {
        state = "ready";
        connectionId = looker.connectionId;
        connectedLabel = looker.accountName;
        owner = looker.owner;
        reportUrl = looker.reportUrl;
      } else if (looker.kind === "choose") {
        state = "choose";
        connectionId = looker.connectionId;
        choices = looker.reports;
      } else if (looker.kind === "empty") {
        state = "empty";
        connectionId = looker.connectionId;
        connectedLabel = looker.accountName;
      }
    } catch (error) {
      console.error(
        "[social-looker-studio] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <LookerStudioConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(access, "manage_social_accounts")}
        connectionId={connectionId}
        state={state}
        hasSocialHistory={hasPreviousSocialHistory}
        connectedLabel={connectedLabel}
        owner={owner}
        reportUrl={reportUrl}
        choices={choices}
      />
    );
  }

  if (platform === "bluesky") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/bluesky",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);

    let handle: string | null = null;
    let profileImageUrl: string | null = null;
    try {
      const bluesky = await resolveCanonicalBlueskyDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });
      if (bluesky.kind === "ready") {
        handle = bluesky.handle;
        profileImageUrl = toAccountPictureSrc(bluesky.socialAccountId);
      }
    } catch (error) {
      console.error(
        "[social-bluesky] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    if (handle) {
      return (
        <BlueskySubscribedDashboard handle={handle} imageUrl={profileImageUrl} />
      );
    }
  }

  if (platform === "twitch") {
    const access = await requireWorkspacePermission(
      "view_social",
      "/dashboard/social/twitch",
    );
    const brand = await resolveBrandSessionContextFromRequest(access);
    const hasPreviousSocialHistory = await hasSocialHistory({
      clientId: access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    let isConnected = false;
    let connectedLabel: string | null = null;
    let profileImageUrl: string | null = null;
    let resolutionIssue: "ambiguous" | "missing" | null = null;

    try {
      const twitchAccount = await resolveCanonicalTwitchDashboard({
        clientId: access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (twitchAccount.kind === "ambiguous") {
        resolutionIssue = "ambiguous";
      } else if (twitchAccount.kind === "ready") {
        isConnected = true;
        connectedLabel = twitchAccount.accountName;
        profileImageUrl = toClientSocialImageUrl(twitchAccount.profileImageUrl);
      }
    } catch (error) {
      console.error(
        "[social-twitch] Connection status could not be loaded:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    return (
      <TwitchConnectPage
        activeBrandId={brand.activeBrandId}
        canManage={hasEffectivePermission(
          access,
          "manage_social_accounts",
        )}
        isConnected={isConnected}
        hasSocialHistory={hasPreviousSocialHistory}
        connectedLabel={connectedLabel}
        profileImageUrl={profileImageUrl}
        resolutionIssue={resolutionIssue}
      />
    );
  }

  const connectionHref = `/dashboard/social/${encodeURIComponent(
    platform,
  )}?connections=open`;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">Analytics</p>

        <h1 className="mt-1 text-3xl font-semibold text-slate-950">
          {configuration.name}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {configuration.description}
        </p>
      </header>

      <section className="rounded-2xl border border-[#b8c1ff] bg-[#f0f1ff] px-6 py-7">
        <h2 className="text-xl font-semibold text-slate-950">
          {`Connect your ${configuration.name} account`}
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Authorize and import a real provider account before analytics can be
          displayed.
        </p>

        <Link
          href={connectionHref}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#4934d4] px-5 text-sm font-semibold text-white transition hover:bg-[#3e2bc0]"
        >
          {`Connect ${configuration.name}`}
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-7">
        <h2 className="text-lg font-semibold text-slate-950">
          Analytics unavailable
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          TAKATAK will populate this page only with real information received
          from the official provider API.
        </p>
      </section>
    </div>
  );
}
