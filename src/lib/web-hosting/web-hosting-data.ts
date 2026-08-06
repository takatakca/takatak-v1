// Phase 7 — Web/hosting data access. DB-first, honest mock fallback.
// Never claims "database" unless real queries succeeded. Never crashes pages.

import { getPrisma } from "@/lib/db/prisma";
import { clientWhere, resolveDataScope } from "@/lib/security/data-scope";
import type { TenantAccess } from "@/lib/security/tenant-access";
import type {
  DnsRecordSummary,
  DomainSummary,
  HostingServiceSummary,
  ProvisioningStepSummary,
  SourceMeta,
  SslCertificateSummary,
  WebHostingOverviewData,
} from "./types";

const MOCK_LABEL = "Mock foundation data — database not connected yet.";
const DB_LABEL = "Database — live foundation records (Upmind not connected).";

// ── Mock foundation data (mirrors the seed, clearly internal demo) ──
const MOCK_DOMAINS: DomainSummary[] = [
  { id: "m_d1", domainName: "montrealrestauranthub.demo", brandName: "Montreal Restaurant Hub Demo", registrar: "internal_demo", status: "pending_connection", dnsStatus: "pending", sslStatus: "pending", autoRenew: false, expiresAt: null },
  { id: "m_d2", domainName: "takatak.demo", brandName: "TAKATAK Demo Brand", registrar: "internal_demo", status: "planned", dnsStatus: "not_configured", sslStatus: "not_configured", autoRenew: false, expiresAt: null },
];

const MOCK_HOSTING: HostingServiceSummary[] = [
  { id: "m_h1", planName: "Bronze Hosting Foundation", brandName: "Montreal Restaurant Hub Demo", primaryDomain: "montrealrestauranthub.demo", status: "pending_setup", serverStatus: "pending", renewalDate: null, usageSummary: null },
  { id: "m_h2", planName: "SaaS Hosting Foundation", brandName: "TAKATAK Demo Brand", primaryDomain: "takatak.demo", status: "planned", serverStatus: "unknown", renewalDate: null, usageSummary: null },
];

const MOCK_DNS: DnsRecordSummary[] = [
  { id: "m_r1", domainName: "montrealrestauranthub.demo", type: "A", name: "@", value: "0.0.0.0 (internal demo placeholder)", ttl: 3600, status: "planned", source: "internal_demo" },
  { id: "m_r2", domainName: "montrealrestauranthub.demo", type: "CNAME", name: "www", value: "montrealrestauranthub.demo (internal demo placeholder)", ttl: 3600, status: "planned", source: "internal_demo" },
];

const MOCK_SSL: SslCertificateSummary[] = [
  { id: "m_s1", domainName: "montrealrestauranthub.demo", status: "pending", issuer: null, validFrom: null, expiresAt: null, autoRenew: false, source: "internal_demo" },
  { id: "m_s2", domainName: "takatak.demo", status: "planned", issuer: null, validFrom: null, expiresAt: null, autoRenew: false, source: "internal_demo" },
];

const STEP_ORDER = ["order_received", "payment_confirmed", "hosting_created", "domain_connected", "dns_checked", "ssl_requested", "ssl_ready", "website_live"];
const STEP_TITLES: Record<string, string> = {
  order_received: "Order received", payment_confirmed: "Payment confirmed", hosting_created: "Hosting created",
  domain_connected: "Domain connected", dns_checked: "DNS checked", ssl_requested: "SSL requested",
  ssl_ready: "SSL ready", website_live: "Website live",
};
const MOCK_STEPS: ProvisioningStepSummary[] = [
  ...STEP_ORDER.map((t, i) => ({
    id: `m_ps_r_${t}`, groupName: "Bronze Hosting Foundation — Montreal Restaurant Hub Demo",
    type: t, title: STEP_TITLES[t],
    status: t === "order_received" ? "completed_internal" : ["hosting_created", "domain_connected", "dns_checked"].includes(t) ? "pending" : "planned",
    order: i, plannedAt: null, startedAt: null, completedAt: null, errorMessage: null,
  })),
  ...STEP_ORDER.map((t, i) => ({
    id: `m_ps_t_${t}`, groupName: "SaaS Hosting Foundation — TAKATAK Demo Brand",
    type: t, title: STEP_TITLES[t], status: "planned",
    order: i, plannedAt: null, startedAt: null, completedAt: null, errorMessage: null,
  })),
];

function logDbError(scope: string, error: unknown) {
  console.error(`[web-hosting-data:${scope}] Query failed — using mock foundation data:`, error instanceof Error ? error.message : "unknown error");
}

