"use client";

import {
  BarChart3,
  CalendarDays,
  Eye,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { SocialSummaryAdsTab } from "@/components/social/analytics/social-summary-ads-tab";
import { MetricSection } from "@/components/social/analytics/social-summary-metric-section";
import { SocialSummaryPostsTab } from "@/components/social/analytics/social-summary-posts-tab";
import type { SocialSummaryData } from "@/components/social/analytics/social-summary-types";
import {
  FOLLOWER_PLATFORM_ORDER,
  IMPRESSION_PLATFORM_ORDER,
  PLATFORM_CARD_COLORS,
  PLATFORM_NAMES,
  SUMMARY_PAGE_BG,
  dateKey,
  displayDate,
  enumerateDates,
  metricValue,
  type SocialPlatformKey,
} from "@/components/social/analytics/social-summary-tokens";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";

export type {
  SocialAdPlatformKey,
  SocialPlatformKey,
} from "@/components/social/analytics/social-summary-tokens";

export type { SocialSummaryData } from "@/components/social/analytics/social-summary-types";

const RANGES = [30, 90, 180, 365] as const;

function EducationCard({
  title,
  description,
  image,
  imageAlt,
  icon: Icon,
}: {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  icon: LucideIcon;
}) {
  return (
    <article className="flex min-h-[440px] flex-col overflow-hidden bg-white px-8 pt-9">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <h2 className="text-[20px] font-medium leading-7 text-[#30343a]">
            {title}
          </h2>

          <p className="mt-2 max-w-[370px] text-[15px] leading-6 text-[#68717a]">
            {description}
          </p>
        </div>

        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#efeeff] text-[#292531]">
          <Icon className="h-[27px] w-[27px]" strokeWidth={1.65} />
        </span>
      </div>

      <div className="relative mt-auto h-[300px] w-full">
        <Image
          src={image}
          alt={imageAlt}
          fill
          priority
          sizes="(min-width: 1280px) 30vw, (min-width: 1024px) 33vw, 100vw"
          className="object-contain object-bottom"
        />
      </div>
    </article>
  );
}

function NewUserView() {
  const searchParams = useSearchParams();

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-6 rounded-[18px] border border-[#a8b4ff] bg-[#ebeaff] px-7 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
            Understand what works and make data-driven decisions
          </h2>

          <p className="mt-2 text-[15px] leading-6 text-[#505761]">
            Analyze your community, the reach of your posts and your ad campaigns
            from a single dashboard.
          </p>
        </div>

        <Link
          href={withSocialPreview(
            "/dashboard/social?connections=open",
            searchParams,
          )}
          className="inline-flex h-[50px] shrink-0 items-center justify-center rounded-[10px] bg-[#2c1929] px-7 text-[15px] font-semibold text-[#ddff35] transition hover:bg-[#3b2237]"
        >
          Connect social networks
        </Link>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-[#e1e4e7] bg-white">
        <div className="grid lg:grid-cols-3 lg:divide-x lg:divide-[#e1e4e7]">
          <EducationCard
            title="How your community grows"
            description="Track the evolution of your followers across all your networks from one place."
            image="/social/summary/community-growth.webp"
            imageAlt="Community growth analytics"
            icon={UsersRound}
          />

          <EducationCard
            title="The real reach of your posts"
            description="Discover the reach of your posts on each network and which content performs best."
            image="/social/summary/post-reach-bg.webp"
            imageAlt="Post reach analytics"
            icon={Eye}
          />

          <EducationCard
            title="Your ad campaigns, at a glance"
            description="Analyze the performance of your ads across all platforms without switching screens."
            image="/social/summary/ad-campaigns.webp"
            imageAlt="Advertising campaign analytics"
            icon={Target}
          />
        </div>
      </section>

      <section className="relative min-h-[245px] overflow-hidden rounded-[18px] border border-[#e1e4e7] bg-white px-8 py-9">
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-[21px] font-medium leading-7 text-[#30343a]">
            Connect social networks
          </h2>

          <p className="mt-4 text-[15px] leading-6 text-[#68717a]">
            Connect your accounts to unlock analytics, scheduling and content
            management.
          </p>

          <Link
            href={withSocialPreview(
              "/dashboard/social?connections=open",
              searchParams,
            )}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-[10px] border border-[#493546] bg-white px-7 text-[15px] font-medium text-[#342431] transition hover:bg-[#f8f8f8]"
          >
            Connect social networks
          </Link>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[278px] right-[-80px] h-[470px] w-[700px] rounded-[50%]"
          style={{
            background:
              "repeating-conic-gradient(from 202deg, #d9f5ff 0deg 2.5deg, transparent 2.5deg 6.5deg)",
            WebkitMask:
              "radial-gradient(ellipse at center, transparent 0 58%, #000 59% 67%, transparent 68%)",
            mask: "radial-gradient(ellipse at center, transparent 0 58%, #000 59% 67%, transparent 68%)",
          }}
        />
      </section>
    </div>
  );
}

function resolvePlatforms(
  preferred: SocialPlatformKey[],
  connected: SocialPlatformKey[],
  observed: SocialPlatformKey[],
): SocialPlatformKey[] {
  const present = new Set<SocialPlatformKey>([...connected, ...observed]);
  const extras = [...present].filter(
    (platform) => !preferred.includes(platform),
  );

  // Always keep Metricool summary card order, then any extra connected platforms.
  return [...preferred, ...extras];
}

function AccountSection({
  data,
  start,
  end,
}: {
  data: SocialSummaryData;
  start: string;
  end: string;
}) {
  const accountRows = data.accountDaily.filter(
    (row) => row.date >= start && row.date <= end,
  );

  const connected = data.accounts.map((account) => account.platform);
  const observed = accountRows.map((row) => row.platform);

  const followerPlatforms = resolvePlatforms(
    FOLLOWER_PLATFORM_ORDER,
    connected,
    observed,
  );

  const impressionPlatforms = resolvePlatforms(
    IMPRESSION_PLATFORM_ORDER,
    connected,
    observed,
  );

  const latestFollowersByPlatform = (() => {
    const map = new Map<SocialPlatformKey, number>();
    const sorted = [...accountRows].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    for (const row of sorted) {
      map.set(row.platform, row.followers);
    }

    return map;
  })();

  const impressionsByPlatform = (() => {
    const map = new Map<SocialPlatformKey, number>();

    for (const row of accountRows) {
      map.set(
        row.platform,
        (map.get(row.platform) ?? 0) + row.impressions,
      );
    }

    return map;
  })();

  const followerTotal = metricValue(
    followerPlatforms.reduce(
      (total, platform) =>
        total + (latestFollowersByPlatform.get(platform) ?? 0),
      0,
    ),
  );

  const impressionsTotal = metricValue(
    impressionPlatforms.reduce(
      (total, platform) =>
        total + (impressionsByPlatform.get(platform) ?? 0),
      0,
    ),
  );

  const dates = enumerateDates(start, end);

  function dailyMetric(
    field: "followers" | "impressions",
    platform?: SocialPlatformKey | null,
  ) {
    return dates.map((date) => {
      const dayRows = accountRows.filter((row) => {
        if (row.date !== date) return false;
        if (platform) return row.platform === platform;
        return true;
      });

      if (field === "followers") {
        const byPlatform = new Map<SocialPlatformKey, number>();
        for (const row of dayRows) {
          byPlatform.set(row.platform, row.followers);
        }

        if (platform) {
          return {
            date,
            value: metricValue(byPlatform.get(platform) ?? 0),
          };
        }

        return {
          date,
          value: metricValue(
            followerPlatforms.reduce(
              (total, key) => total + (byPlatform.get(key) ?? 0),
              0,
            ),
          ),
        };
      }

      return {
        date,
        value: metricValue(
          dayRows.reduce((total, row) => total + row.impressions, 0),
        ),
      };
    });
  }

  return (
    <section
      id="summary-account"
      className="scroll-mt-[150px] rounded-[14px] bg-white px-6 py-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8 sm:py-8"
    >
      <h2 className="mb-5 text-[22px] font-semibold text-[#20242A]">Account</h2>

      <div className="space-y-10">
        <MetricSection
          title="Followers"
          total={followerTotal}
          accent="linear-gradient(180deg,#F06A6A 0%,#566DF1 55%,#E4A934 100%)"
          cards={followerPlatforms.map((platform) => ({
            key: platform,
            label: PLATFORM_NAMES[platform],
            color: PLATFORM_CARD_COLORS[platform],
            value: metricValue(latestFollowersByPlatform.get(platform) ?? 0),
          }))}
          points={(platformKey) =>
            dailyMetric("followers", platformKey as SocialPlatformKey | null)
          }
          seriesLabel="Followers"
          showMarkers
        />

        <MetricSection
          title="Impressions"
          total={impressionsTotal}
          cards={impressionPlatforms.map((platform) => ({
            key: platform,
            label: PLATFORM_NAMES[platform],
            color: PLATFORM_CARD_COLORS[platform],
            value: metricValue(impressionsByPlatform.get(platform) ?? 0),
          }))}
          points={(platformKey) =>
            dailyMetric(
              "impressions",
              platformKey as SocialPlatformKey | null,
            )
          }
          seriesLabel="Impressions"
          showMarkers
        />
      </div>
    </section>
  );
}

function SubscribedView({
  data,
  start,
  end,
}: {
  data: SocialSummaryData;
  start: string;
  end: string;
}) {
  return (
    <div className="space-y-8">
      <AccountSection data={data} start={start} end={end} />

      <section
        id="summary-posts"
        className="scroll-mt-[150px] rounded-[14px] bg-white px-6 py-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8 sm:py-8"
      >
        <SocialSummaryPostsTab
          data={data}
          start={start}
          end={end}
        />
      </section>

      <section
        id="summary-ad-accounts"
        className="scroll-mt-[150px] rounded-[14px] bg-white px-6 py-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8 sm:py-8"
      >
        <SocialSummaryAdsTab data={data} start={start} end={end} />
      </section>
    </div>
  );
}

export function SocialSummaryDashboard({
  data,
}: {
  data: SocialSummaryData;
}) {
  const searchParams = useSearchParams();
  const [range, setRange] = useState<number>(30);
  const [activeSection, setActiveSection] = useState<
    "account" | "posts" | "ads"
  >("account");

  const preview = searchParams.get("preview");
  const newPreview = preview === "new";
  const subscribedPreview = preview === "subscribed";
  const previewing = newPreview || subscribedPreview;

  const newUser =
    newPreview || (!subscribedPreview && !data.hasConnectedAccounts);

  const { start, end } = useMemo(() => {
    const endDate = new Date();
    endDate.setUTCHours(12, 0, 0, 0);

    const startDate = new Date(endDate);
    startDate.setUTCDate(endDate.getUTCDate() - range + 1);

    return {
      start: dateKey(startDate),
      end: dateKey(endDate),
    };
  }, [range]);

  function scrollToSection(id: string, key: "account" | "posts" | "ads") {
    setActiveSection(key);
    const node = document.getElementById(id);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (!previewing && data.dataUnavailable) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-5 text-sm text-rose-700">
        TAKATAK could not safely load the social analytics database. No
        replacement or sample values are displayed.
      </div>
    );
  }

  if (!previewing && !data.activeBrandId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
        <BarChart3 className="mx-auto h-8 w-8 text-slate-300" />

        <h1 className="mt-3 text-lg font-semibold text-slate-950">
          Choose an active brand
        </h1>

        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
          Social analytics are isolated to the active workspace and brand.
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 px-5 pb-24 pt-0 sm:px-7"
      style={{ backgroundColor: SUMMARY_PAGE_BG }}
    >
      {!newUser ? (
        <div
          className="sticky top-[66px] z-20 -mx-5 mb-2 flex items-end justify-between gap-4 border-b border-[#E1E4E7] bg-[#FCFCFC] px-5 pt-4 sm:-mx-7 sm:px-7"
          style={{ backgroundColor: SUMMARY_PAGE_BG }}
        >
          <nav
            aria-label="Summary sections"
            className="hidden min-w-0 flex-1 gap-1 overflow-x-auto lg:flex"
          >
            {[
              {
                key: "account" as const,
                label: "ACCOUNT",
                href: "summary-account",
              },
              {
                key: "posts" as const,
                label: "POSTS",
                href: "summary-posts",
              },
              {
                key: "ads" as const,
                label: "AD ACCOUNTS",
                href: "summary-ad-accounts",
              },
            ].map((item) => {
              const selected = activeSection === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => scrollToSection(item.href, item.key)}
                  className={`relative min-w-fit px-4 py-3 text-[13px] font-semibold tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#566DF1] ${
                    selected
                      ? "text-[#20242A]"
                      : "text-[#6B7280] hover:text-[#20242A]"
                  }`}
                >
                  {item.label}

                  {selected ? (
                    <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[#20242A]" />
                  ) : null}
                </button>
              );
            })}
          </nav>

          <label className="mb-2 ml-auto flex flex-col gap-1.5 text-xs font-medium text-[#6B7280] lg:items-end">
            <span>Main period</span>
            <span className="flex h-11 w-full items-center gap-2 rounded-[10px] border border-[#D7DBE0] bg-white px-3 text-sm text-[#30343A] shadow-sm sm:w-auto">
              <span className="font-medium text-[#20242A]">
                {displayDate(start)} - {displayDate(end)}
              </span>
              <CalendarDays className="h-4 w-4 text-[#9AA1A9]" />
              <select
                value={range}
                onChange={(event) => setRange(Number(event.target.value))}
                aria-label="Select summary date range"
                className="max-w-[140px] bg-transparent text-[#505761] outline-none"
              >
                {RANGES.map((days) => (
                  <option key={days} value={days}>
                    {days === 365 ? "Last 12 months" : `Last ${days} days`}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>
      ) : null}

      {newUser ? (
        <div className="pt-5 sm:pt-6">
          <NewUserView />
        </div>
      ) : (
        <div className="pt-4">
          <SubscribedView data={data} start={start} end={end} />
        </div>
      )}
    </div>
  );
}
