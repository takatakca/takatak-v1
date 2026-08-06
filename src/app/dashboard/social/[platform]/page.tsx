import Link from "next/link";
import { notFound } from "next/navigation";

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

type PlatformKey =
  keyof typeof SOCIAL_PLATFORMS;

export default async function SocialPlatformPage({
  params,
  searchParams,
}: {
  params: Promise<{
    platform: string;
  }>;
  searchParams: Promise<{
    accountId?: string;
  }>;
}) {
  const { platform } = await params;

  const { accountId } =
    await searchParams;

  const configuration =
    SOCIAL_PLATFORMS[
      platform as PlatformKey
    ];

  if (!configuration) {
    notFound();
  }

  const connectionHref =
    `/dashboard/social/${encodeURIComponent(
      platform,
    )}?connections=open`;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">
          Analytics
        </p>

        <h1 className="mt-1 text-3xl font-semibold text-slate-950">
          {configuration.name}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {configuration.description}
        </p>
      </header>

      <section className="rounded-2xl border border-[#b8c1ff] bg-[#f0f1ff] px-6 py-7">
        <h2 className="text-xl font-semibold text-slate-950">
          {accountId
            ? `${configuration.name} account`
            : `Connect your ${configuration.name} account`}
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {accountId
            ? "This page will display real analytics after the provider account has completed a successful synchronization. No sample analytics are being shown."
            : "Authorize and import a real provider account before analytics can be displayed."}
        </p>

        <Link
          href={connectionHref}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#4934d4] px-5 text-sm font-semibold text-white transition hover:bg-[#3e2bc0]"
        >
          {accountId
            ? "Manage connection"
            : `Connect ${configuration.name}`}
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-7">
        <h2 className="text-lg font-semibold text-slate-950">
          Analytics unavailable
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          TAKATAK will populate this page only
          with real information received from
          the official provider API.
        </p>
      </section>
    </div>
  );
}