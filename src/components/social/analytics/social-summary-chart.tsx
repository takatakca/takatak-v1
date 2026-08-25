"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  SUMMARY_AXIS,
  SUMMARY_CHART_SERIES,
  displayDate,
  displayDateShort,
  formatMetric,
  type MetricValue,
} from "@/components/social/analytics/social-summary-tokens";

export type ChartPoint = {
  date: string;
  value: MetricValue;
};

type ActivePoint = {
  index: number;
  x: number;
  y: number;
};

const PAD = { top: 12, right: 8, bottom: 34, left: 40 };
const HEIGHT = 240;

function resolveValue(value: MetricValue) {
  return value.kind === "value" ? value.value : null;
}

function yMaxFor(values: Array<number | null>) {
  const numeric = values.filter((value): value is number => value != null);
  const peak = Math.max(...numeric, 0);
  if (peak <= 10) {
    return 10;
  }

  const padded = peak * 1.1;
  const power = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / power;

  if (normalized <= 1) return power;
  if (normalized <= 2) return 2 * power;
  if (normalized <= 5) return 5 * power;
  return 10 * power;
}

export function SocialSummaryChart({
  points,
  seriesLabel,
  seriesColor = SUMMARY_CHART_SERIES,
  showMarkers = false,
}: {
  points: ChartPoint[];
  seriesLabel: string;
  seriesColor?: string;
  /** Account charts use Metricool day dots; Posts/Ads charts stay clean lines. */
  showMarkers?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<ActivePoint | null>(null);

  useEffect(() => {
    const node = svgRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 0) {
        setWidth(next);
      }
    });

    observer.observe(node);
    setWidth(node.clientWidth || 720);

    return () => observer.disconnect();
  }, []);

  const plotWidth = Math.max(width - PAD.left - PAD.right, 1);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const numericValues = useMemo(
    () => points.map((point) => resolveValue(point.value)),
    [points],
  );

  const yMax = yMaxFor(numericValues);

  const coords = useMemo(() => {
    if (!points.length) {
      return [];
    }

    return points.map((point, index) => {
      const x =
        PAD.left +
        (points.length === 1
          ? plotWidth / 2
          : (index / (points.length - 1)) * plotWidth);

      const value = resolveValue(point.value);
      const y =
        value == null
          ? null
          : PAD.top + plotHeight - (value / yMax) * plotHeight;

      return { point, index, x, y, value };
    });
  }, [points, plotWidth, plotHeight, yMax]);

  const path = useMemo(() => {
    if (!coords.length) {
      return "";
    }

    // Gap uncovered / unavailable days — do not draw them as zero.
    const parts: string[] = [];
    let drawing = false;
    for (const coord of coords) {
      if (coord.y == null || coord.value == null) {
        drawing = false;
        continue;
      }
      parts.push(`${drawing ? "L" : "M"} ${coord.x} ${coord.y}`);
      drawing = true;
    }
    return parts.join(" ");
  }, [coords]);

  const xLabels = useMemo(() => {
    if (points.length === 0) {
      return [];
    }

    // Metricool labels roughly every 3 days across a ~30 day window.
    const step = points.length > 20 ? 3 : Math.max(1, Math.floor(points.length / 10));
    const labels: Array<{ date: string; x: number }> = [];

    for (let index = 0; index < points.length; index += step) {
      labels.push({
        date: points[index].date,
        x: coords[index]?.x ?? PAD.left,
      });
    }

    const last = points[points.length - 1];
    if (labels[labels.length - 1]?.date !== last.date) {
      labels.push({
        date: last.date,
        x: coords[coords.length - 1]?.x ?? PAD.left + plotWidth,
      });
    }

    return labels;
  }, [points, coords, plotWidth]);

  const yTicks =
    yMax === 10
      ? [0, 2.5, 5, 7.5, 10]
      : [0, 0.25, 0.5, 0.75, 1].map((ratio) => yMax * ratio);

  function activate(index: number) {
    const coord = coords[index];
    if (!coord || coord.y == null) {
      return;
    }

    setActive({ index, x: coord.x, y: coord.y });
  }

  function clearActive() {
    setActive(null);
  }

  const activePoint = active ? coords[active.index] : null;
  const tooltipWidth = 148;
  const tooltipLeft = active
    ? Math.min(
        Math.max(active.x - tooltipWidth / 2, 4),
        Math.max(width - tooltipWidth - 4, 4),
      )
    : 0;
  const tooltipPointerOffset = active
    ? Math.min(Math.max(active.x - tooltipLeft, 14), tooltipWidth - 14)
    : tooltipWidth / 2;

  return (
    <div
      className="relative w-full overflow-visible pb-14"
      onMouseLeave={clearActive}
    >
      <svg
        ref={svgRef}
        role="img"
        aria-label={`${seriesLabel} trend chart`}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="h-[240px] w-full overflow-visible"
      >
        {yTicks.map((tick) => {
          const y = PAD.top + plotHeight - (tick / yMax) * plotHeight;

          return (
            <text
              key={tick}
              x={PAD.left - 8}
              y={y + 3.5}
              textAnchor="end"
              fill={SUMMARY_AXIS}
              fontSize={11}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {tick % 1 === 0 ? tick : tick.toFixed(1)}
            </text>
          );
        })}

        {xLabels.map((label) => (
          <text
            key={label.date}
            x={label.x}
            y={HEIGHT - 8}
            textAnchor="middle"
            fill={SUMMARY_AXIS}
            fontSize={11}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {displayDateShort(label.date)}
          </text>
        ))}

        {path && numericValues.some((value) => value != null) ? (
          <path
            d={path}
            fill="none"
            stroke={seriesColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {active && activePoint && activePoint.y != null ? (
          <line
            x1={active.x}
            x2={active.x}
            y1={PAD.top}
            y2={activePoint.y}
            stroke="#3F3F46"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ) : null}

        {coords.map((coord) => {
          const isActive = active?.index === coord.index;
          const hitWidth = Math.max(plotWidth / Math.max(points.length, 1), 14);
          const isConfirmed = coord.value != null && coord.y != null;

          return (
            <g key={coord.point.date}>
              <rect
                x={coord.x - hitWidth / 2}
                y={PAD.top}
                width={hitWidth}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => activate(coord.index)}
                onMouseMove={() => activate(coord.index)}
              />
              {isConfirmed ? (
                <circle
                  cx={coord.x}
                  cy={coord.y!}
                  r={isActive ? 4.5 : 3}
                  fill={seriesColor}
                  stroke={isActive ? "#FFFFFF" : "none"}
                  strokeWidth={isActive ? 1.5 : 0}
                  tabIndex={0}
                  role="button"
                  aria-label={`${displayDate(coord.point.date)}, ${seriesLabel}: ${formatMetric(coord.point.value)}`}
                  onFocus={() => activate(coord.index)}
                  onBlur={clearActive}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      clearActive();
                      (event.target as HTMLElement).blur();
                    }
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      if (coord.index < coords.length - 1) {
                        activate(coord.index + 1);
                      }
                    }
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      if (coord.index > 0) {
                        activate(coord.index - 1);
                      }
                    }
                  }}
                  onMouseEnter={() => activate(coord.index)}
                  onMouseMove={() => activate(coord.index)}
                  className="cursor-pointer outline-none"
                  opacity={showMarkers || isActive ? 1 : 0}
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      {active && activePoint ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] shadow-[0_4px_16px_rgba(15,23,42,0.12)]"
          style={{
            left: tooltipLeft,
            top:
              activePoint.y != null
                ? activePoint.y + 14
                : PAD.top + plotHeight / 2,
            width: tooltipWidth,
          }}
        >
          <span
            aria-hidden="true"
            className="absolute bottom-full h-0 w-0 border-x-[7px] border-b-[7px] border-x-transparent border-b-white drop-shadow-sm"
            style={{ left: tooltipPointerOffset, transform: "translateX(-50%)" }}
          />
          <p className="font-semibold text-[#30343A]">
            {displayDate(activePoint.point.date)}
          </p>
          <p className="mt-1.5 flex items-center gap-2 font-medium text-[#505761]">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: seriesColor }}
            />
            <span>
              {seriesLabel}:{" "}
              {activePoint.value == null
                ? "—"
                : formatMetric(activePoint.point.value)}
              {activePoint.value == null ? " (not synchronized)" : ""}
            </span>
          </p>
        </div>
      ) : null}

      <table className="sr-only">
        <caption>{seriesLabel} daily values</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <td>{displayDate(point.date)}</td>
              <td>{formatMetric(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
