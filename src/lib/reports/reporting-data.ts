// Phase 10 — Reporting data access. DB-first, honest mock fallback.
// This file NEVER: exports PDFs, sends/delivers reports, creates share
// links, generates AI summaries, or calls OpenAI/TryHolo/Metricool/Upmind.

import { getPrisma } from "@/lib/db/prisma";
import { clientWhere, resolveDataScope } from "@/lib/security/data-scope";
import type { TenantAccess } from "@/lib/security/tenant-access";
import type {
  ReportDraftSummary,
  ReportMetricSummary,
  ReportOverviewData,
  ReportPreviewData,
  ReportScheduleSummary,
  ReportSectionSummary,
  ReportTemplateSummary,
  SourceMeta,
} from "./types";

const MOCK_LABEL = "Mock foundation data — database not connected yet.";
const DB_LABEL = "Database — live foundation records (export and delivery not active).";

// ── Mock foundation data (mirrors the seed) ──────────────────
const MOCK_TEMPLATES: ReportTemplateSummary[] = [
  { id: "m_t1", name: "Monthly Client Summary Foundation", description: "Foundation template: monthly overview across all TAKATAK services for one client.", type: "client_summary", status: "active", defaultPeriod: "monthly", sectionsPlan: [{ type: "summary", title: "Executive Summary" }, { type: "metrics", title: "Service Status" }, { type: "social_posts", title: "Social Media Snapshot" }, { type: "hosting_status", title: "Web / Hosting Snapshot" }, { type: "recommendations", title: "Recommendations" }] },
  { id: "m_t2", name: "Social Media Foundation Report", description: "Foundation template: weekly social results per brand. Fills with real analytics only after a verified Metricool sync exists.", type: "social_media", status: "active", defaultPeriod: "weekly", sectionsPlan: [{ type: "summary", title: "Week at a Glance" }, { type: "social_posts", title: "Post Pipeline" }, { type: "campaign_performance", title: "Campaign Performance" }, { type: "chart_placeholder", title: "Engagement Chart (placeholder)" }, { type: "notes", title: "Notes" }] },
  { id: "m_t3", name: "Web / Hosting Foundation Report", description: "Foundation template: domain, DNS, SSL, and hosting status per client.", type: "web_hosting", status: "active", defaultPeriod: "monthly", sectionsPlan: [{ type: "summary", title: "Overview" }, { type: "domain_status", title: "Domain Status" }, { type: "hosting_status", title: "Hosting Status" }, { type: "recommendations", title: "Recommendations" }] },
];

const MOCK_DRAFTS: ReportDraftSummary[] = [
  { id: "m_r1", title: "Restaurant Monthly Summary Draft", type: "client_summary", status: "draft", clientName: "Restaurant Demo Client", brandName: "Montreal Restaurant Hub Demo", periodStart: null, periodEnd: null, summaryPreview: "[Internal foundation summary — written by TAKATAK, not AI-generated] Monthly view for Montreal Restaurant Hub Demo…", sectionCount: 6, metricCount: 7 },
  { id: "m_r2", title: "TAKATAK Service Overview Draft", type: "client_summary", status: "draft", clientName: "TAKATAK Demo Client", brandName: "TAKATAK Demo Brand", periodStart: null, periodEnd: null, summaryPreview: "[Internal foundation summary — written by TAKATAK, not AI-generated] Overview of TAKATAK Demo Brand services…", sectionCount: 5, metricCount: 4 },
];

const MOCK_SECTIONS: ReportSectionSummary[] = [
  { id: "m_s1", title: "Executive Summary", type: "summary", order: 0, status: "draft", contentPreview: "[Foundation content — internal preview, not AI-generated] Social foundation is active with posts in draft and approval…" },
  { id: "m_s2", title: "Service Status", type: "metrics", order: 1, status: "draft", contentPreview: "[Foundation content — internal preview, not AI-generated] Service instances remain in planned/pending states…" },
  { id: "m_s3", title: "Social Media Snapshot", type: "social_posts", order: 2, status: "draft", contentPreview: "[Foundation content — internal preview, not AI-generated] 4 internal posts exist across draft, pending approval, and approved…" },
  { id: "m_s4", title: "Web / Hosting Snapshot", type: "hosting_status", order: 3, status: "draft", contentPreview: "[Foundation content — internal preview, not AI-generated] montrealrestauranthub.demo is pending connection…" },
  { id: "m_s5", title: "Recommendations", type: "recommendations", order: 4, status: "draft", contentPreview: "[Foundation content — internal preview, not AI-generated] Next: confirm Metricool credentials and endpoint…" },
  { id: "m_s6", title: "Notes", type: "notes", order: 5, status: "draft", contentPreview: "[Foundation content — internal preview, not AI-generated] This report is a structural foundation. Export and delivery are not active." },
];

