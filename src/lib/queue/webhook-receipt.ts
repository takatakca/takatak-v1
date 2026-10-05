import type { JobPayload } from "@/lib/queue/payloads";

const STALE_MS = 45_000;
const RECLAIM_LIMIT = 20;

export type ReceiptWrite = "queued" | "applied" | "unavailable";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Persist the event id before Redis is asked to carry it.
 * A missing database keeps the HTTP handler on the inline apply path.
 */
export async function persistQueuedWebhookReceipt(
  payload: JobPayload,
): Promise<ReceiptWrite> {
  const { getPrisma } = await import("@/lib/db/prisma");
  const prisma = getPrisma();
  if (!prisma) {
    return "unavailable";
  }

  try {
    await prisma.providerWebhookReceipt.create({
      data: {
        provider: payload.provider,
        eventId: payload.eventId,
        status: "queued",
      },
    });
    return "queued";
  } catch (error) {
    if (!isUniqueViolation(error)) {
      return "unavailable";
    }
    const existing = await prisma.providerWebhookReceipt.findUnique({
      where: {
        provider_eventId: {
          provider: payload.provider,
          eventId: payload.eventId,
        },
      },
      select: { status: true },
    });
    return existing?.status === "applied" ? "applied" : "queued";
  }
}

export async function markWebhookReceiptApplied(input: {
  provider: string;
  eventId: string;
}): Promise<void> {
  const { getPrisma } = await import("@/lib/db/prisma");
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }
  try {
    await prisma.providerWebhookReceipt.updateMany({
      where: {
        provider: input.provider,
        eventId: input.eventId,
        status: "queued",
      },
      data: { status: "applied" },
    });
  } catch {
    return;
  }
}

export async function listStaleQueuedWebhookReceipts(): Promise<
  Array<{ provider: string; eventId: string }>
> {
  const { getPrisma } = await import("@/lib/db/prisma");
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }
  const cutoff = new Date(Date.now() - STALE_MS);
  const rows = await prisma.providerWebhookReceipt.findMany({
    where: {
      status: "queued",
      updatedAt: { lt: cutoff },
      provider: { in: ["stripe", "stripe_hockey"] },
    },
    select: { provider: true, eventId: true },
    orderBy: { updatedAt: "asc" },
    take: RECLAIM_LIMIT,
  });
  return rows;
}
