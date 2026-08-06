// Phase 4 — Dashboard overview data adapter.
// DB-first with an honest mock fallback:
//   - database configured + queries succeed → source "database"
//   - database missing OR any query fails    → source "mock" (Phase 2 data)
// Never throws; never claims "database" unless real queries succeeded.

import {
  ACTIVITY_EVENTS,
  INTEGRATIONS,
  MOCK_DATA_LABEL,
} from "@/lib/data/mock-data";
import { getPrisma } from "./prisma";
import { clientWhere, resolveDataScope } from "@/lib/security/data-scope";
import type { TenantAccess } from "@/lib/security/tenant-access";

export interface OverviewKpis {
  clients: number;
  businessBrands: number;
  activeServices: number;
  pendingJobs: number;
  reportsReady: number;
}

export interface OverviewIntegrationRow {
  name: string;
  purpose: string;
  status: string;
  actionLabel: string;
}

export interface OverviewActivityItem {
  message: string;
  detail?: string;
}

export interface DashboardOverviewData {
  source: "database" | "mock" | "unavailable";
  sourceLabel: string;
  kpis: OverviewKpis;
  integrations: OverviewIntegrationRow[];
  recentActivity: OverviewActivityItem[];
}

const PROVIDER_META: Record<string, { name: string; purpose: string }> = {
  metricool: { name: "Metricool", purpose: "Social media engine" },
  upmind: { name: "Upmind", purpose: "Web / domain / hosting engine" },
  tryholo: { name: "TryHolo", purpose: "Creative AI provider (optional)" },
  openai: { name: "OpenAI", purpose: "AI content generation" },
  qmaps: { name: "QMAPS", purpose: "Local listings" },
  flexs: { name: "FLEXS", purpose: "Lead generation" },
  stripe: { name: "Stripe", purpose: "Payments and billing" },
  supabase: { name: "Supabase", purpose: "Auth, database, storage" },
  internal: { name: "Internal", purpose: "TAKATAK internal service" },
};

const ACTION_LABELS: Record<string, string> = {
  not_connected: "Credentials required",
  planned: "Planned setup",
  disabled: "Feature flag off",
  pending_credentials: "Awaiting credentials",
  connected: "Live",
  error: "Needs attention",
  expired: "Reauthorization required",
};

function mockFallback(): DashboardOverviewData {
  return {
    source: "mock",
    sourceLabel: MOCK_DATA_LABEL,
    kpis: { clients: 0, businessBrands: 0, activeServices: 0, pendingJobs: 0, reportsReady: 0 },
    integrations: INTEGRATIONS.map((i) => ({
      name: i.displayName,
      purpose: i.purpose,
      status: i.status,
      actionLabel: i.requirement,
    })),
    recentActivity: ACTIVITY_EVENTS.map((e) => ({ message: e.message, detail: e.detail })),
  };
}

export async function getDashboardOverviewData(access?: TenantAccess): Promise<DashboardOverviewData> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return {
      source: "unavailable",
      sourceLabel: scope.label,
      kpis: { clients: 0, businessBrands: 0, activeServices: 0, pendingJobs: 0, reportsReady: 0 },
      integrations: [],
      recentActivity: [],
    };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (!prisma || scope.kind !== "db") return mockFallback(); // local foundation only

  try {
    const [clients, businessBrands, activeServices, pendingJobs, reportsReady, integrationAccounts, recentNotifications, recentJobs] =
      await Promise.all([
        prisma.client.count({ where: scope.clientIds ? { id: { in: scope.clientIds } } : undefined }),
        prisma.businessBrand.count({ where: clientWhere(scope) }),
        prisma.serviceInstance.count({ where: { status: "active", ...clientWhere(scope) } }),
        prisma.job.count({ where: { status: { in: ["planned", "queued", "retrying"] }, ...clientWhere(scope) } }),
        prisma.report.count({ where: { status: "ready", ...clientWhere(scope) } }),
        prisma.integrationAccount.findMany({
          where: clientWhere(scope),
          orderBy: { createdAt: "asc" },
          select: { provider: true, status: true },
        }),
        prisma.notification.findMany({
          where: clientWhere(scope),
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { title: true, message: true },
        }),
        prisma.job.findMany({
          where: clientWhere(scope),
          orderBy: { createdAt: "desc" },
          take: 2,
          select: { type: true, status: true },
        }),
      ]);

    // Collapse per-client rows into one row per provider (worst status wins
    // is unnecessary in Phase 4 — foundation seeds one row per provider).
    const seen = new Map<string, string>();
    for (const acc of integrationAccounts) {
      if (!seen.has(acc.provider)) seen.set(acc.provider, acc.status);
    }
    const integrations: OverviewIntegrationRow[] = [...seen.entries()].map(([provider, status]) => ({
      name: PROVIDER_META[provider]?.name ?? provider,
      purpose: PROVIDER_META[provider]?.purpose ?? "Provider",
      status,
      actionLabel: ACTION_LABELS[status] ?? "—",
    }));

    const recentActivity: OverviewActivityItem[] = [
      ...recentNotifications.map((n) => ({ message: n.title, detail: n.message })),
      ...recentJobs.map((j) => ({
        message: `Job: ${j.type.replaceAll("_", " ")}`,
        detail: `Status: ${j.status}`,
      })),
    ];

    return {
      source: "database",
      sourceLabel: "Database connected — live foundation records.",
      kpis: { clients, businessBrands, activeServices, pendingJobs, reportsReady },
      integrations: integrations.length ? integrations : mockFallback().integrations,
      recentActivity: recentActivity.length ? recentActivity : mockFallback().recentActivity,
    };
  } catch (error) {
    // Safe fallback: log message only (no connection strings), serve mock.
    console.error(
      "[dashboard-data] Database query failed — falling back to mock foundation data:",
      error instanceof Error ? error.message : "unknown error",
    );
    if (!scope.allowMockFallback) {
      return {
        source: "unavailable",
        sourceLabel: "Data is temporarily unavailable.",
        kpis: { clients: 0, businessBrands: 0, activeServices: 0, pendingJobs: 0, reportsReady: 0 },
        integrations: [],
        recentActivity: [],
      };
    }
    return mockFallback();
  }
}
