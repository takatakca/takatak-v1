// Phase 12 — Leads data access. DB-first, honest mock fallback.
// This file NEVER calls FLEXS, any CRM, or any email/SMS provider.

import { getPrisma } from "@/lib/db/prisma";
import { clientWhere, resolveDataScope } from "@/lib/security/data-scope";
import type { TenantAccess } from "@/lib/security/tenant-access";
import type {
  LeadActivitySummary,
  LeadCampaignSummary,
  LeadPipelineStageSummary,
  LeadsOverviewData,
  LeadSourceSummary,
  LeadSummary,
  SourceMeta,
} from "./types";

const MOCK_LABEL = "Mock foundation data — database not connected yet.";
const DB_LABEL = "Database — live foundation records (FLEXS not connected, no outreach automation).";

// ── Mock foundation data (mirrors the seed) ──────────────────
const DEMO_NOTE = "[Internal demo lead — foundation record, not imported from any provider]";

const MOCK_SOURCES: LeadSourceSummary[] = [
  { id: "m_ls1", name: "Restaurant Website Form Foundation", type: "website_form", provider: "internal_demo", status: "active_internal", brandName: "Montreal Restaurant Hub Demo", leadCount: 3 },
  { id: "m_ls2", name: "Restaurant Local Listings Foundation", type: "local_listing", provider: "internal_demo", status: "active_internal", brandName: "Montreal Restaurant Hub Demo", leadCount: 0 },
  { id: "m_ls3", name: "TAKATAK Manual Prospecting Foundation", type: "manual", provider: "internal_demo", status: "active_internal", brandName: "TAKATAK Demo Brand", leadCount: 1 },
  { id: "m_ls4", name: "FLEXS Future Lead Source", type: "flexs", provider: "flexs", status: "planned", brandName: "TAKATAK Demo Brand", leadCount: 1 },
];

const MOCK_CAMPAIGNS: LeadCampaignSummary[] = [
  { id: "m_lc1", name: "Restaurant Catering Leads Foundation", goal: "Collect catering and group order inquiries", status: "planned", sourceName: "Restaurant Website Form Foundation", brandName: "Montreal Restaurant Hub Demo", startsAt: null, endsAt: null, budgetCents: null, currency: "CAD", leadCount: 1 },
  { id: "m_lc2", name: "TAKATAK SaaS Demo Leads Foundation", goal: "Track SaaS dashboard interest internally", status: "active_internal", sourceName: "TAKATAK Manual Prospecting Foundation", brandName: "TAKATAK Demo Brand", startsAt: null, endsAt: null, budgetCents: null, currency: "CAD", leadCount: 1 },
];

const MOCK_LEADS: LeadSummary[] = [
  { id: "m_l1", name: "Catering Inquiry (demo)", email: "catering-lead@example.test", phone: null, company: "Demo Events Co.", messagePreview: `${DEMO_NOTE} Interested in catering for a 40-person office event.`, status: "new_internal", priority: "high", sourceName: "Restaurant Website Form Foundation", campaignName: "Restaurant Catering Leads Foundation", brandName: "Montreal Restaurant Hub Demo", followUpAt: null, createdAt: "2026-07-16" },
  { id: "m_l2", name: "Website Hosting Inquiry (demo)", email: "hosting-lead@example.test", phone: null, company: null, messagePreview: `${DEMO_NOTE} Asked about hosting a small business website.`, status: "follow_up_planned", priority: "normal", sourceName: "TAKATAK Manual Prospecting Foundation", campaignName: "TAKATAK SaaS Demo Leads Foundation", brandName: "TAKATAK Demo Brand", followUpAt: "2026-07-23", createdAt: "2026-07-16" },
  { id: "m_l3", name: "Social Media Package Interest (demo)", email: "social-lead@example.test", phone: null, company: null, messagePreview: `${DEMO_NOTE} Wants pricing for weekly social media management.`, status: "contacted_internal", priority: "normal", sourceName: "Restaurant Website Form Foundation", campaignName: null, brandName: "Montreal Restaurant Hub Demo", followUpAt: null, createdAt: "2026-07-16" },
  { id: "m_l4", name: "Local Listing Cleanup Request (demo)", email: "listing-lead@example.test", phone: null, company: null, messagePreview: `${DEMO_NOTE} Needs NAP consistency fixes across directories.`, status: "qualified_internal", priority: "high", sourceName: "Restaurant Website Form Foundation", campaignName: null, brandName: "Montreal Restaurant Hub Demo", followUpAt: null, createdAt: "2026-07-16" },
  { id: "m_l5", name: "FLEXS Future Demo Lead Placeholder", email: "flexs-placeholder@example.test", phone: null, company: null, messagePreview: "[Internal demo lead — not imported from FLEXS] Placeholder showing where FLEXS-captured leads will appear.", status: "new_internal", priority: "low", sourceName: "FLEXS Future Lead Source", campaignName: null, brandName: "TAKATAK Demo Brand", followUpAt: null, createdAt: "2026-07-16" },
];

