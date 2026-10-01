import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import {
  ONELV_SOURCE_APPLICATION,
  type OneLvEvent,
} from "./types";

type Transaction = Prisma.TransactionClient;

export type OneLvApplyResult = {
  duplicate: boolean;
  id: string;
  remote_id: string;
  result: string;
  identity_id?: string | null;
  source_profile_id?: string | null;
};

export class OneLvSyncConflictError extends Error {
  constructor(
    message: string,
    public readonly conflictingFields: string[] = [],
  ) {
    super(message);
    this.name = "OneLvSyncConflictError";
  }
}

export class InvalidOneLvPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOneLvPayloadError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function email(value: unknown): string | null {
  const normalized = text(value, 320)?.toLowerCase() ?? null;
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : null;
}

function phone(value: unknown): string | null {
  const normalized = text(value, 50);
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return normalized.startsWith("+") ? `+${digits}` : `+${digits}`;
}

function date(value: unknown): Date | null {
  const normalized = text(value, 64);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minorUnits(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const minor = Math.round(value * 100);
  return Number.isSafeInteger(minor) && minor <= 2_147_483_647
    ? minor
    : null;
}

function hash(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

function splitName(fullName: string | null) {
  const parts = (fullName ?? "").split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

async function applyCustomer(
  tx: Transaction,
  event: OneLvEvent,
  synchronizedAt: Date,
) {
  const payload = event.payload;
  const isGuest = payload["is_guest"] === true;
  const normalizedEmail = email(payload["email"]);
  const normalizedPhone = phone(payload["phone"]);
  const fullName = text(payload["full_name"], 250);
  const locale = text(payload["preferred_language"], 20);
  const registeredAt = date(payload["account_created_at"]);
  const rawVerified = Array.isArray(payload["verified_fields"])
    ? payload["verified_fields"]
    : [];
  const verifiedFields = rawVerified.filter(
    (field): field is string =>
      typeof field === "string" && (field === "email" || field === "phone"),
  );
  const emailVerified =
    !isGuest && Boolean(normalizedEmail) && verifiedFields.includes("email");
  const phoneVerified =
    !isGuest && Boolean(normalizedPhone) && verifiedFields.includes("phone");

  const existingSource = await tx.sourceProfile.findUnique({
    where: {
      sourceApplication_externalUserId: {
        sourceApplication: ONELV_SOURCE_APPLICATION,
        externalUserId: event.aggregate_id,
      },
    },
    include: { identity: true },
  });

  let identity = existingSource?.identity ?? null;

  if (!identity) {
    const candidates = await tx.masterIdentity.findMany({
      where: {
        OR: [
          ...(emailVerified && normalizedEmail
            ? [{ primaryEmail: normalizedEmail }]
            : []),
          ...(phoneVerified && normalizedPhone
            ? [{ primaryPhone: normalizedPhone }]
            : []),
        ],
      },
    });

    if (new Set(candidates.map((candidate) => candidate.id)).size > 1) {
      throw new OneLvSyncConflictError(
        "Verified identity fields resolve to different TAKATAK identities.",
        ["email", "phone"],
      );
    }

    const names = splitName(fullName);
    identity =
      candidates[0] ??
      (await tx.masterIdentity.create({
        data: {
          firstName: names.firstName,
          lastName: names.lastName,
          primaryEmail: emailVerified ? normalizedEmail : null,
          primaryEmailVerified: emailVerified,
          primaryPhone: phoneVerified ? normalizedPhone : null,
          primaryPhoneVerified: phoneVerified,
          locale,
          registeredAt,
        },
      }));
  }

  if (emailVerified && normalizedEmail) {
    const owner = await tx.masterIdentity.findUnique({
      where: { primaryEmail: normalizedEmail },
    });
    if (owner && owner.id !== identity.id) {
      throw new OneLvSyncConflictError(
        "Verified email belongs to another TAKATAK identity.",
        ["email"],
      );
    }
  }

  if (phoneVerified && normalizedPhone) {
    const owner = await tx.masterIdentity.findUnique({
      where: { primaryPhone: normalizedPhone },
    });
    if (owner && owner.id !== identity.id) {
      throw new OneLvSyncConflictError(
        "Verified phone belongs to another TAKATAK identity.",
        ["phone"],
      );
    }
  }

  const names = splitName(fullName);
  identity = await tx.masterIdentity.update({
    where: { id: identity.id },
    data: {
      ...(!identity.firstName && names.firstName
        ? { firstName: names.firstName }
        : {}),
      ...(!identity.lastName && names.lastName
        ? { lastName: names.lastName }
        : {}),
      ...(emailVerified
        ? { primaryEmail: normalizedEmail, primaryEmailVerified: true }
        : {}),
      ...(phoneVerified
        ? { primaryPhone: normalizedPhone, primaryPhoneVerified: true }
        : {}),
      ...(!identity.locale && locale ? { locale } : {}),
      ...(!identity.registeredAt && registeredAt ? { registeredAt } : {}),
    },
  });

  const collectedFields = {
    email: normalizedEmail,
    phone: normalizedPhone,
    fullName,
    locale,
    country: text(payload["country"], 10),
    province: text(payload["province"], 50),
    registeredAt: registeredAt?.toISOString() ?? null,
    isGuest,
  };

  const sourceProfile = existingSource
    ? await tx.sourceProfile.update({
        where: { id: existingSource.id },
        data: {
          identityId: identity.id,
          collectedFields: collectedFields as Prisma.InputJsonValue,
          verifiedFields,
          accountStatus: text(payload["account_status"], 50) ?? "active",
          lastSynchronizedAt: synchronizedAt,
        },
      })
    : await tx.sourceProfile.create({
        data: {
          identityId: identity.id,
          sourceApplication: ONELV_SOURCE_APPLICATION,
          externalUserId: event.aggregate_id,
          collectedFields: collectedFields as Prisma.InputJsonValue,
          verifiedFields,
          consentRecords: [] as Prisma.InputJsonValue,
          accountStatus: text(payload["account_status"], 50) ?? "active",
          lastSynchronizedAt: synchronizedAt,
        },
      });

  return {
    remoteId: identity.id,
    identityId: identity.id,
    sourceProfileId: sourceProfile.id,
    result: existingSource ? "CUSTOMER_UPDATED" : "CUSTOMER_RESOLVED",
  };
}

async function applyMerchant(
  tx: Transaction,
  event: OneLvEvent,
  synchronizedAt: Date,
) {
  const payload = event.payload;
  const storeName = text(payload["store_name"], 250);
  if (!storeName) {
    throw new InvalidOneLvPayloadError("1LV merchant store_name is required.");
  }

  const address = isObject(payload["address"]) ? payload["address"] : null;
  const merchant = await tx.sourceMerchantProfile.upsert({
    where: {
      sourceApplication_externalMerchantId: {
        sourceApplication: ONELV_SOURCE_APPLICATION,
        externalMerchantId: event.aggregate_id,
      },
    },
    create: {
      sourceApplication: ONELV_SOURCE_APPLICATION,
      externalMerchantId: event.aggregate_id,
      ownerExternalUserId: text(payload["local_owner_user_id"], 200),
      storeName,
      storeSlug: text(payload["store_slug"], 250),
      legalBusinessName: text(payload["legal_business_name"], 250),
      contactEmail: email(payload["contact_email"]),
      contactPhone: phone(payload["contact_phone"]),
      address: address as Prisma.InputJsonValue | null,
      marketplaceStatus: text(payload["marketplace_status"], 50),
      subscriptionStatus: text(payload["subscription_status"], 50),
      subscriptionPlan: text(payload["subscription_plan"], 100),
      lastSynchronizedAt: synchronizedAt,
    },
    update: {
      ownerExternalUserId: text(payload["local_owner_user_id"], 200),
      storeName,
      storeSlug: text(payload["store_slug"], 250),
      legalBusinessName: text(payload["legal_business_name"], 250),
      contactEmail: email(payload["contact_email"]),
      contactPhone: phone(payload["contact_phone"]),
      address: address as Prisma.InputJsonValue | null,
      marketplaceStatus: text(payload["marketplace_status"], 50),
      subscriptionStatus: text(payload["subscription_status"], 50),
      subscriptionPlan: text(payload["subscription_plan"], 100),
      lastSynchronizedAt: synchronizedAt,
    },
  });

  return { remoteId: merchant.id, result: "MERCHANT_UPSERTED" };
}

async function applyOrder(
  tx: Transaction,
  event: OneLvEvent,
  synchronizedAt: Date,
) {
  const payload = event.payload;
  const localOrderId = text(payload["local_order_id"], 200);
  const orderNumber = text(payload["order_number"], 200);
  const totalMinor = minorUnits(payload["total"]);
  const currency = text(payload["currency"], 3)?.toUpperCase();
  const paymentStatus = text(payload["payment_status"], 50);
  const fulfillmentStatus = text(payload["fulfillment_status"], 50);
  const occurredAt = date(payload["created_at"]);

  if (
    localOrderId !== event.aggregate_id ||
    !orderNumber ||
    totalMinor == null ||
    !currency ||
    !/^[A-Z]{3}$/.test(currency) ||
    !paymentStatus ||
    !fulfillmentStatus ||
    !occurredAt
  ) {
    throw new InvalidOneLvPayloadError("1LV order payload is invalid.");
  }

  const merchantExternalIds = Array.isArray(payload["merchant_local_ids"])
    ? payload["merchant_local_ids"]
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0 && value.length <= 200,
        )
        .map((value) => value.trim())
    : [];
  const splits = Array.isArray(payload["splits"]) ? payload["splits"] : [];
  const customerId = text(payload["customer_local_id"], 200);
  const guestReference = text(payload["guest_reference"], 250);

  const order = await tx.sourceCommerceOrder.upsert({
    where: {
      sourceApplication_externalOrderId: {
        sourceApplication: ONELV_SOURCE_APPLICATION,
        externalOrderId: event.aggregate_id,
      },
    },
    create: {
      sourceApplication: ONELV_SOURCE_APPLICATION,
      externalOrderId: event.aggregate_id,
      orderNumber,
      customerExternalReference: customerId ?? guestReference,
      customerIsGuest: !customerId,
      merchantExternalIds,
      splits: splits as Prisma.InputJsonValue,
      totalMinor,
      currency,
      paymentStatus,
      fulfillmentStatus,
      occurredAt,
      lastSynchronizedAt: synchronizedAt,
    },
    update: {
      orderNumber,
      customerExternalReference: customerId ?? guestReference,
      customerIsGuest: !customerId,
      merchantExternalIds,
      splits: splits as Prisma.InputJsonValue,
      totalMinor,
      currency,
      paymentStatus,
      fulfillmentStatus,
      occurredAt,
      lastSynchronizedAt: synchronizedAt,
    },
  });

  return { remoteId: order.id, result: "ORDER_UPSERTED" };
}

async function applyRelationship(
  tx: Transaction,
  event: OneLvEvent,
  synchronizedAt: Date,
) {
  const payload = event.payload;
  const relationshipType = text(payload["relationship_type"], 100);
  const customerReference = text(payload["customer_local_reference"], 250);
  const merchantReference = text(payload["vendor_local_reference"], 200);
  const currency = text(payload["currency"], 3)?.toUpperCase();

  if (
    relationshipType !== "customer_of" ||
    !customerReference ||
    !merchantReference ||
    !currency ||
    !/^[A-Z]{3}$/.test(currency)
  ) {
    throw new InvalidOneLvPayloadError("1LV relationship payload is invalid.");
  }

  const rawOrderCount = payload["order_count"];
  const orderCount =
    rawOrderCount == null
      ? null
      : typeof rawOrderCount === "number" &&
          Number.isInteger(rawOrderCount) &&
          rawOrderCount >= 0
        ? rawOrderCount
        : null;
  if (rawOrderCount != null && orderCount == null) {
    throw new InvalidOneLvPayloadError("1LV relationship order_count is invalid.");
  }

  const rawLifetime = payload["lifetime_value"];
  const lifetimeValueMinor =
    rawLifetime == null ? null : minorUnits(rawLifetime);
  if (rawLifetime != null && lifetimeValueMinor == null) {
    throw new InvalidOneLvPayloadError("1LV relationship lifetime_value is invalid.");
  }

  const firstSeenAt =
    payload["first_seen_at"] == null ? null : date(payload["first_seen_at"]);
  const lastSeenAt =
    payload["last_seen_at"] == null ? null : date(payload["last_seen_at"]);

  const relationship = await tx.sourceRelationship.upsert({
    where: {
      sourceApplication_relationshipType_customerExternalReference_merchantExternalReference: {
        sourceApplication: ONELV_SOURCE_APPLICATION,
        relationshipType,
        customerExternalReference: customerReference,
        merchantExternalReference: merchantReference,
      },
    },
    create: {
      sourceApplication: ONELV_SOURCE_APPLICATION,
      relationshipType,
      customerExternalReference: customerReference,
      customerIsGuest: payload["customer_is_guest"] === true,
      merchantExternalReference: merchantReference,
      firstSeenAt,
      lastSeenAt,
      orderCount,
      lifetimeValueMinor,
      currency,
      lastSynchronizedAt: synchronizedAt,
    },
    update: {
      customerIsGuest: payload["customer_is_guest"] === true,
      firstSeenAt,
      lastSeenAt,
      orderCount,
      lifetimeValueMinor,
      currency,
      lastSynchronizedAt: synchronizedAt,
    },
  });

  return { remoteId: relationship.id, result: "RELATIONSHIP_UPSERTED" };
}

async function processEvent(
  tx: Transaction,
  event: OneLvEvent,
  synchronizedAt: Date,
) {
  if (event.aggregate_type === "customer") {
    return applyCustomer(tx, event, synchronizedAt);
  }
  if (event.aggregate_type === "merchant") {
    return applyMerchant(tx, event, synchronizedAt);
  }
  if (event.aggregate_type === "order") {
    return applyOrder(tx, event, synchronizedAt);
  }
  return applyRelationship(tx, event, synchronizedAt);
}

export async function applyOneLvEvent(
  event: OneLvEvent,
  rawBody: string,
): Promise<OneLvApplyResult> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");

  const payloadHash = hash(rawBody);

  return prisma.$transaction(
    async (tx) => {
      const previous = await tx.sourceSynchronizationEvent.findUnique({
        where: { eventId: event.event_id },
      });

      if (previous) {
        if (previous.payloadHash !== payloadHash) {
          throw new OneLvSyncConflictError(
            "The same 1LV event id was reused with a different payload.",
            ["event_id"],
          );
        }

        if (previous.responsePayload && isObject(previous.responsePayload)) {
          return {
            ...(previous.responsePayload as Omit<OneLvApplyResult, "duplicate">),
            duplicate: true,
          };
        }

        const fallbackId =
          previous.identityId ?? previous.sourceProfileId ?? previous.id;
        return {
          duplicate: true,
          id: fallbackId,
          remote_id: fallbackId,
          result: "ALREADY_PROCESSED",
          identity_id: previous.identityId,
          source_profile_id: previous.sourceProfileId,
        };
      }

      const synchronizedAt = new Date();
      const applied = await processEvent(tx, event, synchronizedAt);
      const isCustomer = "identityId" in applied;

      const response: OneLvApplyResult = {
        duplicate: false,
        id: applied.remoteId,
        remote_id: applied.remoteId,
        result: applied.result,
        ...(isCustomer
          ? {
              identity_id: applied.identityId,
              source_profile_id: applied.sourceProfileId,
            }
          : {}),
      };

      await tx.sourceSynchronizationEvent.create({
        data: {
          eventId: event.event_id,
          eventType: event.event_type,
          sourceApplication: ONELV_SOURCE_APPLICATION,
          sourceProfileId: isCustomer ? applied.sourceProfileId : null,
          identityId: isCustomer ? applied.identityId : null,
          payloadHash,
          responsePayload: response as Prisma.InputJsonValue,
          status: "PROCESSED",
          processedAt: synchronizedAt,
        },
      });

      return response;
    },
    { maxWait: 5_000, timeout: 15_000 },
  );
}
