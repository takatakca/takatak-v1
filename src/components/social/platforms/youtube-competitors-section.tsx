"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ChevronDown, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Columns3, Download, ExternalLink, ListVideo, Plus, Search, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import type { YoutubeCompetitorRow, YoutubeCompetitorVideo } from "@/lib/social/providers/youtube-competitors";

type Response = {
  ok?: boolean;
  message?: string;
  competitors?: YoutubeCompetitorRow[];
  limit?: number;
  sampledChannels?: number;
  retrievedAt?: string;
};
type Column = "views" | "subscribers" | "videos" | "likes" | "dislikes" | "averageComments";
const COLUMNS: { key: Column; label: string; title: string }[] = [
  { key: "views", label: "Video views", title: "Public channel lifetime views, not just the selected period" },
  { key: "subscribers", label: "Subscribers", title: "Current rounded public subscribers (when visible)" },
  { key: "videos", label: "Videos", title: "Current public video count" },
  { key: "likes", label: "Likes", title: "Likes on a sample of recent videos published during the selected period" },
  { key: "dislikes", label: "Dislikes", title: "Not publicly available for competitor videos" },
  { key: "averageComments", label: "Average comments", title: "Average per sampled public video published during the period" },
];
type PageSize = 5 | 10 | 25 | 50 | 100 | "all";
const PAGE_OPTIONS: PageSize[] = [5, 10, 25, 50, 100, "all"];
function fmt(number: number | null | undefined, decimals = 0): string {
  return number === null || number === undefined ? "—" :
    new Intl.NumberFormat("en-CA", { maximumFractionDigits: decimals }).format(number);
}
function quoteCsv(raw: string | number | boolean | null | undefined): string {
  let value = raw == null ? "" : String(raw);
  if (/^\s*[=+\-@]/.test(value)) value = "'" + value;
  return '"' + value.replace(/"/g, '""') + '"';
}
function download(rows: YoutubeCompetitorRow[], columns: Column[]) {
  const headers = ["Name", "Channel URL", ...columns.map((name) => COLUMNS.find((item) => item.key === name)?.label ?? name)];
  const body = [
    headers.map(quoteCsv).join(","),
    ...rows.map((row) => [row.name, row.url, ...columns.map((column) => row[column])].map(quoteCsv).join(",")),
  ].join("\r\n");
  const blob = new Blob(["\ufeff", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const element = document.createElement("a");
  element.href = url;
  element.download = "takatak-youtube-competitors.csv";
  document.body.appendChild(element);
  element.click();
  element.remove();
  URL.revokeObjectURL(url);
}
function displayDate(date: string) {
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed)
    : "Unavailable";
}
export function YoutubeCompetitorsSection({
  locked, exempt, canManage, billingHref, range,
}: {
  locked: boolean;
  exempt: boolean;
  canManage: boolean;
  billingHref: string;
  range: { start: string; end: string };
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Response | null>(null);
  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Column[]>(COLUMNS.map((column) => column.key));
  const [columnOpen, setColumnOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedRefs, setSelectedRefs] = useState<string[] | null>(null);
  const [draftRefs, setDraftRefs] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(5);
  const [sort, setSort] = useState<"subscribers" | "name">("subscribers");
  const [addOpen, setAddOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [videoList, setVideoList] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (locked) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: range.start, end: range.end });
      const response = await fetch("/api/social/youtube/competitors?" + params, {
        credentials: "same-origin", cache: "no-store", signal,
      });
      const result = await response.json() as Response;
      if (!signal?.aborted) setData(response.ok ? result : { ok: false, message: result.message ?? "Competitors could not be loaded." });
    } catch {
      if (!signal?.aborted) setData({ ok: false, message: "Competitor data could not be loaded. Try refreshing." });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [locked, range.start, range.end]);

  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal);
    return () => abort.abort();
  }, [load]);

  const allRows = data?.competitors ?? [];
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return allRows.filter((row) =>
      (selectedRefs === null || selectedRefs.includes(row.ref)) &&
      (!query || row.name.toLocaleLowerCase().includes(query)),
    ).sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (a.subscribers === null && b.subscribers === null) return a.name.localeCompare(b.name);
      if (a.subscribers === null) return 1;
      if (b.subscribers === null) return -1;
      return b.subscribers - a.subscribers;
    });
  }, [allRows, search, selectedRefs, sort]);
  const length = pageSize === "all" ? Math.max(1, filtered.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / length));
  const activePage = Math.min(page, totalPages);
  const rows = filtered.slice((activePage - 1) * length, activePage * length);
  const first = filtered.length ? (activePage - 1) * length + 1 : 0;
  const last = filtered.length ? first + rows.length - 1 : 0;
  const pickedVideoRows = filtered.flatMap((row) => row.recentVideos);
  const videoRows: YoutubeCompetitorVideo[] = pickedVideoRows
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  function openFilter() {
    setDraftRefs(selectedRefs ?? allRows.map((row) => row.ref));
    setFilterSearch("");
    setFilterOpen(true);
  }
  async function performWrite(method: "POST" | "PATCH" | "DELETE", payload: unknown, ref?: string) {
    if (busy || !canManage || locked) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const path = "/api/social/youtube/competitors" + (method === "DELETE" ? "?ref=" + encodeURIComponent(ref ?? "") : "");
      const response = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify(payload),
      });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setActionError(result.message ?? "The change could not be saved.");
        return;
      }
      setAddOpen(false);
      setConfirmRemove(null);
      setInput("");
      setNotice("Competitor list updated.");
      await load();
    } catch {
      setActionError("The request could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="competitors" className="scroll-mt-36 space-y-4" aria-labelledby="youtube-competitors-heading">
      <h2 id="youtube-competitors-heading" className="text-2xl font-semibold text-slate-950">Competitors</h2>
      {locked && !exempt ? (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-[#F6F9FF] p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Upgrade to explore your competitors</h3>
            <p className="mt-1 text-sm text-slate-600">Choose a TAKATAK Social plan to compare authorized public YouTube channel information.</p>
          </div>
          <Link href={billingHref} className="rounded-lg bg-[#1565D8] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0E4BA7]">View TAKATAK plans</Link>
        </div>
      ) : null}
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-medium">List of competitors</h3>
          <span title="Public YouTube channel metrics and bounded recent-video samples.">ⓘ</span>
          {!locked && data?.ok ? <span className="ml-auto text-xs text-slate-500">{allRows.length} / {data.limit ?? "—"} allowed</span> : null}
        </div>
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search competitors</span>
            <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search" disabled={locked}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-500 disabled:bg-slate-50" />
          </label>
          <div className="relative">
            <button type="button" disabled={locked || !data?.ok}
              onClick={() => filterOpen ? setFilterOpen(false) : openFilter()}
              aria-expanded={filterOpen}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              {selectedRefs === null ? "All competitors" : selectedRefs.length + " selected"}
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {filterOpen ? <div className="absolute right-0 top-full z-20 mt-2 w-[min(360px,90vw)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <button type="button" onClick={() => setDraftRefs([])}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Clear</button>
                <button type="button" onClick={() => { setSelectedRefs(draftRefs.length === allRows.length ? null : draftRefs); setFilterOpen(false); setPage(1); }}
                  className="rounded-lg bg-[#1565D8] px-3 py-2 text-sm font-semibold text-white">Apply</button>
              </div>
              <input placeholder="Search competitors" aria-label="Search competitor filter"
                value={filterSearch} onChange={(event) => setFilterSearch(event.target.value)}
                className="mt-3 w-full rounded-lg border border-slate-300 p-2 text-sm" />
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {allRows.filter((row) => row.name.toLowerCase().includes(filterSearch.toLowerCase())).map((row) =>
                  <label key={row.ref} className="flex cursor-pointer items-center justify-between gap-2 px-2 py-2 text-sm hover:bg-slate-50">
                    {row.name}
                    <input type="checkbox" checked={draftRefs.includes(row.ref)}
                      onChange={(event) => setDraftRefs((list) => event.target.checked ? [...list, row.ref] : list.filter((x) => x !== row.ref))}
                      className="h-4 w-4 accent-[#1565D8]" />
                  </label>)}
              </div>
            </div> : null}
          </div>
          <div className="relative">
            <button type="button" disabled={locked} aria-expanded={columnOpen} onClick={() => setColumnOpen((value) => !value)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50 disabled:opacity-50">
              <Columns3 size={17} /> Columns
            </button>
            {columnOpen && <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              {COLUMNS.map((column) => <label key={column.key} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-slate-800">
                <input type="checkbox" className="accent-[#1565D8]" checked={visibleColumns.includes(column.key)}
                  onChange={(event) => setVisibleColumns((previous) => event.target.checked ? [...previous, column.key] : previous.filter((name) => name !== column.key))} />
                {column.label}
              </label>)}
            </div>}
          </div>
          <button type="button" disabled={!data?.ok || !filtered.length || locked} onClick={() => download(filtered, visibleColumns)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50 disabled:opacity-50">
            <Download size={17} /> Download CSV
          </button>
          <button type="button" disabled={locked || !data?.ok} aria-expanded={videoList}
            onClick={() => setVideoList((value) => !value)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50 disabled:opacity-50">
            <ListVideo size={17} /> Video List (All)
          </button>
          <button type="button" disabled={!canManage || locked || busy || (data?.limit !== undefined && allRows.length >= data.limit)}
            onClick={() => { setAddOpen((value) => !value); setActionError(null); }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1565D8] px-4 text-sm font-semibold text-white hover:bg-[#0E4BA7] disabled:opacity-50">
            <Plus size={19} /> Add
          </button>
        </div>
        {addOpen ? <form onSubmit={(event) => { event.preventDefault(); void performWrite("POST", { channel: input }); }}
          className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">YouTube channel ID, URL or @handle
            <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={220}
              placeholder="@ExampleChannel" required
              className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" />
          </label>
          <button type="submit" disabled={busy || !input.trim()}
            className="h-11 rounded-lg bg-[#1565D8] px-5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Saving…" : "Save competitor"}
          </button>
          <button type="button" onClick={() => setAddOpen(false)} aria-label="Close add competitor form"
            className="rounded-lg p-2 text-slate-700"><X size={20} /></button>
        </form> : null}
        {actionError ? <p role="alert" className="text-sm text-rose-700">{actionError}</p> : null}
        {notice ? <p role="status" className="text-sm text-[#1565D8]">{notice}</p> : null}
        {data?.message ? <p role="alert" className="text-sm text-rose-700">{data.message}</p> : null}
        {loading && !data?.ok ? <p role="status" className="py-12 text-center text-sm text-slate-500">Loading public YouTube competitor data…</p> : null}
        {(!locked && data?.ok) ? <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[930px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    <button type="button" onClick={() => setSort("name")} className="hover:text-[#1565D8]">Name</button>
                  </th>
                  {COLUMNS.filter((column) => visibleColumns.includes(column.key)).map((column) =>
                    <th scope="col" key={column.key} className="px-3 py-2 text-right" title={column.title}>
                      <button type="button" onClick={() => column.key === "subscribers" && setSort("subscribers")} className="inline-flex items-center gap-1 hover:text-[#1565D8]">
                        {column.label}{column.key === "subscribers" ? <ArrowDown size={14} /> : null}
                      </button>
                    </th>)}
                  <th scope="col" className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) =>
                  <tr key={row.ref} className="rounded-xl bg-[#FBFCFE] text-slate-800">
                    <td className="rounded-l-lg border-y border-l border-slate-200 px-3 py-4">
                      <a href={row.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-medium hover:text-[#1565D8]">
                        {row.imageUrl ?
                          // Public YouTube thumbnail URL is host-allowlisted on server.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.imageUrl} alt="" loading="lazy" className="h-8 w-8 rounded-full object-cover" /> :
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm">{row.name.slice(0, 1)}</span>}
                        <span className="line-clamp-2">{row.name}</span><ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </td>
                    {COLUMNS.filter((column) => visibleColumns.includes(column.key)).map((column) =>
                      <td key={column.key} className="whitespace-nowrap border-y border-slate-200 px-3 py-4 text-right tabular-nums">
                        {fmt(row[column.key], column.key === "averageComments" ? 1 : 0)}
                      </td>)}
                    <td className="rounded-r-lg border-y border-r border-slate-200 px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button type="button" disabled={!canManage || busy} onClick={() => void performWrite("PATCH", { ref: row.ref, starred: !row.starred })}
                          aria-label={row.starred ? "Remove favorite " + row.name : "Favorite " + row.name}
                          title={row.starred ? "Remove favorite" : "Add favorite"}
                          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                          <Star size={18} fill={row.starred ? "#1565D8" : "none"} />
                        </button>
                        {confirmRemove === row.ref ? (
                          <div className="flex items-center gap-1">
                            <button type="button" disabled={busy} onClick={() => void performWrite("DELETE", null, row.ref)}
                              className="rounded-lg bg-rose-700 px-2 py-1 text-xs text-white">Confirm</button>
                            <button type="button" onClick={() => setConfirmRemove(null)}
                              className="rounded-lg px-2 py-1 text-xs text-slate-700">Cancel</button>
                          </div>
                        ) : (
                          <button type="button" disabled={!canManage || busy} title={"Remove " + row.name}
                            aria-label={"Remove " + row.name}
                            onClick={() => setConfirmRemove(row.ref)}
                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
          {!rows.length ? <p className="py-12 text-center text-sm text-slate-500">No competitors match the selected filters. Add a channel or update the filters.</p> : null}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4 text-sm text-slate-700">
            <label className="inline-flex items-center gap-2">
              Items per page:
              <select aria-label="Competitor rows per page" value={pageSize} onChange={(event) => {
                const value = event.target.value;
                setPageSize(value === "all" ? "all" : Number(value) as Exclude<PageSize, "all">);
                setPage(1);
              }} className="rounded-lg border border-slate-300 bg-white px-3 py-2">
                {PAGE_OPTIONS.map((option) => <option key={option} value={option}>{option === "all" ? "All" : option}</option>)}
              </select>
            </label>
            <span aria-live="polite" className="whitespace-nowrap">{first}–{last} of {filtered.length}</span>
            <button type="button" onClick={() => setPage(1)} disabled={activePage <= 1} aria-label="First page" className="rounded-full bg-slate-100 p-2 disabled:opacity-40"><ChevronFirst size={19} /></button>
            <button type="button" onClick={() => setPage(Math.max(1, activePage - 1))} disabled={activePage <= 1} aria-label="Previous page" className="rounded-full bg-slate-100 p-2 disabled:opacity-40"><ChevronLeft size={19} /></button>
            <button type="button" onClick={() => setPage(Math.min(totalPages, activePage + 1))} disabled={activePage >= totalPages} aria-label="Next page" className="rounded-full bg-slate-100 p-2 disabled:opacity-40"><ChevronRight size={19} /></button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={activePage >= totalPages} aria-label="Last page" className="rounded-full bg-slate-100 p-2 disabled:opacity-40"><ChevronLast size={19} /></button>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Public video views, subscribers and video totals are current lifetime channel figures, not historical period-specific totals.
            Likes and average comments are calculated only for up to 20 recent publicly available videos per sampled channel published in the chosen period.
            For quota protection, up to {data.sampledChannels ?? 0} channels are sampled per request; other values are shown as unavailable.
            Competitor dislikes are private on YouTube.
          </p>
          {videoList ? <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="mb-3 text-base font-semibold">Recent public videos from selected competitors</h4>
            {videoRows.length ? <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2">Video</th><th className="px-3 py-2">Channel</th><th className="px-3 py-2">Published</th><th className="px-3 py-2 text-right">Views</th>
                </tr></thead>
                <tbody>{videoRows.map((video) =>
                  <tr key={video.url} className="border-b border-slate-100">
                    <td className="px-3 py-2"><a href={video.url} target="_blank" rel="noopener noreferrer" className="text-[#1565D8] hover:underline">{video.title}</a></td>
                    <td className="px-3 py-2">{video.channelName}</td>
                    <td className="whitespace-nowrap px-3 py-2">{displayDate(video.publishedAt)}</td>
                    <td className="px-3 py-2 text-right">{fmt(video.views)}</td>
                  </tr>)}</tbody>
              </table>
            </div> : <p className="py-4 text-sm text-slate-500">No public video samples are available for these channels and dates.</p>}
          </div> : null}
        </> : null}
      </div>
    </section>
  );
}