const MOCK_METRICS: ReportMetricSummary[] = [
  { id: "m_m1", key: "planned_services", label: "Planned services", value: "2", unit: null, source: "internal", createdAt: "2026-07-15" },
  { id: "m_m2", key: "not_connected_integrations", label: "Integrations not connected", value: "7", unit: null, source: "internal", createdAt: "2026-07-15" },
  { id: "m_m3", key: "draft_posts", label: "Draft posts", value: "2", unit: null, source: "social_foundation", createdAt: "2026-07-15" },
  { id: "m_m4", key: "pending_approvals", label: "Pending approvals", value: "1", unit: null, source: "social_foundation", createdAt: "2026-07-15" },
  { id: "m_m5", key: "approved_posts", label: "Approved posts", value: "1", unit: null, source: "social_foundation", createdAt: "2026-07-15" },
  { id: "m_m6", key: "domains_tracked", label: "Domains tracked", value: "2", unit: null, source: "web_hosting_foundation", createdAt: "2026-07-15" },
  { id: "m_m7", key: "ssl_pending", label: "SSL pending", value: "2", unit: null, source: "web_hosting_foundation", createdAt: "2026-07-15" },
  { id: "m_m8", key: "ai_template_outputs", label: "AI Studio template outputs (not AI)", value: "3", unit: null, source: "ai_foundation", createdAt: "2026-07-15" },
  { id: "m_m9", key: "ai_generated_outputs", label: "AI-generated outputs", value: "0", unit: null, source: "ai_foundation", createdAt: "2026-07-15" },
  { id: "m_m10", key: "report_export_enabled", label: "Report export enabled", value: "No", unit: null, source: "manual", createdAt: "2026-07-15" },
  { id: "m_m11", key: "report_delivery_enabled", label: "Report delivery enabled", value: "No", unit: null, source: "manual", createdAt: "2026-07-15" },
];

const MOCK_SCHEDULES: ReportScheduleSummary[] = [
  { id: "m_sc1", name: "Monthly Client Summary Schedule", frequency: "monthly", status: "planned", clientName: "Restaurant Demo Client", brandName: "Montreal Restaurant Hub Demo", templateName: "Monthly Client Summary Foundation", nextRunAt: null, lastRunAt: null, note: "Foundation schedule record only — no background worker active." },
];

function preview(text: string | null): string | null {
  if (!text) return null;
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

function toPlan(value: unknown): { type: string; title: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is { type: string; title: string } =>
      Boolean(v && typeof v === "object" && "type" in v && "title" in v))
    .map((v) => ({ type: String(v.type), title: String(v.title) }));
}

function noteFrom(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "note" in metadata) {
    return String((metadata as { note: unknown }).note);
  }
  return null;
}

function logDbError(scope: string, error: unknown) {
  console.error(`[reporting-data:${scope}] Query failed — using mock foundation data:`, error instanceof Error ? error.message : "unknown error");
}

