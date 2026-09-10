// Phase 13 — Admin ops data access. DB-first, honest mock fallback.
// View-only: this file NEVER mutates data, executes/retries jobs, calls
// providers, or exposes secrets/raw metadata. Audit metadata is reduced to
// a safe note string; IPs, user agents, and payloads are never surfaced.

import { getPrisma } from "@/lib/db/prisma";
import { getPlatformAdminAccess } from "@/lib/security/platform-admin-access";
import type { TenantAccess } from "@/lib/security/tenant-access";
import { getDatabaseEnvStatus } from "@/lib/db/env";
import { isSupabaseConfigured } from "@/lib/auth/env";
import { getMetricoolEnvStatus } from "@/lib/integrations/metricool/env";
import { getUpmindEnvStatus } from "@/lib/integrations/upmind/env";
import { getOpenAiStatus, getTryHoloStatus } from "@/lib/ai/providers";
import type {
  AdminClientSummary,
  AdminServiceSummary,
  AdminSystemHealthItem,
  AdminNotificationSummary,
  AdminOverviewData,
  AuditLogSummary,
  IntegrationEventSummary,
  JobMonitorSummary,
  SourceMeta,
  TeamMemberSummary,
} from "./types";

const MOCK_LABEL = "Mock foundation data — database not connected yet.";
const DB_LABEL = "Database — live foundation records (view only, no write actions active).";

// ── Mock foundation data (mirrors the seed) ──────────────────
const MOCK_CLIENTS: AdminClientSummary[] = [
  { id: "m_ac1", name: "TAKATAK Demo Client", status: "active", brandCount: 1, serviceCount: 2, memberCount: 0, createdAt: "2026-07-10" },
  { id: "m_ac2", name: "Restaurant Demo Client", status: "active", brandCount: 1, serviceCount: 3, memberCount: 0, createdAt: "2026-07-10" },
];

const MOCK_JOBS: JobMonitorSummary[] = [
  { id: "m_aj1", type: "social_publish", provider: "metricool", status: "planned", attempts: 0, maxAttempts: 3, clientName: "Restaurant Demo Client", scheduledFor: null, errorMessage: null, createdAt: "2026-07-10", logs: [{ id: "m_ajl1", level: "info", message: "Planned during foundation. No worker exists yet — this job has never run.", createdAt: "2026-07-18" }] },
  { id: "m_aj2", type: "analytics_sync", provider: "metricool", status: "planned", attempts: 0, maxAttempts: 3, clientName: "Restaurant Demo Client", scheduledFor: null, errorMessage: null, createdAt: "2026-07-10", logs: [{ id: "m_ajl2", level: "info", message: "Planned during foundation. No worker exists yet — this job has never run.", createdAt: "2026-07-18" }] },
  { id: "m_aj3", type: "domain_check", provider: "upmind", status: "planned", attempts: 0, maxAttempts: 3, clientName: "TAKATAK Demo Client", scheduledFor: null, errorMessage: null, createdAt: "2026-07-10", logs: [] },
  { id: "m_aj4", type: "report_generate", provider: null, status: "planned", attempts: 0, maxAttempts: 3, clientName: "Restaurant Demo Client", scheduledFor: null, errorMessage: null, createdAt: "2026-07-10", logs: [] },
];

const MOCK_AUDIT: AuditLogSummary[] = [
  { id: "m_aa1", action: "admin_ops.foundation_seeded", entityType: "system", entityId: null, actorName: null, clientName: null, note: "Phase 13 admin ops foundation seed. System-internal entry — not a user action.", createdAt: "2026-07-18" },
  { id: "m_aa2", action: "foundation.checkpoint_10_12_passed", entityType: "system", entityId: null, actorName: null, clientName: null, note: "Checkpoint audit for Phases 10-12 passed (fresh-DB migrate+seed, RLS 001-007, honesty scans).", createdAt: "2026-07-18" },
  { id: "m_aa3", action: "foundation.module_seeded", entityType: "client", entityId: "m_ac2", actorName: null, clientName: "Restaurant Demo Client", note: "Foundation modules seeded for demo client. System-internal entry.", createdAt: "2026-07-18" },
];

const MOCK_NOTIFICATIONS: AdminNotificationSummary[] = [
  { id: "m_an1", type: "system", title: "Welcome to the TAKATAK dashboard foundation", message: "The database foundation is seeded. Integrations remain not connected until real credentials are verified.", status: "unread", clientName: null, createdAt: "2026-07-10" },
  { id: "m_an2", type: "system", title: "Checkpoint 10-12 passed", message: "Fresh-database migration, seed idempotency, RLS application, and honesty scans all verified. No providers connected.", status: "unread", clientName: null, createdAt: "2026-07-18" },
];

