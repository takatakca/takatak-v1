import "server-only";
import type { DomainStatus, Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { ensurePersonalClientWorkspace } from "@/lib/auth/profile-sync";
import { extractHostingPlan, upsertHostingFromUpmindRecord } from "./upmind-hosting-sync";
import {
  domainStatusForHook,
  extractAutoRenew,
  extractDomainName,
  extractExpiry,
  extractUpmindClientId,
  webhookAppliesToDomain,
  type UpmindWebhookEnvelope,
} from "./webhook-payload";

export type UpmindWebhookApplyResult = {
  duplicate: boolean;
  applied: boolean;
  domainName: string | null;
  reason: string;
};

function eventTypeKey(envelope: UpmindWebhookEnvelope): string {
  if (envelope.webhookEventId) {
    return `upmind_webhook:${envelope.webhookEventId}`;
  }
  return `upmind_webhook:${envelope.hookCode}:${envelope.objectId ?? "none"}`;
}

async function findTakataClientId(
  prisma: NonNullable<ReturnType<typeof getPrisma>>,
  upmindClientId: string,
): Promise<string | null> {
  const profile = await prisma.profile.findUnique({
    where: { upmindClientId },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });
  if (!profile) {
    return null;
  }

  await ensurePersonalClientWorkspace(
    profile.id,
    profile.email,
    profile.displayName || profile.email,
  );

  const membership = await prisma.clientMembership.findFirst({
    where: { profileId: profile.id, status: "active" },
    orderBy: { createdAt: "asc" },
    select: { clientId: true },
  });
  if (membership) {
    return membership.clientId;
  }

  const personal = await prisma.client.findUnique({
    where: { id: profile.id },
    select: { id: true },
  });
  return personal?.id ?? profile.id;
}

export async function applyUpmindWebhookEvent(
  envelope: UpmindWebhookEnvelope,
): Promise<UpmindWebhookApplyResult> {
  const prisma = getPrisma();
  if (!prisma) {
    return {
      duplicate: false,
      applied: false,
      domainName: null,
      reason: "database_unavailable",
    };
  }

  const typeKey = eventTypeKey(envelope);
  const already = await prisma.integrationEvent.findFirst({
    where: { provider: "upmind", eventType: typeKey },
    select: { id: true },
  });
  if (already) {
    return {
      duplicate: true,
      applied: false,
      domainName: null,
      reason: "duplicate_event",
    };
  }

  const summary = {
    webhook_event_id: envelope.webhookEventId,
    hook_category: envelope.hookCategory,
    hook_code: envelope.hookCode,
    object_type: envelope.objectType,
    object_id: envelope.objectId,
  };

  if (!webhookAppliesToDomain(envelope)) {
    await prisma.integrationEvent.create({
      data: {
        provider: "upmind",
        eventType: typeKey,
        status: "processed",
        payload: { ...summary, applied: false, note: "not_a_domain_lifecycle_event" },
        processedAt: new Date(),
      },
    });
    return {
      duplicate: false,
      applied: false,
      domainName: null,
      reason: "ignored_hook",
    };
  }

  const domainName = extractDomainName(envelope);
  const upmindClientId = extractUpmindClientId(envelope);
  const hostingPlan = extractHostingPlan(envelope.object);

  if (!domainName && !hostingPlan) {
    await prisma.integrationEvent.create({
      data: {
        provider: "upmind",
        eventType: typeKey,
        status: "processed",
        payload: { ...summary, applied: false, note: "no_domain_or_hosting_in_payload" },
        processedAt: new Date(),
      },
    });
    return {
      duplicate: false,
      applied: false,
      domainName: null,
      reason: "no_domain",
    };
  }

  if (!upmindClientId) {
    await prisma.integrationEvent.create({
      data: {
        provider: "upmind",
        eventType: typeKey,
        status: "processed",
        payload: {
          ...summary,
          applied: false,
          domainName,
          note: "no_upmind_client_id",
        },
        processedAt: new Date(),
      },
    });
    return {
      duplicate: false,
      applied: false,
      domainName,
      reason: "no_upmind_client",
    };
  }

  const clientId = await findTakataClientId(prisma, upmindClientId);
  if (!clientId) {
    await prisma.integrationEvent.create({
      data: {
        provider: "upmind",
        eventType: typeKey,
        status: "processed",
        payload: {
          ...summary,
          applied: false,
          domainName,
          upmindClientId,
          note: "no_takatak_workspace",
        },
        processedAt: new Date(),
      },
    });
    return {
      duplicate: false,
      applied: false,
      domainName,
      reason: "no_takatak_workspace",
    };
  }

  let hostingApplied = false;
  if (hostingPlan) {
    hostingApplied = await upsertHostingFromUpmindRecord({
      clientId,
      record: envelope.object,
      source: "upmind_webhook",
      hookCode: envelope.hookCode,
      objectId: envelope.objectId,
    });
  }

  if (domainName) {
    const status = domainStatusForHook(envelope.hookCode) as DomainStatus;
    const expiresAt = extractExpiry(envelope.object);
    const autoRenew = extractAutoRenew(envelope.object);
    const metadata: Prisma.InputJsonValue = {
      source: "upmind_webhook",
      upmindObjectId: envelope.objectId,
      upmindHookCode: envelope.hookCode,
      upmindClientId,
      lastWebhookEventId: envelope.webhookEventId,
    };

    const existing = await prisma.domainAsset.findFirst({
      where: {
        clientId,
        domainName: { equals: domainName, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.domainAsset.update({
        where: { id: existing.id },
        data: {
          status,
          registrar: "upmind",
          ...(expiresAt ? { expiresAt } : {}),
          ...(autoRenew == null ? {} : { autoRenew }),
          metadata,
        },
      });
    } else {
      await prisma.domainAsset.create({
        data: {
          clientId,
          domainName,
          registrar: "upmind",
          status,
          ...(expiresAt ? { expiresAt } : {}),
          autoRenew: autoRenew ?? false,
          metadata,
        },
      });
    }

    await prisma.integrationEvent.create({
      data: {
        provider: "upmind",
        eventType: typeKey,
        status: "processed",
        payload: {
          ...summary,
          applied: true,
          domainName,
          hostingApplied,
          upmindClientId,
          takatakClientId: clientId,
        },
        processedAt: new Date(),
      },
    });

    return {
      duplicate: false,
      applied: true,
      domainName,
      reason: existing ? "updated" : "created",
    };
  }

  await prisma.integrationEvent.create({
    data: {
      provider: "upmind",
      eventType: typeKey,
      status: "processed",
      payload: {
        ...summary,
        applied: hostingApplied,
        hostingApplied,
        upmindClientId,
        takatakClientId: clientId,
      },
      processedAt: new Date(),
    },
  });

  return {
    duplicate: false,
    applied: hostingApplied,
    domainName: null,
    reason: hostingApplied ? "hosting_created" : "no_domain",
  };
}