const STAGE_NAMES = ["New", "Follow-up Planned", "Contacted", "Qualified", "Proposal Planned", "Won", "Lost"];
const MOCK_STAGES: LeadPipelineStageSummary[] = STAGE_NAMES.flatMap((name, i) => [
  { id: `m_ps_r_${i}`, name, status: "active_internal", order: i + 1, brandName: "Montreal Restaurant Hub Demo" },
  { id: `m_ps_t_${i}`, name, status: "active_internal", order: i + 1, brandName: "TAKATAK Demo Brand" },
]);

const MOCK_ACTIVITIES: LeadActivitySummary[] = [
  { id: "m_a1", type: "note", status: "completed_internal", title: "Internal note", notePreview: "Foundation note — lead recorded in internal inbox.", leadName: "Catering Inquiry (demo)", campaignName: null, dueAt: null, completedAt: "2026-07-16" },
  { id: "m_a2", type: "follow_up", status: "planned", title: "Follow-up planned", notePreview: "Plan internal follow-up about hosting needs. No email/SMS is sent by the system.", leadName: "Website Hosting Inquiry (demo)", campaignName: null, dueAt: "2026-07-23", completedAt: null },
  { id: "m_a3", type: "call", status: "planned", title: "Call planned", notePreview: "Manual call planned by staff — no automation dials or records anything.", leadName: "Catering Inquiry (demo)", campaignName: null, dueAt: "2026-07-23", completedAt: null },
  { id: "m_a4", type: "proposal", status: "planned", title: "Proposal reminder", notePreview: "Prepare listing cleanup proposal draft.", leadName: "Local Listing Cleanup Request (demo)", campaignName: null, dueAt: "2026-07-23", completedAt: null },
  { id: "m_a5", type: "status_change", status: "completed_internal", title: "Status change note", notePreview: "Moved to Qualified (internal only) after manual review.", leadName: "Local Listing Cleanup Request (demo)", campaignName: null, dueAt: null, completedAt: "2026-07-16" },
];

