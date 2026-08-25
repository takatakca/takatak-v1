"use client";

import { useCallback, useEffect, useState } from "react";

function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString();
}

type Capability = {
  status: string;
  reason: string;
  pagesSearch: string;
  publicMetadata: string;
  publicContent: string;
  graphApiVersion: string;
};

type CompetitorRow = {
  publicRef: string;
  displayLabel: string | null;
  pageName: string | null;
  profileImageUrl: string | null;
  category: string | null;
  availability: string;
  lastSuccessAt: string | null;
  lastErrorMessage: string | null;
  latestSnapshot: {
    snapshotDate: string;
    followerCount: number | null;
    publicPostCount: number | null;
    publicReactionsSum: number | null;
    publicCommentsSum: number | null;
    publicSharesSum: number | null;
    availability: string;
  } | null;
  followerDelta: number | null;
};

type Benchmark = {
  selectedPage: {
    label: string;
    followerCount: number | null;
    asOf: string | null;
  };
  competitors: Array<{
    publicRef: string;
    label: string;
    followerCount: number | null;
    followerDelta: number | null;
    snapshotDate: string | null;
    availability: string;
  }>;
  rankingAllowed: boolean;
  rankingNotice: string | null;
  unsupportedComparisons: string[];
};

const METRIC_TOOLTIPS: Record<string, string> = {
  followers:
    "Public follower/fan count returned by Meta for this Page. Not private reach or impressions.",
  followerDelta:
    "Change between the two most recent confirmed public snapshots stored by Takatak.",
  posts:
    "Count of publicly listed feed posts when Page Public Content Access permits it. Otherwise unavailable.",
  reactions:
    "Sum of visible public reaction counts on probed feed posts when Meta permits. Never inferred.",
  comments:
    "Sum of visible public comment counts on probed feed posts when Meta permits.",
  shares:
    "Sum of visible public share counts on probed feed posts when Meta permits.",
};

