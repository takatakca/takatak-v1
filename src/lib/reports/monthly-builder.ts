// Turns the monthly growth numbers (src/lib/growth/report.ts) into a stored
// report: title, summary, sections and metric snapshots. Pure, so it is
// tested without a database. Every value comes from the workspace's own
// records; nothing is estimated, and a month with no activity says so.

export const REPORT_BUILDER_SOURCE = "report_builder";

export interface BuilderNumbers {
  pageviews: number;
  visits: number;
  conversions: number;
  ratings: number;
  averageRating: number | null;
  publicReviewClicks: number;
  requestsSent: number;
  conversations: number;
  leads: number;
  aiRunsCompleted: number;
  creditsUsed: number;
  adImpressions: number;
  adClicks: number;
}

export interface BuilderInput {
  clientName: string;
  month: { key: string; start: Date; end: Date; label: string };
  current: BuilderNumbers;
  previous: BuilderNumbers;
  topPages: Array<{ label: string; count: number }>;
  topSources: Array<{ label: string; count: number }>;
  highlights: string[];
}

export interface BuilderSection {
  title: string;
  type: "summary" | "metrics" | "leads_summary" | "notes";
  order: number;
  content: string;
}

export interface BuilderMetric {
  key: keyof BuilderNumbers;
  label: string;
  value: string;
  unit: string | null;
}

export interface BuilderPlan {
  title: string;
  summary: string;
  periodStart: Date;
  periodEnd: Date;
  sections: BuilderSection[];
  metrics: BuilderMetric[];
  metadata: { source: typeof REPORT_BUILDER_SOURCE; month: string; version: 1 };
}

const METRICS: Array<{ key: keyof BuilderNumbers; label: string; unit: string | null }> = [
  { key: "visits", label: "Visites du site · Website visits", unit: null },
  { key: "pageviews", label: "Pages vues · Page views", unit: null },
  { key: "conversions", label: "Actions de contact · Contact actions", unit: null },
  { key: "leads", label: "Nouveaux prospects · New leads", unit: null },
  { key: "conversations", label: "Conversations", unit: null },
  { key: "ratings", label: "Nouveaux avis · New reviews", unit: null },
  { key: "averageRating", label: "Note moyenne · Average rating", unit: "/ 5" },
  { key: "requestsSent", label: "Demandes d’avis envoyées · Review requests sent", unit: null },
  { key: "publicReviewClicks", label: "Clients redirigés vers un avis public · Sent to a public review", unit: null },
  { key: "adImpressions", label: "Impressions publicitaires · Ad impressions", unit: null },
  { key: "adClicks", label: "Clics publicitaires · Ad clicks", unit: null },
  { key: "aiRunsCompleted", label: "Tâches des agents IA · AI agent tasks", unit: null },
  { key: "creditsUsed", label: "Crédits IA utilisés · AI credits used", unit: null },
];

/** "YYYY-MM" of the months a report can be built for: this month and the 11 before. */
export function buildableMonths(now = new Date()): string[] {
  const months: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function isBuildableMonth(key: string, now = new Date()): boolean {
  return /^\d{4}-\d{2}$/.test(key) && buildableMonths(now).includes(key);
}

function display(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("fr-CA");
}

function trend(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "stable" : "nouveau · new";
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct === 0 ? "stable" : `${pct > 0 ? "+" : ""}${pct} %`;
}

function list(rows: Array<{ label: string; count: number }>): string {
  return rows.length ? rows.map((row) => `${row.label} (${row.count})`).join(", ") : "aucune donnée · no data";
}

export function monthlyReportPlan(input: BuilderInput, month = input.month): BuilderPlan {
  const { current, previous } = input;
  const metrics = METRICS.map((metric) => ({
    key: metric.key,
    label: metric.label,
    value: display(current[metric.key]),
    unit: current[metric.key] === null ? null : metric.unit,
  }));
  const comparison = [
    `Visites · Visits : ${display(current.visits)} (${trend(current.visits, previous.visits)})`,
    `Actions de contact · Contact actions : ${display(current.conversions)} (${trend(current.conversions, previous.conversions)})`,
    `Prospects · Leads : ${display(current.leads)} (${trend(current.leads, previous.leads)})`,
    `Avis · Reviews : ${display(current.ratings)} (${trend(current.ratings, previous.ratings)})`,
  ].join("\n");
  const sections: BuilderSection[] = [
    { title: "Faits saillants · Highlights", type: "summary", order: 0, content: input.highlights.join("\n").slice(0, 4000) },
    { title: "Comparaison avec le mois précédent · Compared with last month", type: "metrics", order: 1, content: comparison },
    {
      title: "Site web : pages et sources · Website: pages and sources",
      type: "notes",
      order: 2,
      content: `Pages les plus vues · Top pages : ${list(input.topPages)}\nSources de visites · Traffic sources : ${list(input.topSources)}`.slice(0, 4000),
    },
    {
      title: "Clients et avis · Customers and reviews",
      type: "leads_summary",
      order: 3,
      content: [
        `${display(current.leads)} nouveaux prospects et ${display(current.conversations)} conversations · new leads and conversations.`,
        current.averageRating === null
          ? `${display(current.ratings)} nouvel avis ce mois-ci · new reviews this month.`
          : `${display(current.ratings)} nouveaux avis, note moyenne ${current.averageRating.toFixed(1)} / 5 · new reviews, average rating.`,
        `${display(current.requestsSent)} demandes d’avis envoyées · review requests sent.`,
      ].join("\n"),
    },
  ];
  return {
    title: `Rapport mensuel · Monthly report — ${month.label}`.slice(0, 160),
    summary: `${input.clientName} · ${month.label}. ${input.highlights[0] ?? ""}`.trim().slice(0, 1000),
    periodStart: month.start,
    periodEnd: month.end,
    sections,
    metrics,
    metadata: { source: REPORT_BUILDER_SOURCE, month: month.key, version: 1 },
  };
}
