import type { PrismaClient } from "@prisma/client";

import type { PromoAction, PromoEvent, PromoStore } from "./service";

const ACTIONS: PromoAction[] = ["promo.claim", "promo.redeem"];

function asAction(value: string): PromoAction | null {
  return value === "promo.claim" || value === "promo.redeem" ? value : null;
}

function orderRefOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || !("orderRef" in metadata)) {
    return null;
  }
  const orderRef = (metadata as { orderRef?: unknown }).orderRef;
  return typeof orderRef === "string" && orderRef.length > 0 ? orderRef : null;
}

export function promoAuditStore(prisma: PrismaClient): PromoStore {
  return {
    async list(profileId, code) {
      const rows = await prisma.auditLog.findMany({
        where: {
          profileId,
          entityType: "promotion",
          entityId: code,
          action: { in: ACTIONS },
        },
        select: { id: true, action: true, createdAt: true, metadata: true },
        orderBy: { createdAt: "asc" },
        take: 20,
      });
      const events: PromoEvent[] = [];
      for (const row of rows) {
        const action = asAction(row.action);
        if (!action) continue;
        events.push({
          id: row.id,
          action,
          createdAt: row.createdAt.toISOString(),
          orderRef: orderRefOf(row.metadata),
        });
      }
      return events;
    },
    async append(input) {
      const created = await prisma.auditLog.create({
        data: {
          profileId: input.profileId,
          action: input.action,
          entityType: "promotion",
          entityId: input.code,
          metadata: { orderRef: input.orderRef },
        },
        select: { id: true, createdAt: true },
      });
      return {
        id: created.id,
        action: input.action,
        createdAt: created.createdAt.toISOString(),
        orderRef: input.orderRef,
      };
    },
  };
}