function preview(text: string | null): string | null {
  if (!text) return null;
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

function logDbError(scope: string, error: unknown) {
  console.error(`[leads-data:${scope}] Query failed — using mock foundation data:`, error instanceof Error ? error.message : "unknown error");
}

const day = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? null;

// ── Sources ──────────────────────────────────────────────────
export async function getLeadSourcesData(access?: TenantAccess): Promise<SourceMeta & { sources: LeadSourceSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, sources: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.leadSource.findMany({
        where: clientWhere(scope),
        include: { businessBrand: { select: { name: true } }, _count: { select: { leads: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        sources: rows.map((s) => ({
          id: s.id, name: s.name, type: s.type, provider: s.provider, status: s.status,
          brandName: s.businessBrand?.name ?? null, leadCount: s._count.leads,
        })),
      };
    } catch (error) {
      logDbError("sources", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", sources: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, sources: MOCK_SOURCES };
}

// ── Campaigns ────────────────────────────────────────────────
export async function getLeadCampaignsData(access?: TenantAccess): Promise<SourceMeta & { campaigns: LeadCampaignSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, campaigns: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.leadCampaign.findMany({
        where: clientWhere(scope),
        include: {
          businessBrand: { select: { name: true } },
          leadSource: { select: { name: true } },
          _count: { select: { leads: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        campaigns: rows.map((c) => ({
          id: c.id, name: c.name, goal: c.goal, status: c.status,
          sourceName: c.leadSource?.name ?? null, brandName: c.businessBrand?.name ?? null,
          startsAt: day(c.startsAt), endsAt: day(c.endsAt),
          budgetCents: c.budgetCents, currency: c.currency, leadCount: c._count.leads,
        })),
      };
    } catch (error) {
      logDbError("campaigns", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", campaigns: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, campaigns: MOCK_CAMPAIGNS };
}

// ── Leads (contact inbox) ────────────────────────────────────
export async function getLeadContactsData(access?: TenantAccess): Promise<SourceMeta & { leads: LeadSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, leads: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.lead.findMany({
        where: clientWhere(scope),
        include: {
          businessBrand: { select: { name: true } },
          leadSource: { select: { name: true } },
          leadCampaign: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        leads: rows.map((l) => ({
          id: l.id, name: l.name, email: l.email, phone: l.phone, company: l.company,
          messagePreview: preview(l.message), status: l.status, priority: l.priority,
          sourceName: l.leadSource?.name ?? null, campaignName: l.leadCampaign?.name ?? null,
          brandName: l.businessBrand?.name ?? null,
          followUpAt: day(l.followUpAt), createdAt: l.createdAt.toISOString().slice(0, 10),
        })),
      };
    } catch (error) {
      logDbError("contacts", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", leads: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, leads: MOCK_LEADS };
}

// ── Pipeline (stages + leads grouped by status) ──────────────
export async function getLeadsPipelineData(access?: TenantAccess): Promise<SourceMeta & { stages: LeadPipelineStageSummary[]; leads: LeadSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, stages: [], leads: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const [stageRows, contacts] = await Promise.all([
        prisma.leadPipelineStage.findMany({
          where: clientWhere(scope),
          include: { businessBrand: { select: { name: true } } },
          orderBy: [{ businessBrandId: "asc" }, { order: "asc" }],
        }),
        getLeadContactsData(access),
      ]);
      return {
        source: "database", sourceLabel: DB_LABEL,
        stages: stageRows.map((st) => ({
          id: st.id, name: st.name, status: st.status, order: st.order,
          brandName: st.businessBrand?.name ?? null,
        })),
        leads: contacts.leads,
      };
    } catch (error) {
      logDbError("pipeline", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", stages: [], leads: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, stages: MOCK_STAGES, leads: MOCK_LEADS };
}

// ── Activities ───────────────────────────────────────────────
export async function getLeadActivitiesData(access?: TenantAccess): Promise<SourceMeta & { activities: LeadActivitySummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, activities: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.leadActivity.findMany({
        where: clientWhere(scope),
        include: {
          lead: { select: { name: true } },
          leadCampaign: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        activities: rows.map((a) => ({
          id: a.id, type: a.type, status: a.status, title: a.title,
          notePreview: preview(a.note),
          leadName: a.lead?.name ?? null, campaignName: a.leadCampaign?.name ?? null,
          dueAt: day(a.dueAt), completedAt: day(a.completedAt),
        })),
      };
    } catch (error) {
      logDbError("activities", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", activities: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, activities: MOCK_ACTIVITIES };
}

// ── Overview ─────────────────────────────────────────────────
const PIPELINE_ORDER = ["new_internal", "follow_up_planned", "contacted_internal", "qualified_internal", "proposal_planned", "won_internal", "lost_internal"];

export async function getLeadsOverviewData(access?: TenantAccess): Promise<LeadsOverviewData> {
  const [sources, campaigns, contacts, activities] = await Promise.all([
    getLeadSourcesData(access),
    getLeadCampaignsData(access),
    getLeadContactsData(access),
    getLeadActivitiesData(access),
  ]);
  return {
    source: contacts.source,
    sourceLabel: contacts.sourceLabel,
    kpis: {
      leads: contacts.leads.length,
      sources: sources.sources.length,
      campaigns: campaigns.campaigns.length,
      followUpsPlanned: contacts.leads.filter((l) => l.status === "follow_up_planned").length,
      qualifiedLeads: contacts.leads.filter((l) => l.status === "qualified_internal").length,
    },
    leads: contacts.leads,
    pipelineCounts: PIPELINE_ORDER.map((status) => ({
      status,
      count: contacts.leads.filter((l) => l.status === status).length,
    })),
    campaigns: campaigns.campaigns,
    activities: activities.activities,
  };
}
