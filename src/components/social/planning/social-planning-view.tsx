"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Clock,
  Filter,
  Gem,
  Image as ImageIcon,
  MoreVertical,
  Plus,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import { SOCIAL_BILLING_HREF } from "@/lib/billing/social/billing-banner-policy";
import { POST_STATUS_LABELS } from "@/lib/social/status";
import type {
  PlanningPageData,
  PlanningPost,
} from "@/lib/social/planning/planning-types";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const ROW_H = 60;
const TIME_COL = 72;

const TABS = [
  { id: "calendar", label: "Calendar", premium: false },
  { id: "list", label: "List", premium: false },
  { id: "library", label: "Posts library", premium: true },
  { id: "autolists", label: "Autolists", premium: false },
  { id: "deleted", label: "Deleted posts", premium: false },
  { id: "flows", label: "Flows", premium: true, badge: "New" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PLATFORM_KEYS: SocialPlatformKey[] = [
  "facebook",
  "instagram",
  "threads",
  "x",
  "linkedin",
  "pinterest",
  "tiktok",
  "youtube",
  "google_business",
];

function asPlatform(value: string): SocialPlatformKey | null {
  return PLATFORM_KEYS.includes(value as SocialPlatformKey)
    ? (value as SocialPlatformKey)
    : null;
}

function startOfWeekSunday(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHour(hour: number): string {
  if (hour === 0) {
    return "12:00am";
  }
  if (hour < 12) {
    return `${hour}:00am`;
  }
  if (hour === 12) {
    return "12:00pm";
  }
  return `${hour - 12}:00pm`;
}

function formatRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}`;
}

function formatClock(now: Date, timeZone: string): string {
  const time = now.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${time} - ${timeZone}`;
}

function zonedHourMinute(
  date: Date,
  timeZone: string,
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
  };
}

function PremiumMark() {
  return (
    <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f]">
      <Gem className="h-[7px] w-[7px]" />
    </span>
  );
}

/**
 * Lavender best-times wash from the Planning calendar screenshot.
 * Early morning stays near-white; color builds through late morning.
 * Weekends stay a cooler gray-lavender.
 */
function heatColor(dayIndex: number, hour: number): string {
  const weekend = dayIndex === 0 || dayIndex === 6;
  if (hour < 5) {
    return weekend ? "#f1f2f7" : "#fbfaff";
  }
  if (hour < 7) {
    return weekend ? "#eceef6" : "#f5f8ff";
  }
  if (hour < 9) {
    return weekend ? "#e4e7f4" : "#e8edff";
  }
  if (hour < 11) {
    return weekend ? "#d5daf0" : "#dce3ff";
  }
  if (hour < 14) {
    return weekend ? "#c4ccfa" : "#ccd3ff";
  }
  if (hour < 18) {
    return weekend ? "#c4ccfa" : "#d7ddff";
  }
  if (hour < 21) {
    return weekend ? "#d9dcf0" : "#e4e8fb";
  }
  return weekend ? "#eef0f6" : "#f6f7fc";
}

