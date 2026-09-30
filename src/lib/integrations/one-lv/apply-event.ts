import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { OneLvEnvelope } from "./types";

function hash(raw: string) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function date(value: unknown): Date | null {
  const v = str(value);
  return v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null;
}
function email(value: unknown) {
  return str(value)?.toLowerCase() ?? null;
}
function phone(value: unknown) {
  const raw = str(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}
function fullName(value: unknown) {
  const parts = (str(value) ?? "").split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? null, lastName: parts.length > 1 ? parts.slice(1).join(" ") : null };
}

async function sourceIdentity(tx: Prisma.TransactionClient, externalUserId: string) {
  return tx.sourceProfile.findUnique({
    where: { sourceApplication_externalUserId: { sourceApplication: "1lv", externalUserId } },
  });
}

async function applyCustomer(tx: Prisma.TransactionClient, event: OneLvEnvelope) {
  const p = event.payload;
  const existing = await sourceIdentity(tx, event.aggregate_id);
  const normalizedEmail = email(p.email);
  const normalizedPhone = phone(p.phone);
  const names = fullName(p.full_name);

  if (existing) {
    const identity = await tx.masterIdentity.update({
      where: { id: existing.identityId },
      data: {
        firstName: names.firstName ?? undefined,
        lastName: names.lastName ?? undefined,
        locale: str(p.preferred_language) ?? undefined,
        accountStatus: "active",
      },
    });
    await tx.sourceProfile.update({
      where: { id: existing.id },
      data: {
        collectedFields: p as Prisma.InputJsonValue,
        lastSynchronizedAt: new Date(),
      },
    });
    return { remoteId: identity.id, identityId: identity.id, sourceProfileId: existing.id };
  }

  // 1LV currently does not send verified-field provenance. Do not silently merge
  // a new source profile into an existing global person from unverified email/phone.
  const emailOwner = normalizedEmail
    ? await tx.masterIdentity.findUnique({ where: { primaryEmail: normalizedEmail } })
    : null;
  const phoneOwner = normalizedPhone
    ? await tx.masterIdentity.findUnique({ where: { primaryPhone: normalizedPhone } })
    : null;

  const identity = await tx.masterIdentity.create({
    data: {
      firstName: names.firstName,
      lastName: names.lastName,
      primaryEmail: emailOwner ? null : normalizedEmail,
      primaryEmailVerified: false,
      primaryPhone: phoneOwner ? null : normalizedPhone,
      primaryPhoneVerified: false,
      locale: str(p.preferred_language),
      accountStatus: "active",
      registeredAt: date(p.account_created_at),
    },
  });
  const source = await tx.sourceProfile.create({
    data: {
      identityId: identity.id,
      sourceApplication: "1lv",
      externalUserId: event.aggregate_id,
      collectedFields: p as Prisma.InputJsonValue,
      verifiedFields: [],
      consentRecords: Prisma.JsonNull,
      accountStatus: "active",
      lastSynchronizedAt: new Date(),
    },
  });
  return { remoteId: identity.id, identityId: identity.id, sourceProfileId: source.id };
}

async function applyMerchant(tx: Prisma.TransactionClient, event: OneLvEnvelope) {
  const p = event.payload;
  const existing = await tx.sourceMerchant.findUnique({
    where: {
      sourceApplication_externalMerchantId: {
        sourceApplication: "1lv",
        externalMerchantId: event.aggregate_id,
      },
    },
  });
  const address = p.address && typeof p.address === "object" && !Array.isArray(p.address)
    ? p.address as Record<string, unknown>
    : {};
  if (existing) {
    const company = await tx.masterCompany.update({
      where: { id: existing.companyId },
      data: {
        legalName: str(p.legal_business_name) ?? undefined,
        displayName: str(p.store_name) ?? undefined,
        primaryEmail: email(p.contact_email) ?? undefined,
        primaryPhone: phone(p.contact_phone) ?? undefined,
        country: str(address.country) ?? undefined,
        province: str(address.province) ?? undefined,
        status: str(p.marketplace_status) ?? undefined,
      },
    });
    await tx.sourceMerchant.update({
      where: { id: existing.id },
      data: {
        publicSlug: str(p.store_slug),
        collectedFields: p as Prisma.InputJsonValue,
        status: str(p.marketplace_status),
        lastSynchronizedAt: new Date(),
      },
    });
    return { remoteId: company.id, companyId: company.id, sourceMerchantId: existing.id };
  }

  // Company resolution across verticals is intentionally conservative until
  // verified business identifiers are supplied by the source.
  const company = await tx.masterCompany.create({
    data: {
      legalName: str(p.legal_business_name),
      displayName: str(p.store_name) ?? "1LV merchant",
      primaryEmail: email(p.contact_email),
      primaryPhone: phone(p.contact_phone),
      country: str(address.country),
      province: str(address.province),
      status: str(p.marketplace_status),
    },
  });
  const source = await tx.sourceMerchant.create({
    data: {
      companyId: company.id,
      sourceApplication: "1lv",
      externalMerchantId: event.aggregate_id,
      vertical: "marketplace",
      publicSlug: str(p.store_slug),
      collectedFields: p as Prisma.InputJsonValue,
      status: str(p.marketplace_status),
      lastSynchronizedAt: new Date(),
    },
  });
  return { remoteId: company.id, companyId: company.id, sourceMerchantId: source.id };
}

