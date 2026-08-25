"use client";

import { useEffect, useId, useState } from "react";

import {
  SocialSummaryChart,
  type ChartPoint,
} from "@/components/social/analytics/social-summary-chart";
import {
  SUMMARY_CHART_SERIES,
  SUMMARY_TOTAL_CARD_BG,
  formatMetric,
  type MetricValue,
} from "@/components/social/analytics/social-summary-tokens";

export type PlatformCardItem = {
  key: string;
  label: string;
  color: string;
  value: MetricValue;
};

export function PlatformMetricCards({
  items,
  activeKey,
  onActiveChange,
  formatValue,
}: {
  items: PlatformCardItem[];
  activeKey: string | null;
  onActiveChange: (key: string | null) => void;
  formatValue?: (value: number) => string;
}) {
  const format =
    formatValue ??
    ((value: number) =>
      new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(
        value,
      ));

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onActiveChange(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onActiveChange]);

  return (
    <div className="grid w-full gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(156px,1fr))]">
      {items.map((item) => {
        const selected = item.key === activeKey;
        const display = formatMetric(item.value, format);

        return (
          <button
            key={item.key}
            type="button"
            data-platform-card={item.key}
            aria-label={`${item.label}: ${display}`}
            onMouseEnter={() => onActiveChange(item.key)}
            onMouseLeave={() => onActiveChange(null)}
            onFocus={() => onActiveChange(item.key)}
            onBlur={() => onActiveChange(null)}
            className={`relative flex h-[92px] w-full flex-col items-center justify-center rounded-[10px] px-3 py-3 text-center text-white transition outline-none focus-visible:ring-2 focus-visible:ring-[#566DF1] focus-visible:ring-offset-2 ${
              selected ? "brightness-[0.97]" : "hover:brightness-[0.97]"
            }`}
            style={{ backgroundColor: item.color }}
          >
            {selected ? (
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 flex min-w-[118px] -translate-x-1/2 items-center justify-between gap-6 rounded-[8px] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#111827] shadow-[0_4px_14px_rgba(15,23,42,0.14)]"
              >
                <span>{item.label}</span>
                <span>{display}</span>
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-white"
                />
              </span>
            ) : null}

            <p className="text-[24px] font-semibold leading-none tracking-tight">
              {display}
            </p>
            <p className="mt-2.5 w-full truncate px-1 text-[12px] font-medium leading-4 opacity-95">
              {item.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function MetricSection({
  title,
  total,
  cards,
  points,
  seriesLabel,
  seriesColor = SUMMARY_CHART_SERIES,
  accent,
  formatValue,
  showMarkers = false,
}: {
  title: string;
  total: MetricValue;
  cards: PlatformCardItem[];
  points: ChartPoint[] | ((activeKey: string | null) => ChartPoint[]);
  seriesLabel: string;
  seriesColor?: string;
  accent?: string;
  formatValue?: (value: number) => string;
  showMarkers?: boolean;
}) {
  const titleId = useId();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const activeCard = cards.find((card) => card.key === activeKey);
  const format =
    formatValue ??
    ((value: number) =>
      new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(
        value,
      ));
  const chartPoints =
    typeof points === "function" ? points(activeKey) : points;

  return (
    <section aria-labelledby={titleId} className="space-y-4">
      <div
        className="relative flex min-h-[88px] max-w-[280px] items-start justify-between overflow-hidden rounded-[10px] px-5 py-4"
        style={{ backgroundColor: SUMMARY_TOTAL_CARD_BG }}
      >
        {accent ? (
          <span
            aria-hidden="true"
            className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
            style={{ background: accent }}
          />
        ) : null}

        <p id={titleId} className="text-[13px] font-medium text-[#5F6770]">
          {title}
        </p>

        <p className="text-[34px] font-semibold leading-none tracking-tight text-[#20242A]">
          {formatMetric(total, format)}
        </p>
      </div>

      <PlatformMetricCards
        items={cards}
        activeKey={activeKey}
        onActiveChange={setActiveKey}
        formatValue={format}
      />

      <SocialSummaryChart
        points={chartPoints}
        seriesLabel={activeCard?.label ?? seriesLabel}
        seriesColor={activeCard?.color ?? seriesColor}
        showMarkers={showMarkers}
      />
    </section>
  );
}

export function AdMetricSection({
  title,
  total,
  cards,
  points,
  seriesLabel,
  seriesColor = SUMMARY_CHART_SERIES,
  formatValue,
}: {
  title: string;
  total: MetricValue;
  cards: PlatformCardItem[];
  points: ChartPoint[] | ((activeKey: string | null) => ChartPoint[]);
  seriesLabel: string;
  seriesColor?: string;
  formatValue?: (value: number) => string;
}) {
  const titleId = useId();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeCard = cards.find((card) => card.key === activeKey);
  const format =
    formatValue ??
    ((value: number) =>
      new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(
        value,
      ));
  const chartPoints =
    typeof points === "function" ? points(activeKey) : points;

  return (
    <section aria-labelledby={titleId} className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div
          className="flex min-h-[88px] min-w-[200px] flex-1 items-start justify-between rounded-[10px] px-5 py-4 lg:max-w-[280px]"
          style={{ backgroundColor: SUMMARY_TOTAL_CARD_BG }}
        >
          <p id={titleId} className="text-[13px] font-medium text-[#5F6770]">
            {title}
          </p>
          <p className="text-[34px] font-semibold leading-none tracking-tight text-[#20242A]">
            {formatMetric(total, format)}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap gap-2.5 lg:flex-nowrap">
          {cards.map((item) => {
            const selected = item.key === activeKey;
            const display = formatMetric(item.value, format);

            return (
              <button
                key={item.key}
                type="button"
                aria-label={`${item.label}: ${display}`}
                onMouseEnter={() => setActiveKey(item.key)}
                onMouseLeave={() => setActiveKey(null)}
                onFocus={() => setActiveKey(item.key)}
                onBlur={() => setActiveKey(null)}
                className={`relative inline-flex h-[92px] min-w-[140px] flex-1 flex-col items-center justify-center rounded-[10px] px-3 py-3 text-center text-white outline-none transition focus-visible:ring-2 focus-visible:ring-[#566DF1] focus-visible:ring-offset-2 ${
                  selected ? "brightness-[0.97]" : "hover:brightness-[0.97]"
                }`}
                style={{ backgroundColor: item.color }}
              >
                {selected ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 flex min-w-[118px] -translate-x-1/2 items-center justify-between gap-6 rounded-[8px] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#111827] shadow-[0_4px_14px_rgba(15,23,42,0.14)]"
                  >
                    <span>{item.label}</span>
                    <span>{display}</span>
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-white"
                    />
                  </span>
                ) : null}

                <span className="text-[24px] font-semibold leading-none">
                  {display}
                </span>
                <span className="mt-2.5 text-[12px] font-medium opacity-95">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <SocialSummaryChart
        points={chartPoints}
        seriesLabel={activeCard?.label ?? seriesLabel}
        seriesColor={activeCard?.color ?? seriesColor}
        showMarkers={false}
      />
    </section>
  );
}
