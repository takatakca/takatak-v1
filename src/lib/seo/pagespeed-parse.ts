// Google PageSpeed Insights v5 — pure response parsing and Web Vitals grading.

export type Grade = "good" | "needs_improvement" | "poor";

export interface PageSpeedMetric {
  key: "lcp" | "cls" | "tbt" | "fcp" | "si";
  label: string;
  value: number;
  display: string;
  grade: Grade;
}

export interface PageSpeedReport {
  strategy: "mobile" | "desktop";
  url: string;
  score: number | null;
  metrics: PageSpeedMetric[];
  fieldCategory: string | null;
  fetchedAt: string;
}

// Thresholds from web.dev / Lighthouse scoring guidance.
const THRESHOLDS: Record<PageSpeedMetric["key"], [number, number]> = {
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
  tbt: [200, 600],
  fcp: [1800, 3000],
  si: [3400, 5800],
};

const AUDITS: Array<[PageSpeedMetric["key"], string, string]> = [
  ["lcp", "largest-contentful-paint", "Largest Contentful Paint"],
  ["cls", "cumulative-layout-shift", "Cumulative Layout Shift"],
  ["tbt", "total-blocking-time", "Total Blocking Time"],
  ["fcp", "first-contentful-paint", "First Contentful Paint"],
  ["si", "speed-index", "Speed Index"],
];

export function gradeMetric(key: PageSpeedMetric["key"], value: number): Grade {
  const [good, poor] = THRESHOLDS[key];
  return value <= good ? "good" : value <= poor ? "needs_improvement" : "poor";
}

function formatMetric(key: PageSpeedMetric["key"], value: number): string {
  if (key === "cls") return value.toFixed(2);
  if (key === "tbt") return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export function parsePageSpeed(raw: unknown, strategy: "mobile" | "desktop", url: string): PageSpeedReport | null {
  if (!raw || typeof raw !== "object") return null;
  const lr = (raw as { lighthouseResult?: { categories?: { performance?: { score?: unknown } }; audits?: Record<string, { numericValue?: unknown }> } })
    .lighthouseResult;
  if (!lr || typeof lr !== "object") return null;
  const scoreRaw = lr.categories?.performance?.score;
  const metrics: PageSpeedMetric[] = [];
  for (const [key, auditId, label] of AUDITS) {
    const v = lr.audits?.[auditId]?.numericValue;
    if (typeof v === "number" && Number.isFinite(v)) {
      metrics.push({ key, label, value: v, display: formatMetric(key, v), grade: gradeMetric(key, v) });
    }
  }
  const field = (raw as { loadingExperience?: { overall_category?: unknown } }).loadingExperience?.overall_category;
  return {
    strategy,
    url,
    score: typeof scoreRaw === "number" ? Math.round(scoreRaw * 100) : null,
    metrics,
    fieldCategory: typeof field === "string" ? field : null,
    fetchedAt: new Date().toISOString(),
  };
}
