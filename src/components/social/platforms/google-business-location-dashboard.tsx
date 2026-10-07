'use client';

import {
  ArrowDown,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Download,
  GitCompareArrows,
  Info,
  PieChart,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Table2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { brandInitials } from '@/lib/brands/brand-display-image';
import { SocialSummaryChart } from '@/components/social/analytics/social-summary-chart';
import { SocialPlatformIcon } from '@/components/social/navigation/social-platform-icon';
import {
  SUMMARY_PAGE_BG,
  metricValue,
} from '@/components/social/analytics/social-summary-tokens';

type AnalyticsPoint = {
  date: string;
  maps: number | null;
  search: number | null;
  website: number | null;
  phone: number | null;
  directions: number | null;
};

type AnalyticsKeyword = {
  keyword: string;
  impressions: number | null;
  threshold: number | null;
};

type AnalyticsResponse = {
  ok?: boolean;
  connected?: boolean;
  message?: string;
  notice?: string;
  account?: {
    name?: string | null;
    category?: string | null;
    profileUrl?: string | null;
  };
  range?: {
    start: string;
    end: string;
  };
  totals?: {
    maps: number | null;
    search: number | null;
    reach: number | null;
    website: number | null;
    phone: number | null;
    directions: number | null;
    clicks: number | null;
  };
  points?: AnalyticsPoint[];
  keywords?: AnalyticsKeyword[];
  dataAvailable?: boolean;
  reviews?: {
    averageRating?: number | null;
    total?: number;
    items?: GoogleBusinessReview[];
  };
  media?: {
    total?: number;
    items?: GoogleBusinessMediaItem[];
  };
  posts?: {
    total?: number;
    items?: GoogleBusinessPostItem[];
  };
};

type GoogleBusinessReview = {
  id: string;
  author: string;
  message: string;
  createdAt: string;
  rating: number | null;
  replied: boolean;
};

type GoogleBusinessMediaItem = {
  id: string;
  createdAt: string;
  views: number | null;
  type: 'Photo' | 'Video';
};

type GoogleBusinessPostItem = {
  id: string;
  createdAt: string;
  visits: number | null;
  type: string;
  summary: string;
};

const RANGES = [30, 60, 90] as const;

const SECTIONS = [
  ['location', 'LOCATION'],
  ['reviews', 'REVIEWS'],
  ['photos', 'PHOTOS AND VIDEOS'],
  ['posts', 'POSTS'],
] as const;

type GoogleBusinessSection = (typeof SECTIONS)[number][0];
type ClickMetric = 'website' | 'phone' | 'directions' | 'total';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function createRange(days: number) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);

  return {
    start: isoDate(start),
    end: isoDate(end),
  };
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatValue(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toLocaleString() : '—';
}

function totalPoint(point: AnalyticsPoint): number | null {
  const known = [point.maps, point.search].filter(
    (value): value is number => typeof value === 'number',
  );

  return known.length ? known.reduce((total, value) => total + value, 0) : null;
}

function clickPoint(point: AnalyticsPoint, metric: ClickMetric): number | null {
  if (metric === 'website') return point.website;
  if (metric === 'phone') return point.phone;
  if (metric === 'directions') return point.directions;

  const known = [point.website, point.phone, point.directions].filter(
    (value): value is number => typeof value === 'number',
  );

  return known.length ? known.reduce((total, value) => total + value, 0) : null;
}