function safeNote(metadata: unknown): string | null {
  // Only ever surface an explicit human-written note — never raw JSON,
  // payloads, IPs, or user agents.
  if (metadata && typeof metadata === "object" && "note" in metadata) {
    const note = (metadata as { note: unknown }).note;
    return typeof note === "string" ? note : null;
  }
  return null;
}

type AdminGate =
  | { kind: "mock" }
  | { kind: "db"; allowMockFallback: boolean }
  | { kind: "unavailable"; label: string };

/** Phase 15A — admin data requires foundation mode OR a platform_admin
 *  (owner/admin Profile). Client-scoped members NEVER receive global admin
 *  data, even if a request reaches these functions. */
async function resolveAdminDataGate(
  access?: TenantAccess,
): Promise<AdminGate> {
  if (access) {
    if (access.mode === "foundation_demo") {
      return { kind: "mock" };
    }
    if (access.mode === "platform_admin") {
      return { kind: "db", allowMockFallback: false };
    }
    return {
      kind: "unavailable",
      label: "Platform administration access is required.",
    };
  }

  const platformAccess = await getPlatformAdminAccess();

  if (
    platformAccess.mode === "foundation_demo"
  ) {
    return {
      kind: "mock",
    };
  }

  if (platformAccess.mode !== "authorized") {
    return {
      kind: "unavailable",
      label:
        "Platform administration access is required.",
    };
  }

  return {
    kind: "db",
    allowMockFallback: false,
  };
}

function logDbError(scope: string, error: unknown) {
  console.error(`[admin-data:${scope}] Query failed — using mock foundation data:`, error instanceof Error ? error.message : "unknown error");
}

const day = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? null;

