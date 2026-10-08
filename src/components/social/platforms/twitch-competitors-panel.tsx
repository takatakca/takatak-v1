"use client";

import { Check, Columns3, Download, Plus, Search, Video } from "lucide-react";
import { useEffect, useState } from "react";

import { toClientSocialImageUrl } from "@/lib/social/media/remote-image";

type CompetitorVideo = {
  title: string;
  publishedOn: string;
  views: number;
  durationSeconds: number;
  url: string | null;
  channel: string;
};

type CompetitorRow = {
  ref: string;
  name: string;
  login: string;
  imageUrl: string | null;
  videos: number | null;
  views: number | null;
  durationSeconds: number | null;
  items: CompetitorVideo[];
};

function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatMinutes(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function periodLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function EmptySearch() {
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

export function TwitchCompetitorsPanel({
  start,
  end,
  canManage,
}: {
  start: string;
  end: string;
  canManage: boolean;
}) {
  const [rows, setRows] = useState<CompetitorRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [videoList, setVideoList] = useState(false);
  const [adding, setAdding] = useState(false);
  const [login, setLogin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [showVideos, setShowVideos] = useState(true);
  const [showViews, setShowViews] = useState(true);
  const [showDuration, setShowDuration] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ start, end });
    fetch(`/api/social/twitch/competitors?${params.toString()}`, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          ok?: boolean;
          message?: string;
          competitors?: CompetitorRow[];
        };
        if (!response.ok || body.ok === false) {
          throw new Error(body.message || "Twitch competitors could not be loaded.");
        }
        setRows(body.competitors ?? []);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Twitch competitors could not be loaded.");
      });
    return () => controller.abort();
  }, [start, end, reloadKey]);

  const filtered = rows.filter((row) => {
    const haystack = `${row.name} ${row.login}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all" || row.ref === filter;
    return matchesQuery && matchesFilter;
  });
  const videos = filtered.flatMap((row) => row.items);

  async function addCompetitor() {
    if (!canManage || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/social/twitch/competitors", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ login }),
      });
      const body = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || body.ok === false) {
        throw new Error(body.message || "That Twitch channel could not be added.");
      }
      setLogin("");
      setAdding(false);
      setReloadKey((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That Twitch channel could not be added.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCompetitor(ref: string) {
    if (!canManage || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/social/twitch/competitors?ref=${encodeURIComponent(ref)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const body = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || body.ok === false) {
        throw new Error(body.message || "That competitor could not be removed.");
      }
      setReloadKey((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That competitor could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    const lines = videoList
      ? [
          ["Channel", "Title", "Date", "Views", "Duration"],
          ...videos.map((item) => [
            item.channel,
            item.title,
            item.publishedOn,
            String(item.views),
            formatMinutes(item.durationSeconds),
          ]),
        ]
      : [
          ["Channel", "Username", ...(showVideos ? ["Videos"] : []), ...(showViews ? ["Views"] : []), ...(showDuration ? ["Duration"] : [])],
          ...filtered.map((row) => [
            row.name,
            row.login,
            ...(showVideos ? [row.videos == null ? "" : String(row.videos)] : []),
            ...(showViews ? [row.views == null ? "" : String(row.views)] : []),
            ...(showDuration ? [formatMinutes(row.durationSeconds)] : []),
          ]),
        ];
    const csv = lines
      .map((line) =>
        line
          .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell))
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `twitch-competitors-${start}-to-${end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[14px] border border-[#E6E8EC] bg-white px-5 py-5 sm:px-6">
      <h3 className="text-[16px] font-medium text-[#20242A]">List of competitors</h3>
      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA1A9]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search competitors"
            className="h-10 w-full rounded-[8px] border border-[#E3E6EA] bg-white pl-9 pr-3 text-[14px] outline-none"
          />
        </label>
        <select
          aria-label="Competitor filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="h-10 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] text-[#505761]"
        >
          <option value="all">All competitors</option>
          {rows.map((row) => (
            <option key={row.ref} value={row.ref}>
              {row.login || row.name}
            </option>
          ))}
        </select>
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
                  ["Videos", showVideos, setShowVideos],
                  ["Views", showViews, setShowViews],
                  ["Duration", showDuration, setShowDuration],
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
        <button
          type="button"
          aria-pressed={videoList}
          onClick={() => setVideoList((current) => !current)}
          className={`inline-flex h-10 items-center gap-2 rounded-[8px] border px-3 text-[13px] ${
            videoList
              ? "border-[#D7E58A] bg-[#F4F9D8] text-[#3D4A12]"
              : "border-[#E3E6EA] bg-white text-[#505761]"
          }`}
        >
          <Video className="h-4 w-4" />
          Video List (All)
        </button>
        <button
          type="button"
          onClick={() => setAdding((current) => !current)}
          disabled={!canManage}
          className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-[#111111] px-3 text-[13px] font-medium text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {adding ? (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void addCompetitor();
          }}
        >
          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="Twitch username"
            aria-label="Twitch username"
            className="h-10 min-w-0 flex-1 rounded-[8px] border border-[#E3E6EA] px-3 text-[14px] outline-none"
          />
          <button
            type="submit"
            disabled={busy || !login.trim()}
            className="h-10 rounded-[8px] bg-[#9146FF] px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add competitor"}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {videoList ? (
        videos.length === 0 ? (
          <EmptySearch />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[13px] text-[#30343A]">
              <thead>
                <tr className="border-b border-[#EEF0F2] text-[#8B939C]">
                  <th className="py-2 pr-4 font-medium">Channel</th>
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Views</th>
                  <th className="py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((item) => (
                  <tr key={`${item.channel}-${item.publishedOn}-${item.title}`} className="border-b border-[#F4F6F8]">
                    <td className="py-3 pr-4">{item.channel}</td>
                    <td className="py-3 pr-4">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {item.title}
                        </a>
                      ) : (
                        item.title
                      )}
                    </td>
                    <td className="py-3 pr-4">{periodLabel(item.publishedOn)}</td>
                    <td className="py-3 pr-4">{formatCount(item.views)}</td>
                    <td className="py-3">{formatMinutes(item.durationSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : filtered.length === 0 ? (
        <EmptySearch />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px] text-[#30343A]">
            <thead>
              <tr className="border-b border-[#EEF0F2] text-[#8B939C]">
                <th className="py-2 pr-4 font-medium">Channel</th>
                {showVideos ? <th className="py-2 pr-4 font-medium">Videos</th> : null}
                {showViews ? <th className="py-2 pr-4 font-medium">Views</th> : null}
                {showDuration ? <th className="py-2 pr-4 font-medium">Duration</th> : null}
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.ref} className="border-b border-[#F4F6F8]">
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-2">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={toClientSocialImageUrl(row.imageUrl) ?? row.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded-[6px] object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#9146FF] text-[12px] font-semibold text-white">
                          {(row.login || row.name).slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span>
                        <span className="block font-medium">{row.name}</span>
                        <span className="block text-[12px] text-[#8B939C]">{row.login}</span>
                      </span>
                    </span>
                  </td>
                  {showVideos ? <td className="py-3 pr-4">{formatCount(row.videos)}</td> : null}
                  {showViews ? <td className="py-3 pr-4">{formatCount(row.views)}</td> : null}
                  {showDuration ? <td className="py-3 pr-4">{formatMinutes(row.durationSeconds)}</td> : null}
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      disabled={!canManage || busy}
                      onClick={() => void removeCompetitor(row.ref)}
                      className="text-[13px] text-[#8B939C] hover:text-[#20242A] disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
