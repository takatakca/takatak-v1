import "server-only";
import type { DomainStatus, Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { listUpmindClientOrders } from "@/lib/integrations/upmind/upmind-customers";
import {
  collectDomainNames,
  extractAutoRenew,
  extractExpiry,
} from "@/lib/integrations/upmind/webhook-payload";
import { getUpmindSessionCustomer } from "@/lib/web-hosting/upmind-session-customer";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function statusFromRecord(
  record: Record<string, unknown>,
): DomainStatus {
  const text = [
    record.status,
    record.state,
    record.provision_status,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (text.includes("cancel") || text.includes("refund")) {
    return "cancelled";
  }
  if (text.includes("expir")) {
    return "expiring_soon";
  }
  if (text.includes("active") || text.includes("complete") || text.includes("paid")) {
    return "tracked";
  }
  return "pending_connection";
}

export async function syncUpmindDomainsForSession(): Promise<void> {
  const customer = await getUpmindSessionCustomer();
  if (!customer.clientId) {
    return;
  }

  const prisma = getPrisma();
  if (!prisma) {
    return;
  }

  const profile = await prisma.profile.findFirst({
    where: { upmindClientId: customer.clientId },
    select: {
      id: true,
      memberships: {
        where: { status: "active" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { clientId: true },
      },
    },
  });

  const takatakClientId =
    profile?.memberships[0]?.clientId ?? profile?.id ?? null;
  if (!takatakClientId) {
    return;
  }

  let orders: unknown[] = [];
  try {
    orders = await listUpmindClientOrders(customer.clientId);
  } catch {
    return;
  }

  for (const order of orders) {
    if (!isRecord(order)) {
      continue;
    }

    const names = collectDomainNames(order);
    const expiresAt = extractExpiry(order);
    const autoRenew = extractAutoRenew(order);
    const status = statusFromRecord(order);
    const metadata: Prisma.InputJsonValue = {
      source: "upmind_orders",
      upmindClientId: customer.clientId,
      upmindOrderId: typeof order.id === "string" ? order.id : null,
    };

    for (const domainName of names) {
      const existing = await prisma.domainAsset.findFirst({
        where: {
          clientId: takatakClientId,
          domainName: { equals: domainName, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.domainAsset.update({
          where: { id: existing.id },
          data: {
            registrar: "upmind",
            status,
            ...(expiresAt ? { expiresAt } : {}),
            ...(autoRenew == null ? {} : { autoRenew }),
            metadata,
          },
        });
        continue;
      }

      await prisma.domainAsset.create({
        data: {
          clientId: takatakClientId,
          domainName,
          registrar: "upmind",
          status,
          ...(expiresAt ? { expiresAt } : {}),
          autoRenew: autoRenew ?? false,
          metadata,
        },
      });
    }
  }
}
