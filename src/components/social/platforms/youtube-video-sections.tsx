"use client";

import { ChevronDown, Download, LayoutDashboard, Search, SearchX, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  YoutubeVideoDay,
  YoutubeVideoMetrics,
  YoutubeVideoRow,
  YoutubeVideoSection,
} from "@/lib/social/providers/youtube-video-performance";

const METRICS = [
  { key: "views", label: "Video views" },
  { key: "likes", label: "Likes" },
  { key: "dislikes", label: "Dislikes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
] as const;
type Metric = (typeof METRICS)[number]["key"];
const TABLE_COLUMNS = [
  { key: "publishedAt", label: "Published" },
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "dislikes", label: "Dislikes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
] as const;
type TableColumn = (typeof TABLE_COLUMNS)[number]["key"];
function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : new Intl.NumberFormat("en-CA").format(value);
}
function shortDate(value: string): string {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed)
    : "Unavailable";
}
function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function downloadCsv(rows: YoutubeVideoRow[], columns: readonly TableColumn[], kind: "published" | "viewed"): void {
  const header = ["Video", "YouTube URL", ...columns.map((column) => TABLE_COLUMNS.find((item) => item.key === column)?.label ?? column)];
  const contents = [
    header.map(csvCell).join(","),
    ...rows.map((row) => [
      row.title,
      "https://www.youtube.com/watch?v=" + row.id,
      ...columns.map((column) => column === "publishedAt" ? row.publishedAt : row.metrics[column]),
    ].map(csvCell).join(",")),
  ].join("\r\n");
  const file = new Blob(["\ufeff", contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "takatak-youtube-" + kind + "-videos.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function VideoTrend({
  daily, selected, kind, uploads,
}: {
  daily: YoutubeVideoDay[];
  selected: Metric | "videos";
  kind: "published" | "viewed";
  uploads: YoutubeVideoRow[];
}) {
  const series = daily.map((point) => ({
    label: point.day,
    value: selected === "videos"
      ? uploads.filter((video) => video.publishedAt.slice(0, 10) === point.day).length
      : point.metrics[selected],
  }));
  if (!daily.some((point) => selected === "videos" || point.metrics[selected] !== null)) {
    return (
      <div className="flex min-h-[230px] flex-col items-center justify-center gap-2 text-center text-slate-500">
        <SearchX className="h-8 w-8 text-slate-400" aria-hidden="true" />
        <span className="text-sm">No verified {kind} video activity is available for this period.</span>
      </div>
    );
  }
  const width = 1000, height = 248, x0 = 55, x1 = 980, y0 = 14, y1 = 203;
  const known = series.filter((row): row is { label: string; value: number } => row.value !== null);
  const numbers = known.map((row) => row.value);
  const min = Math.min(0, ...numbers);
  const max = Math.max(1, ...numbers);
  const span = max === min ? 1 : max - min;
  const x = (index: number) => x0 + (index / Math.max(1, series.length - 1)) * (x1 - x0);
  const y = (value: number) => y1 - ((value - min) / span) * (y1 - y0);
  const lines: string[] = [];
  let segment: string[] = [];
  series.forEach((row, index) => {
    if (row.value === null) {
      if (segment.length) lines.push(segment.join(" "));
      segment = [];
    } else {
      segment.push((segment.length ? "L" : "M") + x(index).toFixed(1) + " " + y(row.value).toFixed(1));
    }
  });
  if (segment.length) lines.push(segment.join(" "));
  const labelIndices = [0, Math.floor((series.length - 1) / 4), Math.floor((series.length - 1) / 2), Math.floor((series.length - 1) * 0.75), series.length - 1];
  return (
    <div className="overflow-x-auto">
      <svg viewBox={"0 0 " + width + " " + height} className="w-full min-w-[450px]"
        role="img" aria-label={kind + " videos — daily " + (selected === "videos" ? "uploads" : selected)}>
        {[0, 1, 2, 3, 4].map((step) => {
          const amount = min + (span * step / 4);
          const yCoord = y(amount);
          return <g key={step}>
            <line x1={x0} y1={yCoord} x2={x1} y2={yCoord} stroke="#E4EAF1" strokeDasharray="3 5" />
            <text x={x0-10} y={yCoord+4} textAnchor="end" fontSize="12" fill="#64748B">{formatNumber(Math.round(amount * 10) / 10)}</text>
          </g>;
        })}
        {lines.map((line, index) =>
          <path key={index} d={line} fill="none" stroke="#1565D8" strokeWidth="2.5" strokeLinecap="round" />)}
        {series.map((point, index) =>
          point.value !== null && (series.length <= 45 || index % Math.ceil(series.length / 45) === 0)
            ? <circle key={point.label} cx={x(index)} cy={y(point.value)} r="3" fill="#1565D8">
                <title>{point.label + ": " + formatNumber(point.value)}</title>
              </circle>
            : null)}
        {labelIndices.filter((index, position) => index >= 0 && index < series.length && labelIndices.indexOf(index) === position).map((index) =>
          <text key={index} x={x(index)} y={height - 11} fontSize="12" textAnchor="middle" fill="#64748B">
            {new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(series[index].label + "T12:00:00Z"))}
          </text>)}
      </svg>
    </div>
  );
}

