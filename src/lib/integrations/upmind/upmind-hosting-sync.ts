import "server-only";
import type { HostingStatus, Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { listUpmindClientOrders } from "@/lib/integrations/upmind/upmind-customers";
import { extractExpiry } from "@/lib/integrations/upmind/webhook-payload";
import { getUpmindSessionCustomer } from "@/lib/web-hosting/upmind-session-customer";
import { UPMIND_HOSTING_PLANS } from "@/lib/website/upmind-config";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function walkIdsAndNames(
  value: unknown,
  depth: number,
  ids: Set<string>,
  names: string[],
): void {
  if (depth > 6 || value == null) {
    return;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        text,
      )
    ) {
      ids.add(text.toLowerCase());
    } else if (text.length > 2 && text.length < 120) {
      names.push(text);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkIdsAndNames(item, depth + 1, ids, names);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const nested of Object.values(value)) {
    walkIdsAndNames(nested, depth + 1, ids, names);
  }
}

export function extractHostingPlan(
  value: unknown,
): { productId: string | null; planName: string } | null {
  const ids = new Set<string>();
  const names: string[] = [];
  walkIdsAndNames(value, 0, ids, names);

  for (const plan of UPMIND_HOSTING_PLANS) {
    if (ids.has(plan.id.toLowerCase())) {
      return { productId: plan.id, planName: plan.name };
    }
  }

  for (const name of names) {
    const lower = name.toLowerCase();
    if (
      !lower.includes("host") &&
      !lower.includes("wordpress") &&
      !lower.includes("cpanel")
    ) {
      continue;
    }
    const named = UPMIND_HOSTING_PLANS.find((plan) =>
      lower.includes(plan.name.split(" ")[0].toLowerCase()),
    );
    return {
      productId: named?.id ?? null,
      planName: named?.name ?? name,
    };
  }

  return null;
}

function statusFromRecord(
  record: Record<string, unknown>,
  hookCode?: string,
): HostingStatus {
  const text = [
    record.status,
    record.state,
    record.provision_status,
    hookCode,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (text.includes("cancel") || text.includes("refund")) {
    return "cancelled";
  }
  if (text.includes("fail") || text.includes("error")) {
    return "failed";
  }
  if (
    text.includes("active") ||
    text.includes("complete") ||
    text.includes("paid") ||
    text.includes("provision_result_success")
  ) {
    return "active_internal";
  }
  return "pending_setup";
}

export async function upsertHostingFromUpmindRecord(options: {
  clientId: string;
  record: Record<string, unknown>;
  source: string;
  hookCode?: string;
  objectId?: string | null;
}): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) {
    return false;
  }

  const plan = extractHostingPlan(options.record);
  if (!plan) {
    return false;
  }

  const renewalDate = extractExpiry(options.record);
  const orderId =
    asString(options.record.id) ??
    asString(options.objectId) ??
    plan.productId;
  const metadata: Prisma.InputJsonValue = {
    source: options.source,
    upmindProductId: plan.productId,
    upmindOrderId: orderId,
    upmindHookCode: options.hookCode ?? null,
  };

  const existingRows = await prisma.hostingService.findMany({
    where: { clientId: options.clientId },
    select: { id: true, metadata: true },
  });

  const existing = existingRows.find((row) => {
    const metadata = isRecord(row.metadata) ? row.metadata : {};
    return (
      (orderId && metadata.upmindOrderId === orderId) ||
      (plan.productId && metadata.upmindProductId === plan.productId)
    );
  });

  const status = statusFromRecord(options.record, options.hookCode);

  if (existing) {
    await prisma.hostingService.update({
      where: { id: existing.id },
      data: {
        planName: plan.planName,
        status,
        ...(renewalDate ? { renewalDate } : {}),
        metadata,
      },
    });
    return true;
  }

  await prisma.hostingService.create({
    data: {
      clientId: options.clientId,
      planName: plan.planName,
      status,
      ...(renewalDate ? { renewalDate } : {}),
      metadata,
    },
  });
  return true;
}

export async function syncUpmindHostingForSession(): Promise<void> {
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
    await upsertHostingFromUpmindRecord({
      clientId: takatakClientId,
      record: order,
      source: "upmind_orders",
      objectId: asString(order.id),
    });
  }
}