function blankSeries(start: string, end: string) {
  const points: Array<{ date: string; value: ReturnType<typeof metricValue> }> = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (cursor <= last) {
    points.push({
      date: cursor.toISOString().slice(0, 10),
      value: metricValue(null),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}

function MetricCard({
  label,
  value,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number | null | undefined;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[98px] min-w-[170px] flex-1 flex-col items-center justify-center rounded-[11px] px-5 py-4 text-center transition ${
        active
          ? 'ring-2 ring-[#20242A]/20 ring-offset-2'
          : 'hover:brightness-[0.98]'
      }`}
      style={{ backgroundColor: color }}
    >
      <strong className="text-[30px] font-medium leading-none text-[#20242A]">
        {formatValue(value)}
      </strong>
      <span className="mt-2 text-[14px] font-medium text-[#30343A]">
        {label}
      </span>
    </button>
  );
}

function reviewStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return `${day} ${time}`;
}

function ReviewStars({ rating }: { rating: number | null }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating ?? 0} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = rating !== null && star <= rating;
        return (
          <Star
            key={star}
            className={`h-4 w-4 ${filled ? 'fill-[#F5B400] text-[#F5B400]' : 'fill-none text-[#D5D8DE]'}`}
          />
        );
      })}
    </span>
  );
}

function ReviewList({ items }: { items: GoogleBusinessReview[] }) {
  const [query, setQuery] = useState('');
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [showUser, setShowUser] = useState(true);
  const [showMessage, setShowMessage] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [showRating, setShowRating] = useState(true);
  const [showReplied, setShowReplied] = useState(true);

  const filtered = items.filter((item) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      item.author.toLowerCase().includes(needle) ||
      item.message.toLowerCase().includes(needle)
    );
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const first = filtered.length ? start + 1 : 0;
  const last = Math.min(start + pageSize, filtered.length);

  function downloadCsv() {
    const headers = ['User', 'Message', 'Date', 'Star rating', 'Replied'].filter(
      (label, index) =>
        [showUser, showMessage, showDate, showRating, showReplied][index],
    );
    const body = filtered.map((item) => {
      const cells = [
        showUser ? item.author : null,
        showMessage ? item.message : null,
        showDate ? reviewStamp(item.createdAt) : null,
        showRating ? (item.rating == null ? '' : String(item.rating)) : null,
        showReplied ? (item.replied ? 'Yes' : 'No') : null,
      ].filter((cell): cell is string => cell !== null);
      return cells;
    });
    const csv = [headers, ...body]
      .map((line) =>
        line
          .map((cell) =>
            /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell,
          )
          .join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'google-business-reviews.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 sm:px-7">
      <h3 className="text-[18px] font-medium text-[#20242A]">List of reviews</h3>

      <button
        type="button"
        aria-expanded={insightsOpen}
        onClick={() => setInsightsOpen((current) => !current)}
        className="mt-5 flex w-full items-center justify-between gap-4 rounded-[12px] border border-[#E3E8F4] bg-[#F3F6FB] px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#7E8CFF]" />
          <span>
            <span className="block text-[15px] font-medium text-[#20242A]">
              Explore insights
            </span>
            <span className="mt-0.5 block text-[13px] text-[#6B7280]">
              Explore patterns and opportunities detected in your reviews
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#6B7280] transition ${insightsOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {insightsOpen ? (
        <p className="px-4 py-3 text-[13px] text-[#6B7280]">
          No review insights for this period.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA1A9]" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search"
            aria-label="Search reviews"
            className="h-10 w-full rounded-[8px] border border-[#E3E6EA] bg-white pl-9 pr-3 text-[14px] text-[#30343A] outline-none"
          />
        </label>
        <div className="relative">
          <button
            type="button"
            aria-expanded={columnsOpen}
            onClick={() => setColumnsOpen((current) => !current)}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] text-[#505761]"
          >
            <Columns3 className="h-4 w-4" />
            Columns
          </button>
          {columnsOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-[8px] border border-[#E6E8EC] bg-white p-2 text-[13px] shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
              {(
                [
                  ['User', showUser, setShowUser],
                  ['Message', showMessage, setShowMessage],
                  ['Date', showDate, setShowDate],
                  ['Star rating', showRating, setShowRating],
                  ['Replied', showReplied, setShowReplied],
                ] as const
              ).map(([label, checked, setChecked]) => (
                <label key={label} className="flex items-center gap-2 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] text-[#505761]"
        >
          <Download className="h-4 w-4" />
          Download CSV
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#C6E86A] text-[#3D4A12]">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-[13px] text-[#30343A]">
          <thead>
            <tr className="border-b border-[#EEF0F2] text-[#8B939C]">
              {showUser ? <th className="px-3 py-3 font-medium">User</th> : null}
              {showMessage ? <th className="px-3 py-3 font-medium">Message</th> : null}
              {showDate ? <th className="px-3 py-3 font-medium">Date</th> : null}
              {showRating ? <th className="px-3 py-3 font-medium">Star rating</th> : null}
              {showReplied ? <th className="px-3 py-3 font-medium">Replied</th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((item) => {
                const expanded = expandedId === item.id;
                const long = item.message.length > 120;
                const initial = item.author.trim().charAt(0).toUpperCase() || 'G';
                return (
                  <tr key={item.id} className="border-b border-[#F4F6F8] align-top">
                    {showUser ? (
                      <td className="px-3 py-4">
                        <span className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7BC98A] text-[13px] font-semibold text-white">
                            {initial}
                          </span>
                          <span className="font-medium">{item.author}</span>
                        </span>
                      </td>
                    ) : null}
                    {showMessage ? (
                      <td className="max-w-[360px] px-3 py-4 text-[#505761]">
                        <p className={expanded ? '' : 'line-clamp-2'}>
                          {item.message || '—'}
                        </p>
                        {long ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId((current) =>
                                current === item.id ? null : item.id,
                              )
                            }
                            className="mt-1 text-[13px] text-[#6B7280]"
                          >
                            {expanded ? 'Less' : 'More'}
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                    {showDate ? (
                      <td className="whitespace-nowrap px-3 py-4 text-[#505761]">
                        {reviewStamp(item.createdAt)}
                      </td>
                    ) : null}
                    {showRating ? (
                      <td className="px-3 py-4">
                        <ReviewStars rating={item.rating} />
                      </td>
                    ) : null}
                    {showReplied ? (
                      <td className="px-3 py-4">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-6 items-center rounded-full bg-[#20242A] px-2.5 text-[12px] font-medium text-white">
                            {item.replied ? 'Yes' : 'No'}
                          </span>
                          {item.replied ? null : (
                            <span className="inline-flex h-8 items-center rounded-[8px] border border-[#E3E6EA] px-3 text-[13px] text-[#30343A]">
                              Reply
                            </span>
                          )}
                        </span>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-[#8B939C]">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-[13px] text-[#505761]">
        <label className="inline-flex items-center gap-2">
          Items per page:
          <select
            aria-label="Reviews per page"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            className="h-8 rounded-[6px] border border-[#E3E6EA] bg-white px-2"
          >
            {[5, 10, 25].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span>
          {first}-{last} of {filtered.length}
        </span>
        <div className="flex items-center gap-1">
          {(
            [
              ['First page', () => setPage(0), ChevronsLeft, safePage === 0],
              [
                'Previous page',
                () => setPage((current) => Math.max(0, current - 1)),
                ChevronLeft,
                safePage === 0,
              ],
              [
                'Next page',
                () => setPage((current) => Math.min(pageCount - 1, current + 1)),
                ChevronRight,
                safePage >= pageCount - 1,
              ],
              [
                'Last page',
                () => setPage(pageCount - 1),
                ChevronsRight,
                safePage >= pageCount - 1,
              ],
            ] as const
          ).map(([label, action, Icon, disabled]) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={action}
              disabled={disabled || !filtered.length}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#9AA1A9] disabled:opacity-40"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyMediaSearch() {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <svg viewBox="0 0 220 120" className="h-[120px] w-[220px]" aria-hidden="true">
        <circle cx="110" cy="58" r="46" fill="#E7F0FB" />
        <rect x="62" y="42" width="70" height="8" rx="4" fill="#F4F7FB" />
        <rect x="62" y="56" width="52" height="8" rx="4" fill="#F7F9FC" />
        <rect x="62" y="70" width="40" height="8" rx="4" fill="#F7F9FC" />
        <circle cx="132" cy="62" r="22" fill="none" stroke="#20242A" strokeWidth="6" />
        <path d="M148 80 168 100" stroke="#20242A" strokeWidth="8" strokeLinecap="round" />
      </svg>
      <p className="mt-2 text-[18px] font-medium text-[#30343A]">
        Oops! Nothing found, try another search
      </p>
      <p className="mt-2 max-w-[460px] text-[14px] leading-6 text-[#9AA3AB]">
        You can use the filter tools to narrow down your search. Check if the
        current date range suits your needs.
      </p>
    </div>
  );
}

function MediaList({
  items,
  title,
  fileName,
  valueLabel,
}: {
  items: Array<{
    id: string;
    createdAt: string;
    views: number | null;
    type: string;
    summary?: string;
  }>;
  title: string;
  fileName: string;
  valueLabel: string;
}) {
  const [query, setQuery] = useState('');
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [showDate, setShowDate] = useState(true);
  const [showViews, setShowViews] = useState(true);
  const [showType, setShowType] = useState(true);

  const filtered = items.filter((item) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      item.type.toLowerCase().includes(needle) ||
      (item.summary ?? '').toLowerCase().includes(needle)
    );
  });

  function downloadCsv() {
    const headers = ['Date', valueLabel, 'Type'].filter(
      (_, index) => [showDate, showViews, showType][index],
    );
    const body = filtered.map((item) => {
      const cells = [
        showDate ? item.createdAt.slice(0, 10) : null,
        showViews ? (item.views == null ? '' : String(item.views)) : null,
        showType ? item.type : null,
      ].filter((cell): cell is string => cell !== null);
      return cells;
    });
    const csv = [headers, ...body]
      .map((line) =>
        line
          .map((cell) =>
            /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell,
          )
          .join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 sm:px-7">
      <h3 className="text-[18px] font-medium text-[#20242A]">{title}</h3>
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA1A9]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search photos and videos"
            className="h-10 w-full rounded-[8px] border border-[#E3E6EA] bg-white pl-9 pr-3 text-[14px] text-[#30343A] outline-none"
          />
        </label>
        <div className="relative">
          <button
            type="button"
            aria-expanded={columnsOpen}
            onClick={() => setColumnsOpen((current) => !current)}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] text-[#505761]"
          >
            <Columns3 className="h-4 w-4" />
            Columns
          </button>
          {columnsOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-40 rounded-[8px] border border-[#E6E8EC] bg-white p-2 text-[13px] shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
              {(
                [
                  ['Date', showDate, setShowDate],
                  [valueLabel, showViews, setShowViews],
                  ['Type', showType, setShowType],
                ] as const
              ).map(([label, checked, setChecked]) => (
                <label key={label} className="flex items-center gap-2 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] text-[#505761]"
        >
          <Download className="h-4 w-4" />
          Download CSV
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#C6E86A] text-[#3D4A12]">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        </button>
      </div>
      {filtered.length === 0 ? (
        <EmptyMediaSearch />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px] text-[#30343A]">
            <thead>
              <tr className="border-b border-[#EEF0F2] text-[#8B939C]">
                {showDate ? <th className="py-3 pr-4 font-medium">Date</th> : null}
                {showViews ? <th className="py-3 pr-4 font-medium">{valueLabel}</th> : null}
                {showType ? <th className="py-3 font-medium">Type</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-[#F4F6F8]">
                  {showDate ? (
                    <td className="py-3 pr-4">{item.createdAt.slice(0, 10)}</td>
                  ) : null}
                  {showViews ? (
                    <td className="py-3 pr-4">{formatValue(item.views)}</td>
                  ) : null}
                  {showType ? <td className="py-3">{item.type}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function GoogleBusinessLocationDashboard({
  accountName,
  profileImageUrl = null,
}: {
  accountName: string;
  profileImageUrl?: string | null;
}) {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [section, setSection] = useState<GoogleBusinessSection>('location');
  const [clickMetric, setClickMetric] = useState<ClickMetric>('total');
  const [keywordPage, setKeywordPage] = useState(0);
  const [keywordPageSize, setKeywordPageSize] = useState(5);
  const [distributionView, setDistributionView] = useState<'chart' | 'table'>(
    'chart',
  );
  const [selectedMetric, setSelectedMetric] = useState<
    'maps' | 'search' | 'total'
  >('total');
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => createRange(rangeDays), [rangeDays]);

  const loadAnalytics = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({
          start: range.start,
          end: range.end,
        });

        const response = await fetch(
          `/api/social/google-business/analytics?${query.toString()}`,
          {
            method: 'GET',
            cache: 'no-store',
            signal,
          },
        );

        const body = (await response.json()) as AnalyticsResponse;

        if (!response.ok) {
          throw new Error(
            body.message ??
              'Google Business Profile analytics could not be loaded.',
          );
        }

        setAnalytics(body);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === 'AbortError'
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Google Business Profile analytics could not be loaded.',
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [range.end, range.start],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadAnalytics(controller.signal);

    return () => controller.abort();
  }, [loadAnalytics]);

  function scrollToSection(next: GoogleBusinessSection) {
    setSection(next);
    document.getElementById(`gbp-${next}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  useEffect(() => {
    const nodes = SECTIONS.map(([key]) => document.getElementById(`gbp-${key}`)).filter(
      (node): node is HTMLElement => node !== null,
    );
    if (!nodes.length || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              Math.abs(left.boundingClientRect.top) - Math.abs(right.boundingClientRect.top),
          );
        const visibleId = visible[0]?.target.id;
        if (!visibleId?.startsWith('gbp-')) return;
        const next = visibleId.slice('gbp-'.length);
        if (
          next === 'location' ||
          next === 'reviews' ||
          next === 'photos' ||
          next === 'posts'
        ) {
          setSection(next);
        }
      },
      { rootMargin: '-160px 0px -55% 0px', threshold: [0, 0.1, 0.25, 0.5] },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => analytics?.points ?? [], [analytics?.points]);
  const totals = analytics?.totals;
  const keywords = analytics?.keywords ?? [];
  const keywordPageCount = Math.max(
    1,
    Math.ceil(keywords.length / keywordPageSize),
  );
  const safeKeywordPage = Math.min(keywordPage, keywordPageCount - 1);
  const keywordStart = safeKeywordPage * keywordPageSize;
  const visibleKeywords = keywords.slice(
    keywordStart,
    keywordStart + keywordPageSize,
  );
  const keywordFirst = keywords.length ? keywordStart + 1 : 0;
  const keywordLast = Math.min(keywordStart + keywordPageSize, keywords.length);

  const chartPoints = useMemo(
    () =>
      points.map((point) => {
        const value =
          selectedMetric === 'maps'
            ? point.maps
            : selectedMetric === 'search'
              ? point.search
              : totalPoint(point);

        return {
          date: point.date,
          value: metricValue(value),
        };
      }),
    [points, selectedMetric],
  );

  const chartLabel =
    selectedMetric === 'maps'
      ? 'Google Maps'
      : selectedMetric === 'search'
        ? 'Google Search'
        : 'Total reach';

  const clickChartPoints = useMemo(
    () =>
      points.map((point) => ({
        date: point.date,
        value: metricValue(clickPoint(point, clickMetric)),
      })),
    [clickMetric, points],
  );

  const clickChartLabel =
    clickMetric === 'website'
      ? 'Website'
      : clickMetric === 'phone'
        ? 'Phone'
        : clickMetric === 'directions'
          ? 'Directions'
          : 'Total clicks';

  const reviewItems = analytics?.reviews?.items ?? [];
  const reviewPoints = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of reviewItems) {
      const day = item.createdAt.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return blankSeries(range.start, range.end).map((point) => ({
      date: point.date,
      value: metricValue(counts.get(point.date) ?? 0),
    }));
  }, [range.end, range.start, reviewItems]);
  const reviewAverage = analytics?.reviews?.averageRating ?? null;
  const reviewTotal = analytics?.reviews?.total ?? reviewItems.length;
  const mediaItems = analytics?.media?.items ?? [];
  const mediaPoints = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of mediaItems) {
      const day = item.createdAt.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return blankSeries(range.start, range.end).map((point) => ({
      date: point.date,
      value: metricValue(counts.get(point.date) ?? 0),
    }));
  }, [mediaItems, range.end, range.start]);
  const mediaTotal = analytics?.media?.total ?? mediaItems.length;
  const postItems = analytics?.posts?.items ?? [];
  const postPoints = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of postItems) {
      const day = item.createdAt.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return blankSeries(range.start, range.end).map((point) => ({
      date: point.date,
      value: metricValue(counts.get(point.date) ?? 0),
    }));
  }, [postItems, range.end, range.start]);
  const postTotal = analytics?.posts?.total ?? postItems.length;

  const maps = totals?.maps ?? null;
  const search = totals?.search ?? null;
  const total = totals?.reach ?? null;

  const knownReach = typeof maps === 'number' || typeof search === 'number';
  const distributionTotal =
    (typeof maps === 'number' ? maps : 0) +
    (typeof search === 'number' ? search : 0);

  const mapsPercent =
    knownReach && distributionTotal > 0
      ? ((typeof maps === 'number' ? maps : 0) / distributionTotal) * 100
      : null;

  const searchPercent =
    knownReach && distributionTotal > 0
      ? ((typeof search === 'number' ? search : 0) / distributionTotal) * 100
      : null;

  const resolvedAccountName = analytics?.account?.name?.trim() || accountName;

  return (
    <div
      className="space-y-6 px-1 pb-6"
      style={{ backgroundColor: SUMMARY_PAGE_BG }}
    >
      <div
        className="sticky top-[66px] z-20 -mx-1 flex flex-col gap-4 border-b border-[#E1E4E7] px-1 pb-4 pt-3 lg:flex-row lg:items-end lg:justify-between"
        style={{ backgroundColor: SUMMARY_PAGE_BG }}
      >
        <nav
          aria-label="Google Business Profile analytics sections"
          className="flex min-w-0 gap-1 overflow-x-auto"
        >
          {SECTIONS.map(([key, label]) => {
            const selected = section === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => scrollToSection(key)}
                className={`relative min-w-fit px-3 py-3 text-[12px] font-semibold tracking-wide ${
                  selected ? 'text-[#20242A]' : 'text-[#6B7280]'
                }`}
              >
                {label}
                {selected ? (
                  <span className="absolute inset-x-2 bottom-0 h-[2px] bg-[#20242A]" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#6B7280]">
            <span>Main period</span>
            <span className="flex h-11 items-center gap-2 rounded-[10px] border border-[#D7DBE0] bg-white px-3 text-sm text-[#30343A] shadow-sm">
              <CalendarDays className="h-4 w-4 text-[#9AA1A9]" />
              <span className="font-medium text-[#20242A]">
                {displayDate(range.start)} - {displayDate(range.end)}
              </span>
              <select
                value={rangeDays}
                onChange={(event) => setRangeDays(Number(event.target.value))}
                aria-label="Select Google Business Profile date range"
                className="max-w-[105px] bg-transparent text-[#505761] outline-none"
              >
                {RANGES.map((days) => (
                  <option key={days} value={days}>
                    Last {days} days
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#6B7280]">
            <span>Comparison period</span>
            <button
              type="button"
              onClick={() => setCompareEnabled((current) => !current)}
              className={`inline-flex h-11 items-center gap-2 rounded-[10px] border px-3 text-sm font-medium shadow-sm ${
                compareEnabled
                  ? 'border-[#8996F6] bg-[#EEF0FF] text-[#30343A]'
                  : 'border-[#D7DBE0] bg-white text-[#505761]'
              }`}
            >
              <GitCompareArrows className="h-4 w-4 text-[#9AA1A9]" />
              {compareEnabled ? 'Comparison on' : 'Create comparison view'}
            </button>
          </label>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-[10px] border border-[#8495FF] bg-[#EEF0FF] px-4 py-3 text-sm text-[#303B78]">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#6477F3]" />
        <p>
          Some Google Business Profile metrics may not be available for the last
          5–6 days. Keywords from the previous month may not be fully updated
          during the first days of the current month.
        </p>
      </div>

      <section id="gbp-location" className="scroll-mt-[150px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[22px] font-medium text-[#20242A]">Location</h1>

        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[13px] font-bold text-slate-600">
              {brandInitials(resolvedAccountName) || '•'}
            </span>

            <span
              className="absolute -bottom-[3px] -right-[5px] flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-white"
              aria-label="Google Business Profile"
            >
              <SocialPlatformIcon
                platform="google_business"
                className="h-3.5 w-3.5"
              />
            </span>
          </div>

          <span className="truncate text-[16px] font-medium leading-6 text-[#20242A]">
            {resolvedAccountName}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-[14px] border border-[#E8EAED] bg-white">
          <RefreshCw className="h-6 w-6 animate-spin text-[#566DF1]" />
        </div>
      ) : error ? (
        <div className="rounded-[14px] border border-red-200 bg-white p-6">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            className="mt-4 rounded-[9px] bg-[#20242A] px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      ) : analytics?.connected === false ? (
        <div className="rounded-[14px] border border-[#E8EAED] bg-white p-8 text-center text-sm text-[#6B7280]">
          {analytics.notice ??
            'No connected Google Business Profile location is selected.'}
        </div>
      ) : (
        <>
          <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 shadow-[0_3px_14px_rgba(15,23,42,0.04)] sm:px-7">
            <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <h2 className="text-[19px] font-medium text-[#20242A]">Reach</h2>

              <div className="flex flex-wrap gap-4 lg:w-[52%]">
                <MetricCard
                  label="Google Maps"
                  value={maps}
                  color="#8994F2"
                  active={selectedMetric === 'maps'}
                  onClick={() => setSelectedMetric('maps')}
                />
                <MetricCard
                  label="Google Search"
                  value={search}
                  color="#F0A4DF"
                  active={selectedMetric === 'search'}
                  onClick={() => setSelectedMetric('search')}
                />
                <MetricCard
                  label="Total"
                  value={total}
                  color="#E9AA2D"
                  active={selectedMetric === 'total'}
                  onClick={() => setSelectedMetric('total')}
                />
              </div>
            </div>

            <SocialSummaryChart
              points={chartPoints}
              seriesLabel={chartLabel}
              seriesColor={
                selectedMetric === 'maps'
                  ? '#7D89ED'
                  : selectedMetric === 'search'
                    ? '#E68ACF'
                    : '#E3A126'
              }
              showMarkers
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="min-h-[520px] bg-white px-5 py-6 sm:px-7">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[18px] font-medium text-[#20242A]">
                  Reach distribution by source
                </h2>

                <button
                  type="button"
                  onClick={() =>
                    setDistributionView((current) =>
                      current === 'chart' ? 'table' : 'chart',
                    )
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-[9px] px-3 text-sm font-medium text-[#30343A] hover:bg-[#F5F5F6]"
                >
                  {distributionView === 'chart' ? (
                    <Table2 className="h-4 w-4" />
                  ) : (
                    <PieChart className="h-4 w-4" />
                  )}

                  {distributionView === 'chart' ? 'View table' : 'View chart'}
                </button>
              </div>

              {distributionView === 'chart' ? (
                <div className="mt-8 space-y-6">
                  {[
                    {
                      label: 'Google Maps',
                      value: maps,
                      percent: mapsPercent,
                      color: '#8994F2',
                    },
                    {
                      label: 'Google Search',
                      value: search,
                      percent: searchPercent,
                      color: '#F0A4DF',
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                        <span className="font-medium text-[#30343A]">
                          {item.label}
                        </span>

                        <span className="text-[#6B7280]">
                          {formatValue(item.value)}
                          {item.percent !== null
                            ? ` · ${item.percent.toFixed(1)}%`
                            : ''}
                        </span>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-[#EEF0F3]">
                        {item.percent !== null ? (
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${item.percent}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#FAFAFB] text-[#30343A]">
                      <tr>
                        <th className="px-5 py-5 font-medium">Group</th>
                        <th className="px-5 py-5 text-right font-medium">
                          Count
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {knownReach ? (
                        <>
                          {typeof maps === 'number' ? (
                            <tr className="border-b border-[#EEF0F2]">
                              <td className="px-5 py-4">Google Maps</td>
                              <td className="px-5 py-4 text-right">
                                {maps.toLocaleString()}
                              </td>
                            </tr>
                          ) : null}

                          {typeof search === 'number' ? (
                            <tr>
                              <td className="px-5 py-4">Google Search</td>
                              <td className="px-5 py-4 text-right">
                                {search.toLocaleString()}
                              </td>
                            </tr>
                          ) : null}
                        </>
                      ) : (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-5 py-6 text-center text-[#30343A]"
                          >
                            No data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex min-h-[520px] flex-col bg-white px-5 py-6 sm:px-7">
              <h2 className="text-[18px] font-medium text-[#20242A]">
                Keywords
              </h2>

              <div className="mt-6 flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#FAFAFB] text-[#D0D2D4]">
                    <tr>
                      <th className="px-5 py-5 font-medium">Keyword</th>
                      <th className="px-5 py-5 font-medium">
                        <span className="inline-flex items-center gap-2">
                          Impressions
                          <ArrowDown className="h-4 w-4" />
                        </span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleKeywords.length ? (
                      visibleKeywords.map((keyword) => (
                        <tr
                          key={keyword.keyword}
                          className="border-b border-[#EEF0F2]"
                        >
                          <td className="px-5 py-4 font-medium text-[#30343A]">
                            {keyword.keyword}
                          </td>
                          <td className="px-5 py-4 text-[#5F6770]">
                            {keyword.impressions !== null
                              ? keyword.impressions.toLocaleString()
                              : keyword.threshold !== null
                                ? `< ${keyword.threshold.toLocaleString()}`
                                : '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-5 py-8 text-center text-[#30343A]"
                        >
                          No keyword data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-4 border-t border-[#E6EBEE] pt-4 text-sm text-[#20242A]">
                <label className="flex items-center gap-3">
                  <span>Items per page:</span>

                  <select
                    value={keywordPageSize}
                    onChange={(event) => {
                      setKeywordPageSize(Number(event.target.value));
                      setKeywordPage(0);
                    }}
                    aria-label="Keywords per page"
                    className="h-12 rounded-[10px] border border-[#D7DBE0] bg-white px-4"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                  </select>
                </label>

                <span>
                  {keywordFirst}-{keywordLast} of {keywords.length}
                </span>

                <button
                  type="button"
                  aria-label="First keywords page"
                  disabled={safeKeywordPage === 0}
                  onClick={() => setKeywordPage(0)}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D5DCE0] text-[#52606A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ChevronsLeft className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  aria-label="Previous keywords page"
                  disabled={safeKeywordPage === 0}
                  onClick={() =>
                    setKeywordPage((page) => Math.max(0, page - 1))
                  }
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D5DCE0] text-[#52606A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  aria-label="Next keywords page"
                  disabled={safeKeywordPage >= keywordPageCount - 1}
                  onClick={() =>
                    setKeywordPage((page) =>
                      Math.min(keywordPageCount - 1, page + 1),
                    )
                  }
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D5DCE0] text-[#52606A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  aria-label="Last keywords page"
                  disabled={safeKeywordPage >= keywordPageCount - 1}
                  onClick={() => setKeywordPage(keywordPageCount - 1)}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D5DCE0] text-[#52606A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ChevronsRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 shadow-[0_3px_14px_rgba(15,23,42,0.04)] sm:px-7">
            <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <h2 className="text-[19px] font-medium text-[#20242A]">Clicks</h2>
              <div className="flex flex-wrap gap-4 lg:w-[68%]">
                <MetricCard
                  label="Website"
                  value={totals?.website ?? null}
                  color="#8994F2"
                  active={clickMetric === 'website'}
                  onClick={() => setClickMetric('website')}
                />
                <MetricCard
                  label="Phone"
                  value={totals?.phone ?? null}
                  color="#8FCB8A"
                  active={clickMetric === 'phone'}
                  onClick={() => setClickMetric('phone')}
                />
                <MetricCard
                  label="Directions"
                  value={totals?.directions ?? null}
                  color="#F0A4DF"
                  active={clickMetric === 'directions'}
                  onClick={() => setClickMetric('directions')}
                />
                <MetricCard
                  label="Total"
                  value={totals?.clicks ?? null}
                  color="#E9AA2D"
                  active={clickMetric === 'total'}
                  onClick={() => setClickMetric('total')}
                />
              </div>
            </div>
            <SocialSummaryChart
              points={clickChartPoints}
              seriesLabel={clickChartLabel}
              seriesColor={
                clickMetric === 'website'
                  ? '#7D89ED'
                  : clickMetric === 'phone'
                    ? '#7BC98A'
                    : clickMetric === 'directions'
                      ? '#E68ACF'
                      : '#E3A126'
              }
              showMarkers
            />
          </section>
        </>
      )}
      </section>

      <section id="gbp-reviews" className="scroll-mt-[150px] space-y-6">
        <h2 className="text-[22px] font-medium text-[#20242A]">Reviews</h2>
        <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 shadow-[0_3px_14px_rgba(15,23,42,0.04)] sm:px-7">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <h3 className="text-[19px] font-medium text-[#20242A]">Reviews</h3>
            <div className="flex flex-wrap gap-4 lg:w-[42%]">
              <div className="flex min-h-[98px] min-w-[150px] flex-1 flex-col items-center justify-center rounded-[11px] bg-[#8994F2] px-5 py-4 text-center">
                <strong className="text-[30px] font-medium leading-none text-[#20242A]">
                  {reviewAverage == null ? '-' : reviewAverage}
                </strong>
                <span className="mt-2 text-[14px] font-medium text-[#30343A]">
                  Star rating
                </span>
              </div>
              <div className="flex min-h-[98px] min-w-[150px] flex-1 flex-col items-center justify-center rounded-[11px] bg-[#E9AA2D] px-5 py-4 text-center">
                <strong className="text-[30px] font-medium leading-none text-[#20242A]">
                  {reviewTotal}
                </strong>
                <span className="mt-2 text-[14px] font-medium text-[#30343A]">
                  Total
                </span>
              </div>
            </div>
          </div>
          <SocialSummaryChart
            points={reviewPoints}
            seriesLabel="Reviews"
            seriesColor="#8994F2"
            showMarkers
            hideFlatZero
          />
        </section>
        <ReviewList items={reviewItems} />
      </section>

      <section id="gbp-photos" className="scroll-mt-[150px] space-y-6">
        <h2 className="text-[22px] font-medium text-[#20242A]">Photos and videos</h2>
        <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 shadow-[0_3px_14px_rgba(15,23,42,0.04)] sm:px-7">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <h3 className="text-[19px] font-medium text-[#20242A]">
              Photos and videos
            </h3>
            <div className="flex min-h-[98px] w-[150px] flex-col items-center justify-center rounded-[11px] bg-[#E9AA2D] px-5 py-4 text-center">
              <strong className="text-[30px] font-medium leading-none text-[#20242A]">
                {mediaTotal}
              </strong>
              <span className="mt-2 text-[14px] font-medium text-[#30343A]">
                Total
              </span>
            </div>
          </div>
          <SocialSummaryChart
            points={mediaPoints}
            seriesLabel="Photos and videos"
            seriesColor="#E9AA2D"
            showMarkers
            hideFlatZero
          />
        </section>
        <MediaList
          items={mediaItems}
          title="List of photos and videos"
          fileName="google-business-photos.csv"
          valueLabel="Views"
        />
      </section>

      <section id="gbp-posts" className="scroll-mt-[150px] space-y-6">
        <h2 className="text-[22px] font-medium text-[#20242A]">Posts</h2>
        <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 shadow-[0_3px_14px_rgba(15,23,42,0.04)] sm:px-7">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <h3 className="text-[19px] font-medium text-[#20242A]">Posts</h3>
            <div className="flex min-h-[98px] w-[150px] flex-col items-center justify-center rounded-[11px] bg-[#E9AA2D] px-5 py-4 text-center">
              <strong className="text-[30px] font-medium leading-none text-[#20242A]">
                {postTotal}
              </strong>
              <span className="mt-2 text-[14px] font-medium text-[#30343A]">
                Total
              </span>
            </div>
          </div>
          <SocialSummaryChart
            points={postPoints}
            seriesLabel="Posts"
            seriesColor="#E9AA2D"
            showMarkers
            hideFlatZero
          />
        </section>
        <MediaList
          items={postItems.map((item) => ({
            id: item.id,
            createdAt: item.createdAt,
            views: item.visits,
            type: item.type,
            summary: item.summary,
          }))}
          title="List of posts"
          fileName="google-business-posts.csv"
          valueLabel="Visits"
        />
      </section>
    </div>
  );
}
