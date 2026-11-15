"use client";

import { useEffect, useRef, useState } from "react";

import type { MetaAdCreativeReportRow } from "@/lib/social/analytics/meta-ad-creative-mapping";
import { makeMetaCreativeCsv } from "@/lib/social/analytics/meta-creative-export";

type CreativeReportResponse = {
  ok?: boolean;
  connected?: boolean;
  message?: string;
  status?: "ready" | "partial" | "unavailable";
  currency?: string | null;
  notice?: string | null;
  rows?: MetaAdCreativeReportRow[];
};

function amount(value: number | null, currency?: string | null, isPercent = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const formatted = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 }).format(value);
  return isPercent ? `${formatted}%` : currency ? `${formatted} ${currency}` : formatted;
}

export function MetaAdCreativeReportPanel({ start, end }: { start: string; end: string }) {
  const [report, setReport] = useState<CreativeReportResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    inflight.current?.abort();
    inflight.current = null;
    setReport(null);
    setStatus("idle");
    setError(null);
    return () => {
      inflight.current?.abort();
      inflight.current = null;
    };
  }, [start, end]);

  async function load() {
    if (status === "loading") return;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setStatus("loading");
    setError(null);
    try {
      const query = new URLSearchParams({ start, end });
      const response = await fetch(`/api/social/meta-ads/creatives?${query.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await response.json() as CreativeReportResponse;
      if (!response.ok || body.ok !== true) throw new Error(body.message ?? "Ad-level results unavailable.");
      if (body.connected === false) throw new Error("Select and connect your Meta ad account first.");
      if (controller.signal.aborted) return;
      setReport(body);
      setStatus("loaded");
    } catch (reason) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Ad-level report could not be loaded.");
    } finally {
      if (inflight.current === controller) inflight.current = null;
    }
  }

  const currency = report?.currency && /^[A-Z]{3}$/.test(report.currency) ? report.currency : null;
  const rows = report?.rows ?? [];
  function downloadCsv() {
    if (status !== "loaded" || !report || rows.length === 0 || !report.status) return;
    const data = makeMetaCreativeCsv({
      rows,
      currency,
      start,
      end,
      status: report.status,
    });
    const blob = new Blob(["\uFEFF", data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = `takatak-meta-creatives-${start}-${end}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }
  return (
    <section className="rounded-xl border border-[#DCE7F7] bg-white p-5 sm:p-6" aria-labelledby="meta-ad-creatives-title">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
        TAKATAK Creative Intelligence · ad-level preview
      </p>
      <h3 id="meta-ad-creatives-title" className="mt-2 text-lg font-semibold text-[#10213A]">
        Individual ad &amp; creative metadata
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">
        Read-only insights for individual Meta ads, joined to available creative IDs and formats.
        One row per ad, not one row per independent image or video variant. No account-to-account pooling,
        no profitability estimates, and no automatic campaigns or charges.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={load} disabled={status === "loading"}
          className="rounded-lg bg-[#1455D9] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">
          {status === "loading" ? "Loading Meta ad data…" : status === "loaded" ? "Refresh ad-level report" : "Analyze ad-level performance"}
        </button>
        <button type="button" onClick={downloadCsv} disabled={status !== "loaded" || rows.length === 0}
          className="rounded-lg border border-[#C9D8F0] bg-white px-4 py-2.5 text-sm font-medium text-[#10213A] disabled:cursor-not-allowed disabled:opacity-50">
          Export CSV (loaded ads only)
        </button>
        <p className="text-xs text-[#64748B]">On-demand only · maximum 31 days · bounded API pagination</p>
      </div>
      {status === "error" && error && <p role="alert" className="mt-3 text-sm text-[#B42318]">{error}</p>}
      {status === "loaded" && report && (
        <>
          <p role="status" className="mt-4 text-sm text-[#475569]">
            {report.status === "ready" ? "Meta report received." : report.status === "partial" ? "Partial Meta report." : "Report unavailable."}
            {" "}{report.notice}
          </p>
          {rows.length === 0 ? (
            <p className="mt-3 rounded-lg bg-[#F8FAFC] p-4 text-sm text-[#64748B]">
              No confirmed ad-level results for this selected account and reporting period.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-[#E2E8F0]">
              <table className="w-full min-w-[830px] text-left text-xs">
                <caption className="sr-only">Ad-level performance, ordered by reported spend</caption>
                <thead className="bg-[#F8FAFC] text-[#475569]">
                  <tr>
                    {["Ad", "Creative name", "Format", "Impressions", "CTR", "CPC", "CPM", "Spent"].map((heading) =>
                      <th key={heading} scope="col" className="p-3 font-semibold">{heading}</th>)}
                  </tr>
                </thead>
                <tbody className="text-[#10213A]">
                  {rows.slice(0, 50).map((row) => (
                    <tr key={row.adId} className="border-t border-[#E2E8F0]">
                      <th scope="row" className="p-3 font-medium">{row.adName}</th>
                      <td className="p-3">{row.creativeName ?? (row.creativeId ? `ID ${row.creativeId}` : "Unavailable")}</td>
                      <td className="p-3">{row.creativeType ?? "Unspecified"}</td>
                      <td className="p-3">{amount(row.impressions)}</td>
                      <td className="p-3">{amount(row.ctr, null, true)}</td>
                      <td className="p-3">{amount(row.cpc, currency)}</td>
                      <td className="p-3">{amount(row.cpm, currency)}</td>
                      <td className="p-3">{amount(row.spend, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-[#64748B]">
            No dynamic creative asset-level breakdowns are inferred. Ad-level metrics depend on the
            account’s objectives, attribution, placements and Meta reporting permissions.
            This preview shows at most 50 ads per request.
          </p>
        </>
      )}
    </section>
  );
}
