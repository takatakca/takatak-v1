import "server-only";

// First-party analytics — collection and tenant-scoped reporting.

import { createHmac, randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";

import {
  classifyBrowser,
  classifyDevice,
  geoFromHeaders,
  isBotUserAgent,
  normalizeSiteDomain,
  originAllowed,
  originsForDomain,
  type AudienceRuleInput,
  type CollectPayload,
} from "./parse";

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  return prisma;
}

// ---------------------------------------------------------------- hashing

// ANALYTICS_HASH_SECRET keeps visitor hashes stable across processes for a day.
// Without it each process uses its own random secret (counts become per-process).
const PROCESS_SECRET = randomBytes(32);

function hashSecret(): Buffer | string {
  const configured = process.env.ANALYTICS_HASH_SECRET?.trim();
  return configured && configured.length >= 32 ? configured : PROCESS_SECRET;
}

/** Daily-rotating, non-reversible visitor id. Raw IP/UA are never stored. */
export function dailyVisitorHash(siteId: string, ip: string, userAgent: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const daySalt = createHmac("sha256", hashSecret()).update(`day:${day}`).digest();
  return createHmac("sha256", daySalt).update(`${siteId}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

export function clientIpFromHeaders(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

// -------------------------------------------------------------- collection

type SiteCacheEntry = { id: string; clientId: string; active: boolean; allowedOrigins: string[]; at: number };
const siteCache = new Map<string, SiteCacheEntry>();
const SITE_CACHE_MS = 60_000;

async function siteByKey(publicKey: string): Promise<SiteCacheEntry | null> {
  const cached = siteCache.get(publicKey);
  if (cached && Date.now() - cached.at < SITE_CACHE_MS) return cached;
  const site = await requirePrisma().analyticsSite.findUnique({
    where: { publicKey },
    select: { id: true, clientId: true, active: true, allowedOrigins: true },
  });
  if (!site) {
    siteCache.delete(publicKey);
    return null;
  }
  if (siteCache.size > 2000) siteCache.clear();
  const entry = { ...site, at: Date.now() };
  siteCache.set(publicKey, entry);
  return entry;
}

export type CollectResult = { ok: true; allowOrigin: string | null } | { ok: false; status: 202 | 403 | 404; allowOrigin: string | null };

export async function recordAnalyticsEvent(payload: CollectPayload, headers: Headers): Promise<CollectResult> {
  const site = await siteByKey(payload.key);
  if (!site || !site.active) return { ok: false, status: 404, allowOrigin: null };
  const origin = headers.get("origin");
  if (!originAllowed(origin, site.allowedOrigins)) return { ok: false, status: 403, allowOrigin: null };
  const allowOrigin = origin!.toLowerCase();
  if (!originAllowed(`https://${payload.pageHost}`, site.allowedOrigins) && !originAllowed(`http://${payload.pageHost}`, site.allowedOrigins)) {
    return { ok: false, status: 403, allowOrigin };
  }
  const ua = headers.get("user-agent") ?? "";
  // Bots and Global Privacy Control requests are acknowledged but not stored.
  if (isBotUserAgent(ua) || headers.get("sec-gpc") === "1") return { ok: false, status: 202, allowOrigin };

  const geo = geoFromHeaders(headers);
  await requirePrisma().analyticsEvent.create({
    data: {
      siteId: site.id,
      clientId: site.clientId,
      type: payload.type,
      name: payload.name,
      path: payload.path,
      referrerHost: payload.referrerHost,
      utmSource: payload.utmSource,
      utmMedium: payload.utmMedium,
      utmCampaign: payload.utmCampaign,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      device: classifyDevice(ua),
      browser: classifyBrowser(ua),
      visitorHash: dailyVisitorHash(site.id, clientIpFromHeaders(headers), ua),
    },
  });
  return { ok: true, allowOrigin };
}

/** For CORS preflight: echo the origin only when it belongs to some active site. */
export async function originAllowedForKey(publicKey: string, origin: string | null): Promise<boolean> {
  const site = await siteByKey(publicKey);
  return Boolean(site && site.active && originAllowed(origin, site.allowedOrigins));
}

// --------------------------------------------------------------- dashboard

export function newSitePublicKey(): string {
  return `tk_${randomBytes(18).toString("base64url")}`;
}

export async function createAnalyticsSite(
  clientId: string,
  input: { name: string; domain: string; businessBrandId: string | null },
): Promise<{ id: string; publicKey: string } | { error: string }> {
  const domain = normalizeSiteDomain(input.domain);
  if (!domain) return { error: "Enter a valid website domain, e.g. garageverdun.ca." };
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 2) return { error: "Name the website." };
  const prisma = requirePrisma();
  if (input.businessBrandId) {
    const brand = await prisma.businessBrand.findFirst({ where: { id: input.businessBrandId, clientId }, select: { id: true } });
    if (!brand) return { error: "That brand is not in this workspace." };
  }
  return prisma.analyticsSite.create({
    data: {
      clientId,
      businessBrandId: input.businessBrandId,
      name,
      domain,
      publicKey: newSitePublicKey(),
      allowedOrigins: originsForDomain(domain),
    },
    select: { id: true, publicKey: true },
  });
}

