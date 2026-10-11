// Full record for one lead, scoped exactly like the other lead pages.

import { getPrisma } from "@/lib/db/prisma";
import { resolveDataScope } from "@/lib/security/data-scope";

import { isLeadId } from "./lead-id";

export interface LeadDetail {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  status: string;
  priority: string;
  followUpOn: string | null;
  valueCents: number | null;
  currency: string | null;
  sourceName: string | null;
  createdAt: Date;
  website: { kind: string | null; sourcePage: string | null; language: string | null } | null;
  attachments: { id: string; originalName: string; mimeType: string; sizeBytes: number; status: string; createdAt: Date }[];
  activities: { id: string; type: string; status: string; title: string; note: string | null; dueAt: Date | null; createdAt: Date }[];
}

function websiteMeta(metadata: unknown): LeadDetail["website"] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  if (m.origin !== "takatak_website") return null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return { kind: str(m.kind), sourcePage: str(m.sourcePage), language: str(m.language) };
}

/** Prisma "table does not exist": the lead_attachments migration is not applied yet. */
function isMissingTable(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2021");
}

/**
 * Attachments are optional: until migration 20261008090000 runs on a database,
 * the lead page still works and simply shows no files.
 */
async function loadAttachments(
  prisma: NonNullable<ReturnType<typeof getPrisma>>,
  leadId: string,
): Promise<LeadDetail["attachments"]> {
  try {
    return await prisma.leadAttachment.findMany({
      where: { leadId, status: { not: "deleted" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, originalName: true, mimeType: true, sizeBytes: true, status: true, createdAt: true },
    });
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

export async function getLeadDetail(id: string): Promise<LeadDetail | "unavailable" | null> {
  if (!isLeadId(id)) return null;
  const scope = await resolveDataScope();
  if (scope.kind !== "db") return "unavailable";
  const prisma = getPrisma();
  if (!prisma) return "unavailable";

  const lead = await prisma.lead.findFirst({
    where: { id, ...(scope.clientIds ? { clientId: { in: scope.clientIds } } : {}) },
    include: {
      leadSource: { select: { name: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, type: true, status: true, title: true, note: true, dueAt: true, createdAt: true },
      },
    },
  });
  if (!lead) return null;

  const attachments = await loadAttachments(prisma, lead.id);

  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    message: lead.message,
    status: lead.status,
    priority: lead.priority,
    followUpOn: lead.followUpAt ? lead.followUpAt.toISOString().slice(0, 10) : null,
    valueCents: lead.valueCents,
    currency: lead.currency,
    sourceName: lead.leadSource?.name ?? null,
    createdAt: lead.createdAt,
    website: websiteMeta(lead.metadata),
    attachments,
    activities: lead.activities,
  };
}