// ── Clients ──────────────────────────────────────────────────
export async function getAdminClientsData(access?: TenantAccess): Promise<SourceMeta & { clients: AdminClientSummary[] }> {
  const gate = await resolveAdminDataGate(access);
  if (gate.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: gate.label, clients: [] };
  }
  const prisma = gate.kind === "db" ? getPrisma() : null;
  if (prisma && gate.kind === "db") {
    try {
      const rows = await prisma.client.findMany({
        include: { _count: { select: { businessBrands: true, serviceInstances: true, memberships: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        clients: rows.map((c) => ({
          id: c.id, name: c.name, status: c.status,
          brandCount: c._count.businessBrands,
          serviceCount: c._count.serviceInstances,
          memberCount: c._count.memberships,
          createdAt: c.createdAt.toISOString().slice(0, 10),
        })),
      };
    } catch (error) {
      logDbError("clients", error);
      if (!gate.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", clients: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, clients: MOCK_CLIENTS };
}

// ── Team (profiles via memberships) ──────────────────────────
export async function getAdminTeamData(access?: TenantAccess): Promise<SourceMeta & { members: TeamMemberSummary[] }> {
  const gate = await resolveAdminDataGate(access);
  if (gate.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: gate.label, members: [] };
  }
  const prisma = gate.kind === "db" ? getPrisma() : null;
  if (prisma && gate.kind === "db") {
    try {
      const rows = await prisma.clientMembership.findMany({
        select: {
          id: true,
          profileId: true,
          clientId: true,
          role: true,
          status: true,
          createdAt: true,
          profile: {
            select: {
              displayName: true,
              email: true,
              status: true,
            },
          },
          client: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [
          {
            client: {
              name: "asc",
            },
          },
          {
            createdAt: "asc",
          },
        ],
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        members: rows.map((membership) => ({
          id: membership.id,
          profileId: membership.profileId,
          clientId: membership.clientId,
          displayName: membership.profile.displayName,
          email: membership.profile.email,
          role: membership.role,
          profileStatus: membership.profile.status,
          membershipStatus: membership.status,
          clientName: membership.client.name,
          createdAt:
            membership.createdAt.toISOString().slice(0, 10),
        })),
      };
    } catch (error) {
      logDbError("team", error);
      if (!gate.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", members: [] };
      }
    }
  }
  // Honest: no profiles are seeded because none exist without real auth users.
  return { source: "mock", sourceLabel: MOCK_LABEL, members: [] };
}

// ── Jobs monitor ─────────────────────────────────────────────
export async function getAdminJobsData(access?: TenantAccess): Promise<SourceMeta & { jobs: JobMonitorSummary[] }> {
  const gate = await resolveAdminDataGate(access);
  if (gate.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: gate.label, jobs: [] };
  }
  const prisma = gate.kind === "db" ? getPrisma() : null;
  if (prisma && gate.kind === "db") {
    try {
      const rows = await prisma.job.findMany({
        include: {
          client: { select: { name: true } },
          logs: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        jobs: rows.map((j) => ({
          id: j.id, type: j.type, provider: j.provider, status: j.status,
          attempts: j.attempts, maxAttempts: j.maxAttempts,
          clientName: j.client?.name ?? null,
          scheduledFor: day(j.scheduledFor),
          errorMessage: j.errorMessage, // seeded null; safe text only, never payloads
          createdAt: j.createdAt.toISOString().slice(0, 10),
          logs: j.logs.map((l) => ({ id: l.id, level: l.level, message: l.message, createdAt: l.createdAt.toISOString().slice(0, 10) })),
        })),
      };
    } catch (error) {
      logDbError("jobs", error);
      if (!gate.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", jobs: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, jobs: MOCK_JOBS };
}

// ── Integration events ───────────────────────────────────────
export async function getAdminIntegrationEventsData(access?: TenantAccess): Promise<SourceMeta & { events: IntegrationEventSummary[] }> {
  const gate = await resolveAdminDataGate(access);
  if (gate.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: gate.label, events: [] };
  }
  const prisma = gate.kind === "db" ? getPrisma() : null;
  if (prisma && gate.kind === "db") {
    try {
      const rows = await prisma.integrationEvent.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
      return {
        source: "database", sourceLabel: DB_LABEL,
        events: rows.map((e) => ({
          id: e.id, provider: e.provider, eventType: e.eventType, status: e.status,
          errorMessage: e.errorMessage, // adapter-written safe text; payload json is NEVER selected here
          createdAt: e.createdAt.toISOString().slice(0, 10),
        })),
      };
    } catch (error) {
      logDbError("events", error);
      if (!gate.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", events: [] };
      }
    }
  }
  // Honest: zero events exist until a real webhook/test writes one.
  return { source: "mock", sourceLabel: MOCK_LABEL, events: [] };
}

// ── Audit log ────────────────────────────────────────────────
export async function getAdminAuditLogsData(access?: TenantAccess): Promise<SourceMeta & { entries: AuditLogSummary[] }> {
  const gate = await resolveAdminDataGate(access);
  if (gate.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: gate.label, entries: [] };
  }
  const prisma = gate.kind === "db" ? getPrisma() : null;
  if (prisma && gate.kind === "db") {
    try {
      const rows = await prisma.auditLog.findMany({
        include: {
          profile: { select: { displayName: true, email: true } },
          client: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        entries: rows.map((a) => ({
          id: a.id, action: a.action, entityType: a.entityType, entityId: a.entityId,
          actorName: a.profile?.displayName ?? a.profile?.email ?? null,
          clientName: a.client?.name ?? null,
          note: safeNote(a.metadata), // note string only — no raw JSON, IP, or user agent
          createdAt: a.createdAt.toISOString().slice(0, 10),
        })),
      };
    } catch (error) {
      logDbError("audit", error);
      if (!gate.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", entries: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, entries: MOCK_AUDIT };
}

// ── Notifications ────────────────────────────────────────────
export async function getAdminNotificationsData(access?: TenantAccess): Promise<SourceMeta & { notifications: AdminNotificationSummary[] }> {
  const gate = await resolveAdminDataGate(access);
  if (gate.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: gate.label, notifications: [] };
  }
  const prisma = gate.kind === "db" ? getPrisma() : null;
  if (prisma && gate.kind === "db") {
    try {
      const rows = await prisma.notification.findMany({
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        notifications: rows.map((n) => ({
          id: n.id, type: n.type, title: n.title, message: n.message, status: n.status,
          clientName: n.client?.name ?? null,
          createdAt: n.createdAt.toISOString().slice(0, 10),
        })),
      };
    } catch (error) {
      logDbError("notifications", error);
      if (!gate.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", notifications: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, notifications: MOCK_NOTIFICATIONS };
}

// ── Services ─────────────────────────────────────────────────
const MOCK_SERVICES: AdminServiceSummary[] = [
  { id: "m_as1", name: "Social Media Management (planned)", serviceType: "social_media", provider: "metricool", status: "planned", clientName: "Restaurant Demo Client", brandName: "Montreal Restaurant Hub Demo", priceCents: null, currency: "CAD", renewalDate: null },
  { id: "m_as2", name: "Web Hosting (planned)", serviceType: "web_hosting", provider: "upmind", status: "planned", clientName: "TAKATAK Demo Client", brandName: "TAKATAK Demo Brand", priceCents: null, currency: "CAD", renewalDate: null },
];

export async function getAdminServicesData(access?: TenantAccess): Promise<SourceMeta & { services: AdminServiceSummary[] }> {
  const gate = await resolveAdminDataGate(access);
  if (gate.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: gate.label, services: [] };
  }
  const prisma = gate.kind === "db" ? getPrisma() : null;
  if (prisma && gate.kind === "db") {
    try {
      const rows = await prisma.serviceInstance.findMany({
        include: { client: { select: { name: true } }, businessBrand: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        services: rows.map((s) => ({
          id: s.id, name: s.name, serviceType: s.serviceType, provider: s.provider,
          status: s.status, clientName: s.client.name, brandName: s.businessBrand?.name ?? null,
          priceCents: s.priceCents, currency: s.currency, renewalDate: day(s.renewalDate),
        })),
      };
    } catch (error) {
      logDbError("services", error);
      if (!gate.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", services: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, services: MOCK_SERVICES };
}

// ── Profiles (spec alias of team data) ───────────────────────
export const getAdminProfilesData = getAdminTeamData;

// ── System health (env/config status only — NO provider calls) ─
export function getAdminSystemHealthData(): { app: AdminSystemHealthItem[]; providers: AdminSystemHealthItem[]; foundations: AdminSystemHealthItem[] } {
  const db = getDatabaseEnvStatus();
  const auth = isSupabaseConfigured();
  const metricool = getMetricoolEnvStatus();
  const upmind = getUpmindEnvStatus();
  const openai = getOpenAiStatus();
  const tryholo = getTryHoloStatus();
  return {
    app: [
      { label: "App", value: "Running", ok: true },
      { label: "Database env", value: db.configured ? "Configured" : "Not configured", ok: db.configured },
      { label: "Supabase auth env", value: auth ? "Configured" : "Not configured", ok: auth },
    ],
    providers: [
      // Env presence only — "Connected" is NEVER shown here; a real connected
      // state lives on IntegrationAccount after a verified credentialed test.
      { label: "Metricool", value: metricool.configured ? "Configured (untested)" : "Not configured", ok: metricool.configured ? null : false },
      { label: "Upmind", value: upmind.configured ? "Configured (untested)" : "Not configured", ok: upmind.configured ? null : false },
      { label: "OpenAI", value: openai.configured ? "Key present (unverified)" : "Not configured", ok: openai.configured ? null : false },
      { label: "TryHolo", value: tryholo.state === "disabled" ? "Disabled (flag off)" : tryholo.configured ? "Configured (untested)" : "Not configured", ok: null },
    ],
    foundations: [
      { label: "Reporting export/delivery", value: "Not active", ok: null },
      { label: "AI generation", value: "Not active", ok: null },
      { label: "QMAPS / Google Business", value: "Not connected", ok: null },
      { label: "FLEXS / outreach automation", value: "Not connected", ok: null },
      { label: "Job workers", value: "Not active", ok: null },
      { label: "Admin write actions", value: "Not active", ok: null },
      { label: "Tenant isolation (server scoping)", value: "Enforced (qa:tenant-isolation)", ok: true },
      { label: "Tenant isolation (live Supabase E2E)", value: "Pending staging", ok: null },
    ],
  };
}

// ── Overview ─────────────────────────────────────────────────
export async function getAdminOverviewData(access?: TenantAccess): Promise<AdminOverviewData> {
  const [clients, team, jobs, events, audit, notifications] = await Promise.all([
    getAdminClientsData(access),
    getAdminTeamData(access),
    getAdminJobsData(access),
    getAdminIntegrationEventsData(access),
    getAdminAuditLogsData(access),
    getAdminNotificationsData(access),
  ]);
  const jobStatusOrder = ["planned", "queued", "running", "completed", "failed", "cancelled"];
  return {
    source: jobs.source,
    sourceLabel: jobs.sourceLabel,
    kpis: {
      clients: clients.clients.length,
      teamMembers: team.members.length,
      jobs: jobs.jobs.length,
      plannedJobs: jobs.jobs.filter((j) => j.status === "planned").length,
      runningJobs: jobs.jobs.filter((j) => j.status === "running").length, // 0 — no workers
      integrationEvents: events.events.length,
      auditEntries: audit.entries.length,
      unreadNotifications: notifications.notifications.filter((n) => n.status === "unread").length,
    },
    jobStatusCounts: jobStatusOrder.map((status) => ({
      status,
      count: jobs.jobs.filter((j) => j.status === status).length,
    })),
    recentAudit: audit.entries.slice(0, 5),
    recentEvents: events.events.slice(0, 5),
    notifications: notifications.notifications.slice(0, 5),
  };
}
