import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FacebookConnectPage } from "@/components/social/platforms/facebook-connect-page";
import {
  InstagramConnectPage,
  ThreadsConnectPage,
} from "@/components/social/platforms/instagram-connect-page";
import { TikTokConnectPage } from "@/components/social/platforms/tiktok-connect-page";
import { YoutubeConnectPage } from "@/components/social/platforms/youtube-connect-page";
import { XConnectPage } from "@/components/social/platforms/x-connect-page";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { resolveCanonicalFacebookDashboard } from "@/lib/social/connections/facebook-dashboard-resolve";
import { resolveCanonicalInstagramDashboard } from "@/lib/social/connections/instagram-dashboard-resolve";
import { resolveCanonicalThreadsDashboard } from "@/lib/social/connections/threads-dashboard-resolve";
import { resolveCanonicalTikTokDashboard } from "@/lib/social/connections/tiktok-dashboard-resolve";
import { resolveCanonicalYoutubeDashboard } from "@/lib/social/connections/youtube-dashboard-resolve";
import { resolveCanonicalXDashboard } from "@/lib/social/connections/x-dashboard-resolve";
import { toAccountPictureSrc } from "@/lib/social/media/remote-image";
import { getSelectedFacebookPageSyncSnapshot } from "@/lib/social/sync/facebook-page-initial-sync";

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
        profileImageUrl = toAccountPictureSrc(tiktok.socialAccountId);
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
        connectedLabel={connectedLabel}
        profileImageUrl={profileImageUrl}
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
