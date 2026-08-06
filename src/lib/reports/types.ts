// Phase 10 — Reporting view types (serializable, UI-facing).
export type ReportingDataSource = "database" | "mock" | "unavailable";

export interface SourceMeta {
  source: ReportingDataSource;
  sourceLabel: string;
}

export interface ReportTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  defaultPeriod: string | null;
  sectionsPlan: { type: string; title: string }[];
}

export interface ReportSectionSummary {
  id: string;
  title: string;
  type: string;
  order: number;
  status: string;
  contentPreview: string | null;
}

export interface ReportMetricSummary {
  id: string;
  key: string;
  label: string;
  value: string;
  unit: string | null;
  source: string;
  createdAt: string;
}

export interface ReportDraftSummary {
  id: string;
  title: string;
  type: string;
  status: string;
  clientName: string | null;
  brandName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  summaryPreview: string | null;
  sectionCount: number;
  metricCount: number;
}

export interface ReportScheduleSummary {
  id: string;
  name: string;
  frequency: string;
  status: string;
  clientName: string | null;
  brandName: string | null;
  templateName: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  note: string | null;
}

export interface ReportShareSummary {
  id: string;
  reportTitle: string;
  status: string;
  sharedWithEmail: string | null;
  expiresAt: string | null;
}

export interface ReportPreviewData extends SourceMeta {
  report: ReportDraftSummary | null;
  sections: ReportSectionSummary[];
  metrics: ReportMetricSummary[];
}

export interface ReportingKpis {
  reports: number;
  templates: number;
  draftReports: number;
  readyReports: number;
  scheduledReports: number;
}

export interface ReportOverviewData extends SourceMeta {
  kpis: ReportingKpis;
  templates: ReportTemplateSummary[];
  drafts: ReportDraftSummary[];
  metrics: ReportMetricSummary[];
  schedules: ReportScheduleSummary[];
}