export async function setAnalyticsSiteActive(clientId: string, siteId: string, active: boolean): Promise<boolean> {
  const result = await requirePrisma().analyticsSite.updateMany({ where: { id: siteId, clientId }, data: { active } });
  for (const [key, entry] of siteCache) if (entry.id === siteId) siteCache.delete(key);
  return result.count === 1;
}

export interface AnalyticsSummary {
  sites: Array<{
    id: string;
    name: string;
    domain: string;
    publicKey: string;
    active: boolean;
    brandName: string | null;
    ga4PropertyId: string | null;
    searchConsoleProperty: string | null;
  }>;
  selectedSiteId: string | null;
  days: number;
  totals: { pageviews: number; visitors: number; events: number; conversions: number; convertingVisitors: number };
  daily: Array<{ day: string; pageviews: number; visitors: number; conversions: number }>;
  topPages: Array<{ label: string; count: number }>;
  topReferrers: Array<{ label: string; count: number }>;
  campaigns: Array<{ label: string; count: number }>;
  devices: Array<{ label: string; count: number }>;
  countries: Array<{ label: string; count: number }>;
  conversions: Array<{ label: string; count: number }>;
  audiences: Array<{
    id: string;
    name: string;
    siteName: string;
    pathPrefixes: string[];
    eventNames: string[];
    lookbackDays: number;
    reach: number;
  }>;
  brands: Array<{ id: string; name: string }>;
}

type Row = { label: string | null; count: bigint };

async function topBy(
  prisma: ReturnType<typeof requirePrisma>,
  column: Prisma.Sql,
  where: Prisma.Sql,
  limit = 8,
): Promise<Array<{ label: string; count: number }>> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT ${column} AS label, COUNT(*)::bigint AS count
    FROM "analytics_events"
    WHERE ${where} AND ${column} IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT ${limit}`;
  return rows.map((r) => ({ label: String(r.label), count: Number(r.count) }));
}

function audienceWhere(clientId: string, a: { siteId: string; pathPrefixes: string[]; eventNames: string[]; lookbackDays: number }) {
  const since = new Date(Date.now() - a.lookbackDays * 86_400_000);
  const ors: Prisma.Sql[] = [];
  for (const prefix of a.pathPrefixes) {
    ors.push(Prisma.sql`("type" = 'pageview' AND "path" LIKE ${prefix.replace(/[\\%_]/g, "\\$&") + "%"})`);
  }
  if (a.eventNames.length) ors.push(Prisma.sql`("name" = ANY(${a.eventNames}::text[]))`);
  return Prisma.sql`"clientId" = ${clientId}::uuid AND "siteId" = ${a.siteId}::uuid AND "occurredAt" >= ${since} AND (${Prisma.join(ors, " OR ")})`;
}

export async function estimateAudienceReach(
  clientId: string,
  audience: { siteId: string; pathPrefixes: string[]; eventNames: string[]; lookbackDays: number },
): Promise<number> {
  if (audience.pathPrefixes.length === 0 && audience.eventNames.length === 0) return 0;
  const prisma = requirePrisma();
  // Visitor ids rotate daily, so this counts distinct visitor-days (an upper bound on people).
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT "visitorHash")::bigint AS count FROM "analytics_events" WHERE ${audienceWhere(clientId, audience)}`;
  return Number(rows[0]?.count ?? 0);
}