function VideoList({
  kind, items, loaded, limited, showDashboardAction,
}: {
  kind: "published" | "viewed";
  items: YoutubeVideoRow[];
  loaded: boolean;
  limited: boolean;
  showDashboardAction: boolean;
}) {
  const [search, setSearch] = useState("");
  const [columns, setColumns] = useState<TableColumn[]>(TABLE_COLUMNS.map((column) => column.key));
  const [columnsOpen, setColumnsOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return q ? items.filter((video) => video.title.toLocaleLowerCase().includes(q) || video.id.toLowerCase().includes(q)) : items;
  }, [items, search]);
  function changeColumn(column: TableColumn) {
    setColumns((previous) => previous.includes(column) ? previous.filter((name) => name !== column) : [...previous, column]);
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h3 className="text-lg font-medium text-slate-950">List of videos</h3>
      <div className="mt-5 flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative flex min-w-0 flex-1 items-center">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 h-5 w-5 text-slate-500" />
          <span className="sr-only">Search videos</span>
          <input aria-label={"Search " + kind + " videos"} value={search} onChange={(event) => setSearch(event.target.value)}
            disabled={!loaded}
            placeholder="Search videos"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" />
        </label>
        <div className="relative">
          <button type="button" onClick={() => setColumnsOpen((value) => !value)} disabled={!loaded}
            aria-expanded={columnsOpen}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <SlidersHorizontal aria-hidden="true" size={16} /> Columns <ChevronDown aria-hidden="true" size={15} />
          </button>
          {columnsOpen && <fieldset className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <legend className="sr-only">Visible columns</legend>
            {TABLE_COLUMNS.map((column) => (
              <label key={column.key} className="flex cursor-pointer items-center gap-2 py-1.5 text-xs text-slate-800">
                <input type="checkbox" checked={columns.includes(column.key)} onChange={() => changeColumn(column.key)}
                  className="accent-[#1565D8]" />
                {column.label}
              </label>
            ))}
          </fieldset>}
        </div>
        <button type="button" onClick={() => downloadCsv(filtered, columns, kind)}
          disabled={!loaded || filtered.length === 0}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <Download aria-hidden="true" size={16} /> Download CSV
        </button>
        {showDashboardAction ? (
          <button type="button" disabled title="Dashboard pinning is not yet configured."
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500" >
            <LayoutDashboard aria-hidden="true" size={16} /> Add to dashboard
          </button>
        ) : null}
      </div>
      {loaded && limited ? <p className="mt-3 text-xs text-amber-800">This list is limited to the first 200 videos returned by YouTube. Searches and CSV exports apply only to the displayed rows.</p> : null}
      {!loaded || filtered.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#F1F6FC]">
            <SearchX aria-hidden="true" className="h-14 w-14 text-slate-500" strokeWidth={1.4} />
          </div>
          <p className="text-xl font-medium text-slate-950">
            {loaded ? "Oops! Nothing found, try another search" : "Connect and authorize YouTube to see videos"}
          </p>
          <p className="max-w-xl text-sm text-slate-500">
            {loaded ? "Use search to narrow the list, or choose a different date range to discover more videos." : "The list will display real YouTube videos when analytics become available."}
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th scope="col" className="px-3 py-3">Video</th>
                {TABLE_COLUMNS.filter((column) => columns.includes(column.key)).map((column) =>
                  <th scope="col" key={column.key} className="whitespace-nowrap px-3 py-3 text-right">{column.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((video) => (
                <tr key={video.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <a href={"https://www.youtube.com/watch?v=" + video.id} target="_blank" rel="noopener noreferrer"
                      className="flex max-w-[500px] items-center gap-3 text-slate-900 hover:text-blue-700">
                      {video.thumbnailUrl ? (
                        // The image source comes from the allowlisted YouTube thumbnail host.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={video.thumbnailUrl} alt="" loading="lazy" className="h-12 w-20 shrink-0 rounded-md object-cover" />
                      ) : <span aria-hidden="true" className="h-12 w-20 shrink-0 rounded-md bg-slate-100" />}
                      <span className="line-clamp-2 break-words font-medium">{video.title}</span>
                    </a>
                  </td>
                  {TABLE_COLUMNS.filter((column) => columns.includes(column.key)).map((column) =>
                    <td key={column.key} className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                      {column.key === "publishedAt" ? shortDate(video.publishedAt) : formatNumber(video.metrics[column.key])}
                    </td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loaded && filtered.length ? <p className="mt-3 text-xs text-slate-500">{filtered.length} video{filtered.length === 1 ? "" : "s"} shown for the selected period.</p> : null}
    </div>
  );
}

/** Shared chart/table structure for the two distinct screenshot sections. */
export function YoutubeVideoSectionView({
  kind, data, busy, locked, error,
}: {
  kind: "published" | "viewed";
  data: YoutubeVideoSection | null;
  busy: boolean;
  locked: boolean;
  error: string | null;
}) {
  const isPublished = kind === "published";
  const [selected, setSelected] = useState<Metric | "videos">("views");
  const totals: YoutubeVideoMetrics = data?.totals ?? { views: null, likes: null, dislikes: null, comments: null, shares: null };
  const columns = isPublished ? [...METRICS, { key: "videos" as const, label: "Videos" }] : [...METRICS];
  return (
    <section id={isPublished ? "published-videos" : "viewed-videos"} className="scroll-mt-36 space-y-4"
      aria-labelledby={isPublished ? "youtube-published-heading" : "youtube-viewed-heading"}>
      <h2 id={isPublished ? "youtube-published-heading" : "youtube-viewed-heading"} className="text-2xl font-semibold">
        {isPublished ? "Published videos" : "Viewed videos"}
      </h2>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
          {columns.map((column) =>
            <button key={column.key} type="button" onClick={() => setSelected(column.key)}
              disabled={locked || !data || busy}
              aria-pressed={selected === column.key}
              className={"min-w-[105px] rounded-xl border px-3 py-3 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 " + (
                selected === column.key ? "border-[#1565D8] bg-[#EAF4FF]" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              )}>
              <span className="block text-xl font-semibold tabular-nums">{column.key === "videos" ? formatNumber(data?.count) : formatNumber(totals[column.key])}</span>
              <span className="mt-1 block text-xs text-slate-600">{column.label}</span>
            </button>)}
        </div>
        {!locked && data && data.periodAvailable ? <VideoTrend daily={data.daily} selected={selected} kind={kind} uploads={data.videos} /> :
          <div role="status" className="flex min-h-[230px] flex-col items-center justify-center gap-3 text-center text-sm text-slate-500">
            <SearchX aria-hidden="true" className="h-9 w-9 text-slate-400" />
            <span>{locked ? "YouTube Analytics requires an active Social subscription." :
              busy ? "Loading verified video activity…" :
              error ?? (isPublished ? "No videos published in the selected period." : "No viewed-video analytics available for the selected period.")}</span>
          </div>}
      </div>
      {!locked ? (
        <VideoList kind={kind} items={data?.videos ?? []} loaded={!!data} limited={data?.limited ?? false} showDashboardAction={isPublished} />
      ) : null}
    </section>
  );
}