// ── Templates ────────────────────────────────────────────────
export async function getReportTemplatesData(access?: TenantAccess): Promise<SourceMeta & { templates: ReportTemplateSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, templates: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.reportTemplate.findMany({ orderBy: { createdAt: "asc" } });
      return {
        source: "database", sourceLabel: DB_LABEL,
        templates: rows.map((t) => ({
          id: t.id, name: t.name, description: t.description, type: t.type,
          status: t.status, defaultPeriod: t.defaultPeriod,
          sectionsPlan: toPlan(t.sectionsJson),
        })),
      };
    } catch (error) {
      logDbError("templates", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", templates: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, templates: MOCK_TEMPLATES };
}

// ── Report drafts ────────────────────────────────────────────
export async function getReportDraftsData(access?: TenantAccess): Promise<SourceMeta & { drafts: ReportDraftSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, drafts: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.report.findMany({
        where: clientWhere(scope),
        include: {
          client: { select: { name: true } },
          businessBrand: { select: { name: true } },
          _count: { select: { sections: true, metrics: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        drafts: rows.map((r) => ({
          id: r.id, title: r.title, type: r.type, status: r.status,
          clientName: r.client.name, brandName: r.businessBrand?.name ?? null,
          periodStart: r.periodStart?.toISOString().slice(0, 10) ?? null,
          periodEnd: r.periodEnd?.toISOString().slice(0, 10) ?? null,
          summaryPreview: preview(r.summary),
          sectionCount: r._count.sections,
          metricCount: r._count.metrics,
        })),
      };
    } catch (error) {
      logDbError("drafts", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", drafts: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, drafts: MOCK_DRAFTS };
}

// ── Schedules ────────────────────────────────────────────────
export async function getReportSchedulesData(access?: TenantAccess): Promise<SourceMeta & { schedules: ReportScheduleSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, schedules: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.reportSchedule.findMany({
        where: clientWhere(scope),
        include: {
          client: { select: { name: true } },
          businessBrand: { select: { name: true } },
          reportTemplate: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        schedules: rows.map((s) => ({
          id: s.id, name: s.name, frequency: s.frequency, status: s.status,
          clientName: s.client.name, brandName: s.businessBrand?.name ?? null,
          templateName: s.reportTemplate?.name ?? null,
          nextRunAt: s.nextRunAt?.toISOString().slice(0, 10) ?? null,
          lastRunAt: s.lastRunAt?.toISOString().slice(0, 10) ?? null,
          note: noteFrom(s.metadata),
        })),
      };
    } catch (error) {
      logDbError("schedules", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", schedules: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, schedules: MOCK_SCHEDULES };
}

// ── Metrics ──────────────────────────────────────────────────
export async function getReportMetricsData(access?: TenantAccess): Promise<SourceMeta & { metrics: ReportMetricSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, metrics: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.reportMetric.findMany({ where: scope.clientIds ? { report: { clientId: { in: scope.clientIds } } } : undefined, orderBy: { createdAt: "asc" } });
      return {
        source: "database", sourceLabel: DB_LABEL,
        metrics: rows.map((m) => ({
          id: m.id, key: m.key, label: m.label, value: m.value, unit: m.unit,
          source: m.source, createdAt: m.createdAt.toISOString().slice(0, 10),
        })),
      };
    } catch (error) {
      logDbError("metrics", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", metrics: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, metrics: MOCK_METRICS };
}

// ── Preview (first draft or by id) ───────────────────────────
export async function getReportPreviewData(reportId?: string, access?: TenantAccess): Promise<ReportPreviewData> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, report: null, sections: [], metrics: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const row = await prisma.report.findFirst({
        where: { ...(reportId ? { id: reportId } : {}), ...clientWhere(scope) },
        include: {
          client: { select: { name: true } },
          businessBrand: { select: { name: true } },
          sections: { where: { status: { not: "hidden" } }, orderBy: { order: "asc" } },
          metrics: { orderBy: { createdAt: "asc" } },
          _count: { select: { sections: true, metrics: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      if (row) {
        return {
          source: "database", sourceLabel: DB_LABEL,
          report: {
            id: row.id, title: row.title, type: row.type, status: row.status,
            clientName: row.client.name, brandName: row.businessBrand?.name ?? null,
            periodStart: row.periodStart?.toISOString().slice(0, 10) ?? null,
            periodEnd: row.periodEnd?.toISOString().slice(0, 10) ?? null,
            summaryPreview: row.summary,
            sectionCount: row._count.sections,
            metricCount: row._count.metrics,
          },
          sections: row.sections.map((sec) => ({
            id: sec.id, title: sec.title, type: sec.type, order: sec.order,
            status: sec.status, contentPreview: sec.content,
          })),
          metrics: row.metrics.map((m) => ({
            id: m.id, key: m.key, label: m.label, value: m.value, unit: m.unit,
            source: m.source, createdAt: m.createdAt.toISOString().slice(0, 10),
          })),
        };
      }
      if (!scope.allowMockFallback) {
        // Strict scope + no accessible row: honest empty database result —
        // NEVER the mock preview, and never another client's report.
        return { source: "database", sourceLabel: scope.label, report: null, sections: [], metrics: [] };
      }
    } catch (error) {
      logDbError("preview", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", report: null, sections: [], metrics: [] };
      }
    }
  }
  return {
    source: "mock", sourceLabel: MOCK_LABEL,
    report: MOCK_DRAFTS[0],
    sections: MOCK_SECTIONS,
    metrics: MOCK_METRICS.filter((m) => ["internal", "social_foundation", "web_hosting_foundation"].includes(m.source)),
  };
}

// ── Builder foundation data ──────────────────────────────────
export async function getReportBuilderData(access?: TenantAccess): Promise<SourceMeta & { templates: ReportTemplateSummary[]; drafts: ReportDraftSummary[] }> {
  const [templates, drafts] = await Promise.all([getReportTemplatesData(access), getReportDraftsData(access)]);
  return { source: templates.source, sourceLabel: templates.sourceLabel, templates: templates.templates, drafts: drafts.drafts };
}

// ── Overview ─────────────────────────────────────────────────
export async function getReportsOverviewData(access?: TenantAccess): Promise<ReportOverviewData> {
  const [templates, drafts, metrics, schedules] = await Promise.all([
    getReportTemplatesData(access),
    getReportDraftsData(access),
    getReportMetricsData(access),
    getReportSchedulesData(access),
  ]);
  return {
    source: drafts.source,
    sourceLabel: drafts.sourceLabel,
    kpis: {
      reports: drafts.drafts.length,
      templates: templates.templates.length,
      draftReports: drafts.drafts.filter((d) => d.status === "draft").length,
      readyReports: drafts.drafts.filter((d) => d.status === "ready").length, // 0 unless real ready records exist
      scheduledReports: schedules.schedules.length,
    },
    templates: templates.templates,
    drafts: drafts.drafts,
    metrics: metrics.metrics,
    schedules: schedules.schedules,
  };
}