export async function getAnalyticsSummary(clientId: string, opts: { siteId?: string | null; days?: number } = {}): Promise<AnalyticsSummary> {
  const prisma = requirePrisma();
  const days = opts.days === 7 || opts.days === 90 ? opts.days : 30;
  const since = new Date(Date.now() - days * 86_400_000);

  const [sites, audiences, brands] = await Promise.all([
    prisma.analyticsSite.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        domain: true,
        publicKey: true,
        active: true,
        ga4PropertyId: true,
        searchConsoleProperty: true,
        businessBrand: { select: { name: true } },
      },
    }),
    prisma.analyticsAudience.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, siteId: true, pathPrefixes: true, eventNames: true, lookbackDays: true, site: { select: { name: true } } },
    }),
    prisma.businessBrand.findMany({ where: { clientId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const selectedSiteId = opts.siteId && sites.some((s) => s.id === opts.siteId) ? opts.siteId : null;
  const where = selectedSiteId
    ? Prisma.sql`"clientId" = ${clientId}::uuid AND "siteId" = ${selectedSiteId}::uuid AND "occurredAt" >= ${since}`
    : Prisma.sql`"clientId" = ${clientId}::uuid AND "occurredAt" >= ${since}`;

  const [dailyRows, topPages, topReferrers, campaigns, devices, countries, conversions] = await Promise.all([
    prisma.$queryRaw<Array<{ day: Date; pageviews: bigint; visitors: bigint; events: bigint; conversions: bigint; converting: bigint }>>`
      SELECT date_trunc('day', "occurredAt") AS day,
             COUNT(*) FILTER (WHERE "type" = 'pageview')::bigint AS pageviews,
             COUNT(DISTINCT "visitorHash")::bigint AS visitors,
             COUNT(*) FILTER (WHERE "type" = 'event')::bigint AS events,
             COUNT(*) FILTER (WHERE "type" = 'conversion')::bigint AS conversions,
             COUNT(DISTINCT "visitorHash") FILTER (WHERE "type" = 'conversion')::bigint AS converting
      FROM "analytics_events" WHERE ${where}
      GROUP BY 1 ORDER BY 1`,
    topBy(prisma, Prisma.sql`"path"`, Prisma.sql`${where} AND "type" = 'pageview'`),
    topBy(prisma, Prisma.sql`"referrerHost"`, Prisma.sql`${where} AND "type" = 'pageview'`),
    topBy(prisma, Prisma.sql`"utmCampaign"`, Prisma.sql`${where} AND "type" = 'pageview'`),
    topBy(prisma, Prisma.sql`"device"`, Prisma.sql`${where} AND "type" = 'pageview'`, 3),
    topBy(prisma, Prisma.sql`"country"`, Prisma.sql`${where} AND "type" = 'pageview'`),
    topBy(prisma, Prisma.sql`"name"`, Prisma.sql`${where} AND "type" = 'conversion'`),
  ]);

  const byDay = new Map(dailyRows.map((r) => [r.day.toISOString().slice(0, 10), r]));
  const daily: AnalyticsSummary["daily"] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(key);
    daily.push({ day: key, pageviews: Number(r?.pageviews ?? 0), visitors: Number(r?.visitors ?? 0), conversions: Number(r?.conversions ?? 0) });
  }

  const reach = await Promise.all(audiences.map((a) => estimateAudienceReach(clientId, a)));

  return {
    sites: sites.map((s) => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      publicKey: s.publicKey,
      active: s.active,
      brandName: s.businessBrand?.name ?? null,
      ga4PropertyId: s.ga4PropertyId,
      searchConsoleProperty: s.searchConsoleProperty,
    })),
    selectedSiteId,
    days,
    totals: {
      pageviews: dailyRows.reduce((sum, r) => sum + Number(r.pageviews), 0),
      visitors: dailyRows.reduce((sum, r) => sum + Number(r.visitors), 0),
      events: dailyRows.reduce((sum, r) => sum + Number(r.events), 0),
      conversions: dailyRows.reduce((sum, r) => sum + Number(r.conversions), 0),
      convertingVisitors: dailyRows.reduce((sum, r) => sum + Number(r.converting), 0),
    },
    daily,
    topPages,
    topReferrers,
    campaigns,
    devices,
    countries,
    conversions,
    audiences: audiences.map((a, i) => ({
      id: a.id,
      name: a.name,
      siteName: a.site.name,
      pathPrefixes: a.pathPrefixes,
      eventNames: a.eventNames,
      lookbackDays: a.lookbackDays,
      reach: reach[i],
    })),
    brands,
  };
}

export async function createAudience(clientId: string, siteId: string, rule: AudienceRuleInput): Promise<{ id: string } | { error: string }> {
  const prisma = requirePrisma();
  const site = await prisma.analyticsSite.findFirst({ where: { id: siteId, clientId }, select: { id: true } });
  if (!site) return { error: "Choose a website in this workspace." };
  return prisma.analyticsAudience.create({ data: { clientId, siteId, ...rule }, select: { id: true } });
}

export async function deleteAudience(clientId: string, audienceId: string): Promise<boolean> {
  const result = await requirePrisma().analyticsAudience.deleteMany({ where: { id: audienceId, clientId } });
  return result.count === 1;
}

export async function listAudiencesWithReach(clientId: string): Promise<AnalyticsSummary["audiences"]> {
  const audiences = await requirePrisma().analyticsAudience.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, siteId: true, pathPrefixes: true, eventNames: true, lookbackDays: true, site: { select: { name: true } } },
  });
  const reach = await Promise.all(audiences.map((a) => estimateAudienceReach(clientId, a)));
  return audiences.map((a, i) => ({
    id: a.id,
    name: a.name,
    siteName: a.site.name,
    pathPrefixes: a.pathPrefixes,
    eventNames: a.eventNames,
    lookbackDays: a.lookbackDays,
    reach: reach[i],
  }));
}

export async function linkGoogleSources(
  clientId: string,
  siteId: string,
  links: { ga4PropertyId: string | null; searchConsoleProperty: string | null },
): Promise<boolean> {
  const result = await requirePrisma().analyticsSite.updateMany({
    where: { id: siteId, clientId },
    data: { ga4PropertyId: links.ga4PropertyId, searchConsoleProperty: links.searchConsoleProperty },
  });
  return result.count === 1;
}

export async function listGoogleLinkedSites(clientId: string) {
  return requirePrisma().analyticsSite.findMany({
    where: { clientId, OR: [{ ga4PropertyId: { not: null } }, { searchConsoleProperty: { not: null } }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, domain: true, ga4PropertyId: true, searchConsoleProperty: true },
  });
}