export function FacebookCompetitorsPanel({ liveMode }: { liveMode: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capability, setCapability] = useState<Capability | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [input, setInput] = useState("");
  const [displayLabel, setDisplayLabel] = useState("");
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!liveMode) {
      setCapability(null);
      setCompetitors([]);
      setBenchmark(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/social/facebook/competitors", {
        method: "GET",
        credentials: "same-origin",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        message?: string;
        capability?: Capability;
        competitors?: CompetitorRow[];
        benchmark?: Benchmark;
      };
      if (!response.ok || body.ok === false) {
        setError(body.message ?? "Competitors could not be loaded.");
        return;
      }
      setCapability(body.capability ?? null);
      setCompetitors(body.competitors ?? []);
      setBenchmark(body.benchmark ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Competitors could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [liveMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const unavailable =
    capability &&
    capability.status !== "ready" &&
    capability.status !== "unknown";

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setBusyRef("add");
    try {
      const response = await fetch("/api/social/facebook/competitors", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          displayLabel: displayLabel.trim() || undefined,
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || body.ok === false) {
        setError(body.message ?? "Competitor could not be added.");
        return;
      }
      setInput("");
      setDisplayLabel("");
      setNotice("Competitor added. Public snapshot stored when Meta returned fields.");
      await load();
    } finally {
      setBusyRef(null);
    }
  }

  async function onRemove(publicRef: string) {
    setBusyRef(publicRef);
    setError(null);
    try {
      const response = await fetch(
        `/api/social/facebook/competitors/${encodeURIComponent(publicRef)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const body = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || body.ok === false) {
        setError(body.message ?? "Competitor could not be removed.");
        return;
      }
      setConfirmRemove(null);
      await load();
    } finally {
      setBusyRef(null);
    }
  }

  async function onRename(publicRef: string, label: string) {
    setBusyRef(publicRef);
    try {
      await fetch(
        `/api/social/facebook/competitors/${encodeURIComponent(publicRef)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayLabel: label }),
        },
      );
      await load();
    } finally {
      setBusyRef(null);
    }
  }

  async function onRefresh(publicRef: string) {
    setBusyRef(publicRef);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/social/facebook/competitors/${encodeURIComponent(publicRef)}`,
        { method: "POST", credentials: "same-origin" },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        message?: string;
        notice?: string;
      };
      if (!response.ok || body.ok === false) {
        setError(body.message ?? "Refresh could not be queued.");
        return;
      }
      setNotice(body.notice ?? "Refresh queued.");
    } finally {
      setBusyRef(null);
    }
  }

  if (!liveMode) {
    return (
      <div id="fb-competitors" className="scroll-mt-[220px] space-y-4">
        <h2 className="text-[22px] font-semibold text-[#20242A]">Competitors</h2>
        <section className="rounded-[14px] border border-[#e8eaed] bg-white px-5 py-6">
          <p className="text-sm text-[#6b7280]">
            Connect a Facebook Page to track competitors through Meta’s Graph API
            only. Takatak never scrapes Facebook pages.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div id="fb-competitors" className="scroll-mt-[220px] space-y-4">
      <h2 className="text-[22px] font-semibold text-[#20242A]">Competitors</h2>

      {loading ? (
        <p className="text-sm text-[#6b7280]" aria-live="polite">
          Loading competitor tracking…
        </p>
      ) : null}

      {error ? (
        <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-[10px] border border-[#d7e3ff] bg-[#f5f8ff] px-4 py-3 text-sm text-[#30343a]">
          {notice}
        </div>
      ) : null}

      {unavailable ? (
        <section className="rounded-[14px] border border-[#f0d48a] bg-[#fff8e6] px-5 py-6">
          <h3 className="text-[18px] font-semibold text-[#20242A]">
            Competitor tracking unavailable
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#6b5400]">
            {capability?.reason}
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[#6b5400]">
            <li>No browser scraping or unofficial collection.</li>
            <li>
              Competitor reach, impressions, demographics, and clicks stay
              unsupported.
            </li>
            <li>
              Status: {capability?.status} · pages/search:{" "}
              {capability?.pagesSearch} · public metadata:{" "}
              {capability?.publicMetadata}
            </li>
          </ul>
        </section>
      ) : null}

      {!unavailable ? (
        <>
          <section className="rounded-[14px] border border-[#e8eaed] bg-white px-5 py-6">
            <h3 className="text-[18px] font-semibold text-[#20242A]">
              How competitor tracking works
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b7280]">
              Add a public Facebook Page URL or username. Takatak resolves it
              through Meta Graph API endpoints only, stores dated public
              snapshots, and compares equivalent confirmed metrics. Private Page
              insights are never claimed for competitors.
            </p>

            <form onSubmit={onAdd} className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px_auto]">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-[#6B7280]">
                <span>Facebook Page URL or username</span>
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="https://www.facebook.com/example or example"
                  className="h-11 rounded-[10px] border border-[#d7dbe0] px-3 text-sm text-[#30343a]"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-[#6B7280]">
                <span>Local display label (optional)</span>
                <input
                  value={displayLabel}
                  onChange={(event) => setDisplayLabel(event.target.value)}
                  placeholder="Nickname"
                  className="h-11 rounded-[10px] border border-[#d7dbe0] px-3 text-sm text-[#30343a]"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={busyRef === "add"}
                  className="inline-flex h-11 items-center rounded-[10px] bg-[#20242A] px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busyRef === "add" ? "Adding…" : "Add competitor"}
                </button>
              </div>
            </form>
          </section>

          {competitors.length === 0 ? (
            <section className="rounded-[14px] border border-dashed border-[#e1e4e7] bg-[#fafbfc] px-5 py-10 text-center">
              <p className="text-[16px] font-semibold text-[#30343a]">
                No competitors tracked yet
              </p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6b7280]">
                Add a public Facebook Page to start dated public snapshots. If
                Meta later revokes access, prior confirmed snapshots stay visible
                as stale.
              </p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-[14px] border border-[#e8eaed] bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fafbfc] text-xs uppercase tracking-wide text-[#6b7280]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Competitor</th>
                    <th
                      className="px-4 py-3 font-semibold"
                      title={METRIC_TOOLTIPS.followers}
                    >
                      Followers
                    </th>
                    <th
                      className="px-4 py-3 font-semibold"
                      title={METRIC_TOOLTIPS.followerDelta}
                    >
                      Δ followers
                    </th>
                    <th className="px-4 py-3 font-semibold">Snapshot</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((row) => {
                    const label =
                      row.displayLabel || row.pageName || "Competitor";
                    return (
                      <tr key={row.publicRef} className="border-t border-[#eef0f2]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 overflow-hidden rounded-full bg-[#eef0f2]">
                              {row.profileImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={row.profileImageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div>
                              <p className="font-semibold text-[#20242A]">
                                {label}
                              </p>
                              <p className="text-xs text-[#6b7280]">
                                {row.category ?? "Category —"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#30343a]">
                          {formatMetric(row.latestSnapshot?.followerCount)}
                        </td>
                        <td className="px-4 py-3">
                          {formatMetric(row.followerDelta)}
                        </td>
                        <td className="px-4 py-3 text-[#6b7280]">
                          {row.latestSnapshot?.snapshotDate ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-medium text-[#505761]">
                            {row.availability}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busyRef === row.publicRef}
                              onClick={() => void onRefresh(row.publicRef)}
                              className="text-xs font-semibold text-[#566DF1]"
                            >
                              Refresh
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = window.prompt(
                                  "Local display label",
                                  row.displayLabel ?? row.pageName ?? "",
                                );
                                if (next != null) {
                                  void onRename(row.publicRef, next);
                                }
                              }}
                              className="text-xs font-semibold text-[#566DF1]"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(row.publicRef)}
                              className="text-xs font-semibold text-[#b42318]"
                            >
                              Remove
                            </button>
                          </div>
                          {confirmRemove === row.publicRef ? (
                            <div className="mt-2 rounded-[8px] border border-[#f3d1d1] bg-[#fff5f5] p-2 text-xs text-[#7a1f1f]">
                              Remove this competitor track? Historical snapshots
                              remain stored for audit, but it leaves the active
                              list.
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void onRemove(row.publicRef)}
                                  className="font-semibold"
                                >
                                  Confirm remove
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemove(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {benchmark ? (
            <section className="rounded-[14px] border border-[#e8eaed] bg-white px-5 py-6">
              <h3 className="text-[18px] font-semibold text-[#20242A]">
                Equivalent public follower comparison
              </h3>
              <p className="mt-1 text-sm text-[#6b7280]">
                Selected Page vs competitors — confirmed public follower counts
                only. Unsupported:{" "}
                {benchmark.unsupportedComparisons.join(", ")}.
              </p>
              {!benchmark.rankingAllowed && benchmark.rankingNotice ? (
                <p className="mt-3 rounded-[10px] border border-[#f0d48a] bg-[#fff8e6] px-4 py-3 text-sm text-[#6b5400]">
                  {benchmark.rankingNotice}
                </p>
              ) : null}
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-[10px] bg-[#f5f8ff] px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#566DF1]">
                      Selected Page
                    </p>
                    <p className="font-semibold text-[#20242A]">
                      {benchmark.selectedPage.label}
                    </p>
                    <p className="text-xs text-[#6b7280]">
                      As of {benchmark.selectedPage.asOf ?? "—"}
                    </p>
                  </div>
                  <p
                    className="text-[22px] font-semibold text-[#20242A]"
                    title={METRIC_TOOLTIPS.followers}
                  >
                    {formatMetric(benchmark.selectedPage.followerCount)}
                  </p>
                </div>
                {benchmark.competitors.map((row) => {
                  const selected = benchmark.selectedPage.followerCount;
                  const width =
                    selected != null &&
                    selected > 0 &&
                    row.followerCount != null
                      ? Math.min(
                          100,
                          Math.round((row.followerCount / selected) * 100),
                        )
                      : 0;
                  return (
                    <div key={row.publicRef} className="rounded-[10px] border border-[#eef0f2] px-4 py-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#9aa1a9]">
                            Competitor · {row.availability}
                          </p>
                          <p className="font-semibold text-[#20242A]">
                            {row.label}
                          </p>
                          <p className="text-xs text-[#6b7280]">
                            Snapshot {row.snapshotDate ?? "—"}
                          </p>
                        </div>
                        <p className="text-[18px] font-semibold text-[#20242A]">
                          {formatMetric(row.followerCount)}
                        </p>
                      </div>
                      {row.followerCount != null && selected != null ? (
                        <div className="h-2 overflow-hidden rounded-full bg-[#eef0f2]">
                          <div
                            className="h-full rounded-full bg-[#8B95F4]"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-[#9aa1a9]">
                          Chart omitted — non-equivalent or missing confirmed
                          values.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