export function SocialPlanningView({
  data,
  canCreate,
}: {
  data: PlanningPageData;
  canCreate: boolean;
}) {
  const searchParams = useSearchParams();
  const billingHref = withSocialPreview(SOCIAL_BILLING_HREF, searchParams);
  const gridRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<TabId>("calendar");
  const [query, setQuery] = useState("");
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeekSunday(new Date()),
  );
  const [platformFilter, setPlatformFilter] = useState("any");
  const [filterOpen, setFilterOpen] = useState(false);
  const [bestTimes, setBestTimes] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [timeZone, setTimeZone] = useState("UTC");

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const node = gridRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = 0;
  }, []);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekEnd = weekDays[6] ?? weekStart;
  const today = new Date();
  const isThisWeek = sameDay(weekStart, startOfWeekSunday(today));

  const connected = data.connectedPlatforms.map((platform) =>
    platform.toLowerCase(),
  );
  const bestTimesPlatform =
    connected.find((platform) => platform === "facebook") ??
    connected[0] ??
    "facebook";

  const visiblePosts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.posts.filter((post) => {
      if (
        platformFilter !== "any" &&
        post.platform.toLowerCase() !== platformFilter
      ) {
        return false;
      }
      if (needle && !post.caption.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [data.posts, platformFilter, query]);

  const scheduled = visiblePosts.filter((post) => post.scheduledAt);
  const library = visiblePosts.filter(
    (post) =>
      !post.scheduledAt &&
      (post.status === "draft" ||
        post.status === "approved" ||
        post.status === "pending_approval"),
  );

  function postsInCell(day: Date, hour: number): PlanningPost[] {
    return scheduled.filter((post) => {
      if (!post.scheduledAt) {
        return false;
      }
      const at = new Date(post.scheduledAt);
      return sameDay(at, day) && at.getHours() === hour;
    });
  }

  function openCreate() {
    if (!canCreate) {
      setNotice("You need permission to create posts in this workspace.");
      return;
    }
    setNotice("The post composer is not available yet. Nothing was scheduled.");
  }

  const showLimitBanner = data.monthlyPostAllowance !== null;
  const zonedNow = zonedHourMinute(now, timeZone);
  const nowTop = (zonedNow.hour + zonedNow.minute / 60) * ROW_H;

  const box =
    "inline-flex h-11 items-center rounded-lg border border-[#e3e6ea] bg-white text-[14.5px] text-[#1d1d1f] hover:bg-[#fafbfc]";
  const iconBox =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e3e6ea] bg-white text-[#667085] hover:bg-[#fafbfc]";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#eaeeef] px-[50px] py-[30px]">
      <div className="shrink-0 border-b border-[#e4e7ec] bg-[#eaeeef]">
        <div className="flex items-center justify-between gap-6">
          <nav className="-mb-px flex flex-wrap gap-8" aria-label="Planning">
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-1.5 border-b-2 py-3 text-[16px] ${
                    active
                      ? "border-[#1d1d1f] font-medium text-[#1d1d1f]"
                      : "border-transparent text-[#6b7280] hover:text-[#1d1d1f]"
                  }`}
                >
                  {item.label}
                  {"badge" in item && item.badge ? (
                    <span className="rounded-full bg-[#22c55e] px-1.5 py-px text-[9px] font-semibold leading-4 text-white">
                      {item.badge}
                    </span>
                  ) : null}
                  {item.premium ? <PremiumMark /> : null}
                </button>
              );
            })}
          </nav>
          <p className="hidden items-center gap-1 text-[12px] text-[#6b7280] sm:inline-flex">
            <Clock className="h-3.5 w-3.5" />
            {formatClock(now, timeZone)}
            <ChevronDown className="h-3 w-3" />
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden  pt-8 pb-6">
        {showLimitBanner ? (
          <aside className="relative mb-8 shrink-0 overflow-hidden rounded-xl border border-[#e8eaed] bg-white">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 top-1/2 h-[160px] w-[160px] -translate-y-1/2"
              style={{
                backgroundImage: [
                  "radial-gradient(circle, transparent 26px, rgba(223,255,50,0.55) 27px, transparent 28px)",
                  "radial-gradient(circle, transparent 40px, rgba(223,255,50,0.38) 41px, transparent 42px)",
                  "radial-gradient(circle, transparent 54px, rgba(223,255,50,0.24) 55px, transparent 56px)",
                  "radial-gradient(circle, transparent 68px, rgba(223,255,50,0.14) 69px, transparent 70px)",
                ].join(", "),
              }}
            />
            <div className="relative z-10 flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:pr-6">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f]">
                  <Gem className="h-3.5 w-3.5" />
                </span>
                <div className="flex flex-col gap-2">
                  <p className="text-[18px] font-semibold leading-5 text-[#1d1d1f]">
                    Do you need a higher plan?
                  </p>
                  <p className="text-[15px] leading-5 text-[#6b7280]">
                    You have posted{" "}
                    <span className="font-semibold text-[#1d1d1f]">
                      {data.postsUsedThisMonth} out of your{" "}
                      {data.monthlyPostAllowance}
                    </span>{" "}
                    available posts in your plan this month. Upgrade your plan
                    to increase the limit.
                  </p>
                </div>
              </div>
              <Link
                href={billingHref}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-[#2a1728] px-3 text-[13px] font-semibold text-[#dfff32]"
              >
                Upgrade your plan
              </Link>
            </div>
          </aside>
        ) : null}

        {tab === "calendar" ? (
          <>
            <div 
              className="mb-6 flex w-full flex-nowrap items-center gap-2.5">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search posts</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  className="h-11 w-full rounded-lg border border-[#e3e6ea] bg-white py-0 pl-8 pr-2.5 text-[14.5px] outline-none placeholder:text-slate-400 focus:border-[#4b8bf5]"
                />
              </label>

              <button
                type="button"
                onClick={() => setWeekStart(startOfWeekSunday(new Date()))}
                className={`${box} p-5 ${
                  isThisWeek ? "font-medium" : "text-slate-600"
                }`}
              >
                This week
              </button>

              <div className="flex h-11 items-center overflow-hidden rounded-lg border border-[#e3e6ea] bg-white gap-5">
                <button
                  type="button"
                  aria-label="Previous week"
                  onClick={() => setWeekStart((current) => addDays(current, -7))}
                  className="flex h-11 w-10 border-r-1 items-center justify-center text-slate-500 hover:bg-[#fafbfc] hover:text-[#1d1d1f]"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <p className="inline-flex h-11 items-center justify-center gap-1 px-2 text-[14.5px] text-[#1d1d1f]">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                  {formatRange(weekStart, weekEnd)}
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </p>
                <button
                  type="button"
                  aria-label="Next week"
                  onClick={() => setWeekStart((current) => addDays(current, 7))}
                  className="flex h-11 w-10 border-l-1 items-center justify-center text-slate-500 hover:bg-[#fafbfc] hover:text-[#1d1d1f]"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>

              <div className="relative flex items-center">
                <button
                  type="button"
                  aria-label="Filter by network"
                  onClick={() => setFilterOpen((open) => !open)}
                  className={`${iconBox} py-5 rounded-r-none ${
                    platformFilter !== "any" ? "border-slate-300" : ""
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                </button>
                {filterOpen ? (
                  <div className="absolute left-0 top-9 z-20 w-44 rounded-lg bg-white py-1 shadow-[0_8px_28px_rgba(15,23,42,0.16)]">
                    <button
                      type="button"
                      onClick={() => {
                        setPlatformFilter("any");
                        setFilterOpen(false);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-slate-50"
                    >
                      Any network
                    </button>
                    {connected.map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => {
                          setPlatformFilter(platform);
                          setFilterOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] capitalize hover:bg-slate-50"
                      >
                        {asPlatform(platform) ? (
                          <SocialPlatformIcon
                            platform={asPlatform(platform)!}
                            className="h-3.5 w-3.5"
                          />
                        ) : null}
                        {platform.replaceAll("_", " ")}
                      </button>
                    ))}
                  </div>
                ) : null}

                <button
                  type="button"
                  aria-label="More"
                  className={`${iconBox} h-11 rounded-l-none`}
                >
                  <MoreVertical className="h-3.5 w-3.5 " />
                </button>
              </div>


              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBestTimes((on) => !on)}
                  className={`${box} gap-2 px-5 justify-center text`}
                >
                  {asPlatform(bestTimesPlatform) ? (
                    <SocialPlatformIcon
                      platform={asPlatform(bestTimesPlatform)!}
                    />
                  ) : null}
                  Best times
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>

                <button
                  type="button"
                  aria-label="Media library"
                  onClick={() =>
                    setNotice("The media library is not available yet.")
                  }
                  className={`${iconBox} h-11 w-11`}
                >
                  <ImageIcon className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setNotice(
                      "Custom calendar views are not available yet. This week grid is the live view.",
                    )
                  }
                  className={`${box} gap-1 px-5`}
                >
                  <ChevronsLeft className="h-3.5 w-3.5 text-slate-400" />
                  Create view
                  <PremiumMark />
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#2a1728] px-7 text-[13px] font-semibold text-[#dfff32] hover:bg-[#3b2438]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create post
                </button>
              </div>
            </div>

            <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl">
              <div
                className="z-10 grid shrink-0 bg-[#eaeeef]"
                style={{
                  gridTemplateColumns: `${TIME_COL}px repeat(7, minmax(0, 1fr))`,
                }}
              >
                <div />
                {weekDays.map((day, dayIndex) => {
                  const isToday = sameDay(day, today);
                  const weekend = dayIndex === 0 || dayIndex === 6;
                  return (
                    <div
                      key={day.toISOString()}
                      className={`mx-px flex h-9 items-center justify-center px-2 gap-1 text-center text-[12px] text-[#4b5563] ${
                        isToday
                          ? "rounded-t-lg bg-[#d8dde2] font-medium text-[#1d1d1f]"
                          : weekend
                            ? "rounded-t-lg bg-[#e5e7eb]"
                            : "rounded-t-lg bg-[#f3f4f6]"
                      }`}
                    >
                      <span className="font-medium text-[#1d1d1f]">
                        {day.getDate()}
                      </span>{" "}
                      {day.toLocaleDateString("en-US", { weekday: "long" })}
                    </div>
                  );
                })}
              </div>

              <div
                ref={gridRef}
                className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white"
              >
                <div className="relative min-w-0">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      data-hour={hour}
                      className="relative grid box-border"
                      style={{
                        gridTemplateColumns: `${TIME_COL}px repeat(7, minmax(0, 1fr))`,
                        height: `${ROW_H}px`,
                      }}
                    >
                      <div
                        className="box-border border-b border-r border-[#e4e8ee] pr-2 text-right text-[11px] text-[#7d8794]"
                        style={{
                          height: `${ROW_H}px`,
                          lineHeight: `${ROW_H}px`,
                        }}
                      >
                        {formatHour(hour)}
                      </div>
                      {weekDays.map((day, dayIndex) => {
                        const cellPosts = postsInCell(day, hour);
                        const fill = bestTimes
                          ? heatColor(dayIndex, hour)
                          : "#ffffff";
                        return (
                          <div
                            key={`${day.toISOString()}-${hour}`}
                            className="relative box-border border-r border-[#e4e8ee] last:border-r-0"
                          >
                            <div
                              className="absolute inset-x-0 inset-y-px"
                              style={{ backgroundColor: fill }}
                            />
                            <div className="relative z-[1] p-0.5">
                              {cellPosts.map((post) => (
                                <CalendarPostChip key={post.id} post={post} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {isThisWeek ? (
                    <div
                      className="pointer-events-none absolute z-[3]"
                      style={{
                        top: nowTop,
                        left: TIME_COL,
                        right: 0,
                      }}
                    >
                      <div className="relative h-px bg-[#374151]">
                        <span className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#ff6b9d]" />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
        </>
      ) : tab === "list" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PlanningList
            posts={scheduled}
            empty="No scheduled posts in this workspace yet."
          />
        </div>
      ) : tab === "library" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PlanningList
            posts={library}
            empty="No drafts or unscheduled posts in the library yet."
          />
        </div>
      ) : tab === "deleted" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmptyPanel text="Deleted posts are not stored yet, so this list is empty." />
        </div>
      ) : tab === "autolists" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmptyPanel text="Autolists are not available yet." />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmptyPanel text="Flows are not available yet." />
        </div>
      )}
      </div>

      {notice ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            onClick={() => setNotice(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setNotice(null)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="pr-8 text-sm leading-6 text-slate-700">{notice}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[#2a1728] px-4 text-sm font-semibold text-white"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CalendarPostChip({ post }: { post: PlanningPost }) {
  const platform = asPlatform(post.platform);
  return (
    <div className="group/post relative mb-0.5">
      <div className="flex cursor-default items-center gap-1 rounded-md bg-white/90 px-1.5 py-1 shadow-sm">
        {platform ? (
          <SocialPlatformIcon platform={platform} className="h-3 w-3" />
        ) : null}
        <span className="truncate text-[11px] text-[#1d1d1f]">
          {post.caption || "Untitled post"}
        </span>
      </div>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-20 hidden max-w-[240px] rounded-lg bg-white px-3 py-2 text-left text-[12px] leading-5 text-[#1d1d1f] shadow-[0_8px_24px_rgba(15,23,42,0.16)] group-hover/post:block"
      >
        {post.caption || "Untitled post"}
      </span>
    </div>
  );
}

function PlanningList({
  posts,
  empty,
}: {
  posts: PlanningPost[];
  empty: string;
}) {
  if (posts.length === 0) {
    return <EmptyPanel text={empty} />;
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-y-auto bg-white px-1 py-1">
      {posts.map((post) => {
        const platform = asPlatform(post.platform);
        return (
          <li key={post.id} className="flex items-center gap-3 py-3">
            {platform ? (
              <SocialPlatformIcon platform={platform} className="h-4 w-4" />
            ) : (
              <span className="w-4" />
            )}
            <p className="min-w-0 flex-1 truncate text-sm text-[#1d1d1f]">
              {post.caption || "Untitled post"}
            </p>
            <span className="shrink-0 text-xs text-slate-400">
              {POST_STATUS_LABELS[post.status] ?? post.status}
            </span>
            <span className="shrink-0 text-xs text-slate-400">
              {post.scheduledAt
                ? new Date(post.scheduledAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "Unscheduled"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <p className="bg-white px-1 py-16 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}
