// Phase 12 — Leads view types (serializable, UI-facing).
export type LeadsDataSource = "database" | "mock" | "unavailable";

export interface SourceMeta {
  source: LeadsDataSource;
  sourceLabel: string;
}

export interface LeadSourceSummary {
  id: string;
  name: string;
  type: string;
  provider: string;
  status: string;
  brandName: string | null;
  leadCount: number;
}

export interface LeadCampaignSummary {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  sourceName: string | null;
  brandName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  budgetCents: number | null;
  currency: string;
  leadCount: number;
}

export interface LeadSummary {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  messagePreview: string | null;
  status: string;
  priority: string;
  sourceName: string | null;
  campaignName: string | null;
  brandName: string | null;
  followUpAt: string | null;
  createdAt: string;
}

export interface LeadPipelineStageSummary {
  id: string;
  name: string;
  status: string;
  order: number;
  brandName: string | null;
}

export interface LeadActivitySummary {
  id: string;
  type: string;
  status: string;
  title: string;
  notePreview: string | null;
  leadName: string | null;
  campaignName: string | null;
  dueAt: string | null;
  completedAt: string | null;
}

export interface LeadsKpis {
  leads: number;
  sources: number;
  campaigns: number;
  followUpsPlanned: number;
  qualifiedLeads: number;
}

export interface LeadsOverviewData extends SourceMeta {
  kpis: LeadsKpis;
  leads: LeadSummary[];
  pipelineCounts: { status: string; count: number }[];
  campaigns: LeadCampaignSummary[];
  activities: LeadActivitySummary[];
}
