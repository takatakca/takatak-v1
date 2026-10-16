// Persists SEO score summaries on the existing audit log. No new table.

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  auditKey,
  parseSeoScore,
  SEO_SCORE_ACTION,
  snapshotMetadata,
  type SeoScoreInput,
  type SeoScoreSnapshot,
} from "@/lib/seo/score-history";

export async function recordSeoScore(
  prisma: PrismaClient,
  input: { clientId: string; profileId: string | null; report: SeoScoreInput },
): Promise<boolean> {
  const metadata = snapshotMetadata(input.report);
  if (!metadata) return false;
  await prisma.auditLog.create({
    data: {
      clientId: input.clientId,
      profileId: input.profileId,
      action: SEO_SCORE_ACTION,
      entityType: "site_audit",
      entityId: auditKey(metadata.url),
      metadata: metadata as unknown as Prisma.InputJsonObject,
    },
  });
  return true;
}

export async function listSeoScores(prisma: PrismaClient, clientId: string): Promise<SeoScoreSnapshot[]> {
  const rows = await prisma.auditLog.findMany({
    where: { clientId, action: SEO_SCORE_ACTION, entityType: "site_audit" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, metadata: true },
  });
  return rows.flatMap((row) => {
    const parsed = parseSeoScore(row.id, row.metadata);
    return parsed ? [parsed] : [];
  });
}

export async function findSeoScore(
  prisma: PrismaClient,
  clientId: string,
  id: string,
): Promise<SeoScoreSnapshot | null> {
  const row = await prisma.auditLog.findFirst({
    where: { id, clientId, action: SEO_SCORE_ACTION, entityType: "site_audit" },
    select: { id: true, metadata: true },
  });
  if (!row) return null;
  return parseSeoScore(row.id, row.metadata);
}
