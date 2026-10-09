import "server-only";

// Monthly growth report: one tenant-scoped snapshot of everything TAKATAK did
// for a client in a calendar month, compared with the previous month. Every
// number comes from stored records; nothing is estimated.

import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";

export interface MonthRange {
  key: string; // YYYY-MM
  start: Date;
  end: Date; // exclusive
  label: string;
}

export function monthRange(key: string | null | undefined, now = new Date()): MonthRange {
  const match = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const safeMonth = month >= 0 && month <= 11 ? month : now.getUTCMonth();
  const start = new Date(Date.UTC(year, safeMonth, 1));
  const end = new Date(Date.UTC(year, safeMonth + 1, 1));
  return {
    key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
    start,
    end,
    label: start.toLocaleDateString("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

export function previousMonth(range: MonthRange): MonthRange {
  const prev = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth() - 1, 1));
  return monthRange(`${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`);
}

export interface ReportNumbers {
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

export interface GrowthReport {
  clientName: string;
  month: MonthRange;
  current: ReportNumbers;
  previous: ReportNumbers;
  topPages: Array<{ label: string; count: number }>;
  topSources: Array<{ label: string; count: number }>;
  conversionsByType: Array<{ label: string; count: number }>;
  highlights: string[];
}

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  return prisma;
}

async function numbersFor(clientId: string, range: MonthRange): Promise<ReportNumbers> {
  const prisma = requirePrisma();
  const when = { gte: range.start, lt: range.end };
  const [traffic, ratingAgg, clicks, requests, conversations, leads, runs, credits, adGroups] = await Promise.all([
    prisma.$queryRaw<Array<{ pageviews: bigint; visits: bigint; conversions: bigint }>>`
      SELECT COUNT(*) FILTER (WHERE "type" = 'pageview')::bigint AS pageviews,
             COUNT(DISTINCT ("visitorHash", date_trunc('day', "occurredAt"))) FILTER (WHERE "type" = 'pageview')::bigint AS visits,
             COUNT(*) FILTER (WHERE "type" = 'conversion')::bigint AS conversions
      FROM "analytics_events"
      WHERE "clientId" = ${clientId}::uuid AND "occurredAt" >= ${range.start} AND "occurredAt" < ${range.end}`,
    prisma.reviewResponse.aggregate({ where: { clientId, createdAt: when }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.reviewResponse.count({ where: { clientId, publicLinkClickedAt: when } }),
    prisma.reviewRequest.count({ where: { clientId, createdAt: when } }),
    prisma.chatConversation.count({ where: { clientId, createdAt: when } }),
    prisma.lead.count({ where: { clientId, createdAt: when } }),
    prisma.aiAgentRun.count({ where: { clientId, status: "completed", completedAt: when } }),
    prisma.aiCreditEntry.aggregate({ where: { clientId, reason: "debit", createdAt: when }, _sum: { delta: true } }),
    prisma.adEvent.groupBy({ by: ["type"], where: { occurredAt: when, campaign: { clientId } }, _count: { _all: true } }),
  ]);
  const ads = Object.fromEntries(adGroups.map((g) => [g.type, g._count._all])) as Record<string, number>;
  return {
    pageviews: Number(traffic[0]?.pageviews ?? 0),
    visits: Number(traffic[0]?.visits ?? 0),
    conversions: Number(traffic[0]?.conversions ?? 0),
    ratings: ratingAgg._count._all,
    averageRating: ratingAgg._avg.rating === null ? null : Math.round(ratingAgg._avg.rating * 10) / 10,
    publicReviewClicks: clicks,
    requestsSent: requests,
    conversations,
    leads,
    aiRunsCompleted: runs,
    creditsUsed: Math.abs(credits._sum.delta ?? 0),
    adImpressions: ads.impression ?? 0,
    adClicks: ads.click ?? 0,
  };
}

const TOP_COLUMNS = { path: Prisma.raw('"path"'), referrerHost: Prisma.raw('"referrerHost"'), name: Prisma.raw('"name"') } as const;

async function topFor(clientId: string, range: MonthRange, column: keyof typeof TOP_COLUMNS, type: "pageview" | "conversion") {
  const col = TOP_COLUMNS[column];
  const rows = await requirePrisma().$queryRaw<Array<{ label: string; count: bigint }>>`
    SELECT ${col} AS label, COUNT(*)::bigint AS count FROM "analytics_events"
    WHERE "clientId" = ${clientId}::uuid AND "occurredAt" >= ${range.start} AND "occurredAt" < ${range.end}
      AND "type" = ${type}::"AnalyticsEventType" AND ${col} IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 5`;
  return rows.map((r) => ({ label: String(r.label), count: Number(r.count) }));
}

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildHighlights(current: ReportNumbers, previous: ReportNumbers): string[] {
  const lines: string[] = [];
  const visitsChange = change(current.visits, previous.visits);
  if (current.visits > 0 && visitsChange !== null && visitsChange !== 0) {
    lines.push(`Visites du site ${visitsChange > 0 ? "en hausse" : "en baisse"} de ${Math.abs(visitsChange)} % par rapport au mois précédent.`);
  }
  if (current.conversions > 0) lines.push(`${current.conversions} actions de contact (appels, formulaires, WhatsApp) depuis le site.`);
  if (current.ratings > 0 && current.averageRating !== null) lines.push(`${current.ratings} nouveaux avis clients, note moyenne ${current.averageRating.toFixed(1)} / 5.`);
  if (current.publicReviewClicks > 0) lines.push(`${current.publicReviewClicks} clients redirigés vers Google ou Facebook pour publier un avis.`);
  if (current.leads > 0) lines.push(`${current.leads} nouveaux prospects ajoutés au pipeline.`);
  if (current.aiRunsCompleted > 0) lines.push(`${current.aiRunsCompleted} tâches réalisées par les agents IA (${current.creditsUsed} crédits).`);
  if (lines.length === 0) lines.push("Aucune activité enregistrée ce mois-ci.");
  return lines;
}

export async function getGrowthReport(clientId: string, monthKey: string | null | undefined): Promise<GrowthReport | null> {
  const prisma = requirePrisma();
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  if (!client) return null;
  const month = monthRange(monthKey);
  const prev = previousMonth(month);
  const [current, previous, topPages, topSources, conversionsByType] = await Promise.all([
    numbersFor(clientId, month),
    numbersFor(clientId, prev),
    topFor(clientId, month, "path", "pageview"),
    topFor(clientId, month, "referrerHost", "pageview"),
    topFor(clientId, month, "name", "conversion"),
  ]);
  return { clientName: client.name, month, current, previous, topPages, topSources, conversionsByType, highlights: buildHighlights(current, previous) };
}

export { change as percentChange };
