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
  valueCents: number | null;
  currency: string | null;
  sourceName: string | null;
  createdAt: Date;
  website: { kind: string | null; sourcePage: string | null; language: string | null } | null;
  attachments: { id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: Date }[];
}

function websiteMeta(metadata: unknown): LeadDetail["website"] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  if (m.origin !== "takatak_website") return null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return { kind: str(m.kind), sourcePage: str(m.sourcePage), language: str(m.language) };
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
      attachments: {
        where: { status: { not: "deleted" } },
        orderBy: { createdAt: "asc" },
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
    },
  });
  if (!lead) return null;

  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    message: lead.message,
    status: lead.status,
    priority: lead.priority,
    valueCents: lead.valueCents,
    currency: lead.currency,
    sourceName: lead.leadSource?.name ?? null,
    createdAt: lead.createdAt,
    website: websiteMeta(lead.metadata),
    attachments: lead.attachments,
  };
}