function countBy<T>(rows: T[], key: (row: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
}

// ── Domains ──────────────────────────────────────────────────
export async function getDomainAssetsData(access?: TenantAccess): Promise<SourceMeta & { domains: DomainSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, domains: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.domainAsset.findMany({
        where: clientWhere(scope),
        include: { businessBrand: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        domains: rows.map((d) => ({
          id: d.id, domainName: d.domainName, brandName: d.businessBrand?.name ?? null,
          registrar: d.registrar, status: d.status, dnsStatus: d.dnsStatus, sslStatus: d.sslStatus,
          autoRenew: d.autoRenew, expiresAt: d.expiresAt?.toISOString().slice(0, 10) ?? null,
        })),
      };
    } catch (error) {
      logDbError("domains", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", domains: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, domains: MOCK_DOMAINS };
}

// ── Hosting services ─────────────────────────────────────────
export async function getHostingServicesData(access?: TenantAccess): Promise<SourceMeta & { hostingServices: HostingServiceSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, hostingServices: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.hostingService.findMany({
        where: clientWhere(scope),
        include: { businessBrand: { select: { name: true } }, primaryDomain: { select: { domainName: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        hostingServices: rows.map((h) => ({
          id: h.id, planName: h.planName, brandName: h.businessBrand?.name ?? null,
          primaryDomain: h.primaryDomain?.domainName ?? null, status: h.status, serverStatus: h.serverStatus,
          renewalDate: h.renewalDate?.toISOString().slice(0, 10) ?? null,
          usageSummary: (h.usageSummary as Record<string, unknown> | null) ?? null,
        })),
      };
    } catch (error) {
      logDbError("hosting", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", hostingServices: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, hostingServices: MOCK_HOSTING };
}

// ── DNS records ──────────────────────────────────────────────
export async function getDnsRecordsData(access?: TenantAccess): Promise<SourceMeta & { records: DnsRecordSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, records: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.dnsRecord.findMany({
        where: scope.clientIds ? { domainAsset: { clientId: { in: scope.clientIds } } } : undefined,
        include: { domainAsset: { select: { domainName: true } } },
        orderBy: [{ domainAssetId: "asc" }, { type: "asc" }],
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        records: rows.map((r) => ({
          id: r.id, domainName: r.domainAsset.domainName, type: r.type, name: r.name,
          value: r.value, ttl: r.ttl, status: r.status, source: r.source,
        })),
      };
    } catch (error) {
      logDbError("dns", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", records: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, records: MOCK_DNS };
}

// ── SSL certificates ─────────────────────────────────────────
export async function getSslCertificatesData(access?: TenantAccess): Promise<SourceMeta & { certificates: SslCertificateSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, certificates: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.sslCertificate.findMany({
        where: scope.clientIds ? { domainAsset: { clientId: { in: scope.clientIds } } } : undefined,
        include: { domainAsset: { select: { domainName: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        certificates: rows.map((c) => ({
          id: c.id, domainName: c.domainAsset.domainName, status: c.status, issuer: c.issuer,
          validFrom: c.validFrom?.toISOString().slice(0, 10) ?? null,
          expiresAt: c.expiresAt?.toISOString().slice(0, 10) ?? null,
          autoRenew: c.autoRenew, source: c.source,
        })),
      };
    } catch (error) {
      logDbError("ssl", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", certificates: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, certificates: MOCK_SSL };
}

// ── Provisioning timeline ────────────────────────────────────
export async function getProvisioningTimelineData(access?: TenantAccess): Promise<SourceMeta & { steps: ProvisioningStepSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, steps: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.provisioningStep.findMany({
        where: clientWhere(scope),
        include: {
          hostingService: { select: { planName: true } },
          businessBrand: { select: { name: true } },
        },
        orderBy: [{ hostingServiceId: "asc" }, { order: "asc" }],
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        steps: rows.map((s) => ({
          id: s.id,
          groupName: [s.hostingService?.planName, s.businessBrand?.name].filter(Boolean).join(" — ") || "Unassigned",
          type: s.type, title: s.title, status: s.status, order: s.order,
          plannedAt: s.plannedAt?.toISOString().slice(0, 10) ?? null,
          startedAt: s.startedAt?.toISOString().slice(0, 10) ?? null,
          completedAt: s.completedAt?.toISOString().slice(0, 10) ?? null,
          errorMessage: s.errorMessage,
        })),
      };
    } catch (error) {
      logDbError("provisioning", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", steps: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, steps: MOCK_STEPS };
}

// ── Overview ─────────────────────────────────────────────────
export async function getWebHostingOverviewData(access?: TenantAccess): Promise<WebHostingOverviewData> {
  const [domains, hosting, , ssl, steps] = await Promise.all([
    getDomainAssetsData(access),
    getHostingServicesData(access),
    getDnsRecordsData(access),
    getSslCertificatesData(access),
    getProvisioningTimelineData(access),
  ]);
  const source = domains.source; // all share DB configuration state
  return {
    source,
    sourceLabel: domains.sourceLabel,
    kpis: {
      domains: domains.domains.length,
      hostingServices: hosting.hostingServices.length,
      dnsWarnings: domains.domains.filter((d) => ["warning", "error"].includes(d.dnsStatus)).length,
      sslPending: ssl.certificates.filter((c) => ["pending", "planned"].includes(c.status)).length,
      provisioningSteps: steps.steps.length,
    },
    domains: domains.domains,
    hostingServices: hosting.hostingServices,
    dnsCounts: countBy(domains.domains, (d) => d.dnsStatus),
    sslCounts: countBy(ssl.certificates, (c) => c.status),
    provisioningSteps: steps.steps,
  };
}