async function applyRelationship(tx: Prisma.TransactionClient, event: OneLvEnvelope) {
  const p = event.payload;
  const vendorRef = str(p.vendor_local_reference);
  const customerRef = str(p.customer_local_reference);
  if (!vendorRef || !customerRef) throw new Error("relationship_reference_missing");

  const merchant = await tx.sourceMerchant.findUnique({
    where: {
      sourceApplication_externalMerchantId: {
        sourceApplication: "1lv",
        externalMerchantId: vendorRef,
      },
    },
  });
  if (!merchant) throw new Error("source_merchant_not_found");

  const source = await sourceIdentity(tx, customerRef);
  const row = await tx.marketplaceRelationship.upsert({
    where: {
      sourceApplication_sourceCustomerRef_sourceMerchantId_relationshipType: {
        sourceApplication: "1lv",
        sourceCustomerRef: customerRef,
        sourceMerchantId: merchant.id,
        relationshipType: "customer_of",
      },
    },
    create: {
      identityId: source?.identityId ?? null,
      companyId: merchant.companyId,
      sourceMerchantId: merchant.id,
      sourceApplication: "1lv",
      sourceCustomerRef: customerRef,
      relationshipType: "customer_of",
      firstSeenAt: date(p.first_seen_at),
      lastSeenAt: date(p.last_seen_at),
      orderCount: num(p.order_count),
      lifetimeValue: num(p.lifetime_value),
      currency: str(p.currency) ?? "CAD",
    },
    update: {
      identityId: source?.identityId ?? undefined,
      firstSeenAt: date(p.first_seen_at) ?? undefined,
      lastSeenAt: date(p.last_seen_at) ?? undefined,
      orderCount: num(p.order_count),
      lifetimeValue: num(p.lifetime_value),
      currency: str(p.currency) ?? "CAD",
    },
  });
  return { remoteId: row.id, identityId: source?.identityId ?? null, companyId: merchant.companyId };
}

async function applyOrder(tx: Prisma.TransactionClient, event: OneLvEnvelope) {
  const p = event.payload;
  const customerRef = str(p.customer_local_id);
  const source = customerRef ? await sourceIdentity(tx, customerRef) : null;
  const row = await tx.sourceMarketplaceOrder.upsert({
    where: {
      sourceApplication_externalOrderId: {
        sourceApplication: "1lv",
        externalOrderId: str(p.local_order_id) ?? event.aggregate_id,
      },
    },
    create: {
      sourceApplication: "1lv",
      externalOrderId: str(p.local_order_id) ?? event.aggregate_id,
      externalOrderNumber: str(p.order_number),
      identityId: source?.identityId ?? null,
      customerReference: customerRef ?? str(p.guest_reference),
      total: num(p.total) ?? 0,
      currency: str(p.currency) ?? "CAD",
      paymentStatus: str(p.payment_status),
      fulfillmentStatus: str(p.fulfillment_status),
      occurredAt: date(p.created_at) ?? new Date(),
      collectedFields: p as Prisma.InputJsonValue,
    },
    update: {
      identityId: source?.identityId ?? undefined,
      paymentStatus: str(p.payment_status),
      fulfillmentStatus: str(p.fulfillment_status),
      total: num(p.total) ?? 0,
      collectedFields: p as Prisma.InputJsonValue,
    },
  });
  return { remoteId: row.id, identityId: source?.identityId ?? null };
}

export async function applyOneLvEvent(event: OneLvEnvelope, rawBody: string) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  const payloadHash = hash(rawBody);

  return prisma.$transaction(async (tx) => {
    const previous = await tx.sourceSynchronizationEvent.findUnique({
      where: { eventId: event.event_id },
    });
    if (previous) {
      if (previous.payloadHash !== payloadHash) throw new Error("event_id_payload_conflict");
      return (previous.responsePayload as Record<string, unknown> | null) ?? {
        id: previous.identityId,
        duplicate: true,
      };
    }

    let applied: { remoteId: string; identityId?: string | null; sourceProfileId?: string; companyId?: string };
    if (event.aggregate_type === "customer") applied = await applyCustomer(tx, event);
    else if (event.aggregate_type === "merchant") applied = await applyMerchant(tx, event);
    else if (event.aggregate_type === "relationship") applied = await applyRelationship(tx, event);
    else applied = await applyOrder(tx, event);

    const response = {
      id: applied.remoteId,
      remote_id: applied.remoteId,
      duplicate: false,
      event_type: event.event_type,
      source_application: "1lv",
    };

    await tx.sourceSynchronizationEvent.create({
      data: {
        eventId: event.event_id,
        eventType: event.event_type,
        sourceApplication: "1lv",
        sourceProfileId: applied.sourceProfileId ?? null,
        identityId: applied.identityId ?? null,
        payloadHash,
        responsePayload: response as Prisma.InputJsonValue,
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });
    return response;
  }, { maxWait: 5_000, timeout: 15_000 });
}
