import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

import { normalizeHost, runAudit, type Fetcher } from "./audit";

export const AUDIT_COOLDOWN_MS = 3 * 60 * 1000;
export const DAILY_AUDIT_LIMIT = 20;
export const MAX_STORED_ISSUES = 300;

export type SeoSite = { host: string; label: string; source: "domain" | "brand" };

type Db = Pick<PrismaClient, "domainAsset" | "businessBrand" | "seoAudit" | "seoAuditIssue" | "$transaction">;

/** Websites this workspace owns: domain assets and brand websites. */
export async function listWorkspaceSites(db: Db, clientId: string): Promise<SeoSite[]> {
  const [domains, brands] = await Promise.all([
    db.domainAsset.findMany({
      where: { clientId, status: { not: "cancelled" } },
      select: { domainName: true },
      take: 200,
    }),
    db.businessBrand.findMany({
      where: { clientId, website: { not: null } },
      select: { name: true, website: true },
      take: 200,
    }),
  ]);
  const sites = new Map<string, SeoSite>();
  for (const domain of domains) {
    const host = normalizeHost(domain.domainName);
    if (host && !sites.has(host)) sites.set(host, { host, label: host, source: "domain" });
  }
  for (const brand of brands) {
    const host = brand.website ? normalizeHost(brand.website) : null;
    if (host && !sites.has(host)) sites.set(host, { host, label: `${host} (${brand.name})`, source: "brand" });
  }
  return [...sites.values()].sort((a, b) => a.host.localeCompare(b.host));
}

export type StartAuditResult =
  | { ok: true; auditId: string; score: number | null; status: "completed" | "failed" }
  | { ok: false; reason: "invalid_host" | "not_workspace_site" | "busy" | "daily_limit" };

export async function startSeoAudit(
  db: Db,
  input: { clientId: string; profileId: string | null; host: string; fetcher?: Fetcher; now?: Date },
): Promise<StartAuditResult> {
  const now = input.now ?? new Date();
  const host = normalizeHost(input.host);
  if (!host) return { ok: false, reason: "invalid_host" };

  const sites = await listWorkspaceSites(db, input.clientId);
  if (!sites.some((site) => site.host === host)) return { ok: false, reason: "not_workspace_site" };

  const recentRunning = await db.seoAudit.count({
    where: {
      clientId: input.clientId,
      status: "running",
      startedAt: { gte: new Date(now.getTime() - AUDIT_COOLDOWN_MS) },
    },
  });
  if (recentRunning > 0) return { ok: false, reason: "busy" };

  const today = await db.seoAudit.count({
    where: { clientId: input.clientId, startedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
  });
  if (today >= DAILY_AUDIT_LIMIT) return { ok: false, reason: "daily_limit" };

  const audit = await db.seoAudit.create({
    data: { clientId: input.clientId, host, status: "running", requestedProfileId: input.profileId },
    select: { id: true },
  });

  try {
    const result = await runAudit(host, { fetcher: input.fetcher });
    await db.$transaction([
      db.seoAudit.update({
        where: { id: audit.id },
        data: {
          status: "completed",
          score: result.score,
          pagesScanned: result.summary.pagesScanned,
          summary: {
            ...result.summary,
            site: result.site,
            pages: result.pages.map((page) => ({
              url: page.url,
              status: page.status,
              elapsedMs: page.elapsedMs,
              title: page.signals?.title ?? null,
            })),
          } as unknown as Prisma.InputJsonObject,
          finishedAt: new Date(),
        },
      }),
      db.seoAuditIssue.createMany({
        data: result.issues.slice(0, MAX_STORED_ISSUES).map((issue) => ({
          auditId: audit.id,
          clientId: input.clientId,
          checkKey: issue.checkKey,
          severity: issue.severity,
          pageUrl: issue.pageUrl ? issue.pageUrl.slice(0, 2000) : null,
          detail: issue.detail.slice(0, 500),
        })),
      }),
    ]);
    return { ok: true, auditId: audit.id, score: result.score, status: "completed" };
  } catch {
    await db.seoAudit.update({
      where: { id: audit.id },
      data: { status: "failed", failureReason: "The website could not be audited.", finishedAt: new Date() },
    });
    return { ok: true, auditId: audit.id, score: null, status: "failed" };
  }
}

export type SeoOverviewSite = SeoSite & {
  latest: {
    id: string;
    status: string;
    score: number | null;
    pagesScanned: number;
    startedAt: Date;
    finishedAt: Date | null;
    issues: { checkKey: string; severity: string; pageUrl: string | null; detail: string | null }[];
  } | null;
};

/** Sites of the workspace with their most recent audit (tenant-scoped). */
export async function loadSeoOverview(
  db: Db,
  clientId: string,
  now: Date = new Date(),
): Promise<SeoOverviewSite[]> {
  const sites = await listWorkspaceSites(db, clientId);
  if (!sites.length) return [];
  const audits = await db.seoAudit.findMany({
    where: { clientId, host: { in: sites.map((site) => site.host) } },
    orderBy: { startedAt: "desc" },
    take: 200,
    select: {
      id: true, host: true, status: true, score: true, pagesScanned: true,
      startedAt: true, finishedAt: true,
    },
  });
  const latestByHost = new Map<string, (typeof audits)[number]>();
  for (const audit of audits) if (!latestByHost.has(audit.host)) latestByHost.set(audit.host, audit);

  const latestIds = [...latestByHost.values()].map((audit) => audit.id);
  const issues = latestIds.length
    ? await db.seoAuditIssue.findMany({
        where: { clientId, auditId: { in: latestIds } },
        select: { auditId: true, checkKey: true, severity: true, pageUrl: true, detail: true },
        take: 2000,
      })
    : [];

  return sites.map((site) => {
    const audit = latestByHost.get(site.host);
    return {
      ...site,
      latest: audit
        ? {
            id: audit.id,
            // A run that never finished (process restart) is reported as interrupted.
            status:
              audit.status === "running" &&
              now.getTime() - audit.startedAt.getTime() > AUDIT_COOLDOWN_MS
                ? "interrupted"
                : audit.status,
            score: audit.score,
            pagesScanned: audit.pagesScanned,
            startedAt: audit.startedAt,
            finishedAt: audit.finishedAt,
            issues: issues
              .filter((issue) => issue.auditId === audit.id)
              .map(({ checkKey, severity, pageUrl, detail }) => ({ checkKey, severity, pageUrl, detail })),
          }
        : null,
    };
  });
}
