import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";

type JsonRecord = Record<string, unknown>;

export type OneLvEventInput = {
  event_id: string;
  event_type: string;
  aggregate_type: "customer" | "merchant" | "order" | "relationship";
  aggregate_id: string;
  source_application: "1lv";
  payload: JsonRecord;
};

export class OneLvIdentityConflictError extends Error {
  constructor(public readonly fields: string[]) {
    super("Identity conflict requires review.");
    this.name = "OneLvIdentityConflictError";
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: unknown): string | null {
  const email = asString(value)?.toLowerCase() ?? null;
  return email && email.includes("@") ? email : null;
}

function normalizePhone(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function splitFullName(value: unknown): { firstName: string | null; lastName: string | null } {
  const fullName = asString(value);
  if (!fullName) return { firstName: null, lastName: null };

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0] ?? null, lastName: null };
  }

  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

function stableUuid(input: string): string {
  const hex = createHash("sha256").update(input, "utf8").digest("hex").slice(0, 32);
  const chars = hex.split("");

  // RFC 4122-compatible deterministic UUID shape.
  chars[12] = "5";
  const variant = Number.parseInt(chars[16] ?? "0", 16);
  chars[16] = ((variant & 0x3) | 0x8).toString(16);

  const normalized = chars.join("");
  return [
    normalized.slice(0, 8),
    normalized.slice(8, 12),
    normalized.slice(12, 16),
    normalized.slice(16, 20),
    normalized.slice(20, 32),
  ].join("-");
}

function hashRawBody(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

function customerExternalId(payload: JsonRecord): string {
  const localProfileId = asString(payload.local_profile_id);
  if (localProfileId) return localProfileId;

  const guestReference = asString(payload.local_guest_reference);
  if (guestReference) return `guest:${guestReference}`;

  throw new Error("customer_reference_required");
}

function merchantStatus(value: unknown): "prospect" | "active" | "paused" {
  const status = asString(value)?.toLowerCase();
  if (status === "active") return "active";
  if (status === "suspended" || status === "paused") return "paused";
  return "prospect";
}

function brandStatus(value: unknown): "draft" | "active" | "paused" {
  const status = asString(value)?.toLowerCase();
  if (status === "active") return "active";
  if (status === "suspended" || status === "paused") return "paused";
  return "draft";
}

function asAddress(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export async function resolveOneLvPerson(payload: JsonRecord) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");

  const externalUserId = customerExternalId(payload);
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const names = splitFullName(payload.full_name);
  const locale = asString(payload.preferred_language);
  const accountCreatedAt = asString(payload.account_created_at);
  const registeredAt =
    accountCreatedAt && Number.isFinite(new Date(accountCreatedAt).getTime())
      ? new Date(accountCreatedAt)
      : undefined;

  return prisma.$transaction(async (transaction) => {
    const existingSource = await transaction.sourceProfile.findUnique({
      where: {
        sourceApplication_externalUserId: {
          sourceApplication: "1lv",
          externalUserId,
        },
      },
      include: { identity: true },
    });

    if (existingSource) {
      const current = existingSource.identity;
      const update: Prisma.MasterIdentityUpdateInput = {};

      if (!current.firstName && names.firstName) update.firstName = names.firstName;
      if (!current.lastName && names.lastName) update.lastName = names.lastName;
      if (!current.primaryEmail && email) update.primaryEmail = email;
      if (!current.primaryPhone && phone) update.primaryPhone = phone;
      if (!current.locale && locale) update.locale = locale;
      if (!current.registeredAt && registeredAt) update.registeredAt = registeredAt;

      if (Object.keys(update).length > 0) {
        await transaction.masterIdentity.update({
          where: { id: current.id },
          data: update,
        });
      }

      await transaction.sourceProfile.update({
        where: { id: existingSource.id },
        data: {
          collectedFields: payload as Prisma.InputJsonValue,
          accountStatus: "active",
          lastSynchronizedAt: new Date(),
        },
      });

      return {
        id: current.id,
        sourceProfileId: existingSource.id,
        created: false,
      };
    }

    const candidates = await transaction.masterIdentity.findMany({
      where: {
        OR: [
          ...(email ? [{ primaryEmail: email }] : []),
          ...(phone ? [{ primaryPhone: phone }] : []),
        ],
      },
      take: 3,
    });

    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    if (candidateIds.size > 1) {
      throw new OneLvIdentityConflictError(["email", "phone"]);
    }

    const identity =
      candidates[0] ??
      (await transaction.masterIdentity.create({
        data: {
          firstName: names.firstName,
          lastName: names.lastName,
          primaryEmail: email,
          primaryEmailVerified: false,
          primaryPhone: phone,
          primaryPhoneVerified: false,
          locale,
          accountStatus: "active",
          registeredAt,
        },
      }));

    const sourceProfile = await transaction.sourceProfile.create({
      data: {
        identityId: identity.id,
        sourceApplication: "1lv",
        externalUserId,
        collectedFields: payload as Prisma.InputJsonValue,
        verifiedFields: [],
        consentRecords: Prisma.JsonNull,
        accountStatus: "active",
        lastSynchronizedAt: new Date(),
      },
    });

    return {
      id: identity.id,
      sourceProfileId: sourceProfile.id,
      created: candidates.length === 0,
    };
  });
}

export async function resolveOneLvMerchant(payload: JsonRecord) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");

  const localVendorId = asString(payload.local_vendor_id);
  const storeName = asString(payload.store_name);

  if (!localVendorId || !storeName) {
    throw new Error("merchant_reference_required");
  }

  const clientId = stableUuid(`1lv:merchant-client:${localVendorId}`);
  const brandId = stableUuid(`1lv:merchant-brand:${localVendorId}`);
  const address = asAddress(payload.address);
  const legalName = asString(payload.legal_business_name);
  const contactEmail = normalizeEmail(payload.contact_email);
  const contactPhone = normalizePhone(payload.contact_phone);
  const country =
    asString(address.country) ??
    "Canada";

  await prisma.$transaction(async (transaction) => {
    await transaction.client.upsert({
      where: { id: clientId },
      create: {
        id: clientId,
        name: storeName,
        email: contactEmail,
        phone: contactPhone,
        companyName: legalName,
        status: merchantStatus(payload.marketplace_status),
        billingCountry: country,
      },
      update: {
        name: storeName,
        email: contactEmail,
        phone: contactPhone,
        companyName: legalName,
        status: merchantStatus(payload.marketplace_status),
        billingCountry: country,
      },
    });

    await transaction.businessBrand.upsert({
      where: { id: brandId },
      create: {
        id: brandId,
        clientId,
        name: storeName,
        legalName,
        phone: contactPhone,
        addressLine1: asString(address.line1),
        city: asString(address.city),
        region: asString(address.province),
        postalCode: asString(address.postal_code),
        country,
        status: brandStatus(payload.marketplace_status),
      },
      update: {
        name: storeName,
        legalName,
        phone: contactPhone,
        addressLine1: asString(address.line1),
        city: asString(address.city),
        region: asString(address.province),
        postalCode: asString(address.postal_code),
        country,
        status: brandStatus(payload.marketplace_status),
      },
    });
  });

  return {
    id: brandId,
    clientId,
    created: false,
  };
}

export function parseOneLvEvent(value: unknown): OneLvEventInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as JsonRecord;

  const eventId = asString(raw.event_id);
  const eventType = asString(raw.event_type);
  const aggregateType = asString(raw.aggregate_type);
  const aggregateId = asString(raw.aggregate_id);
  const sourceApplication = asString(raw.source_application);
  const payload =
    raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)
      ? (raw.payload as JsonRecord)
      : null;

  if (
    !eventId ||
    !eventType ||
    !aggregateId ||
    sourceApplication !== "1lv" ||
    !payload ||
    !["customer", "merchant", "order", "relationship"].includes(aggregateType ?? "")
  ) {
    return null;
  }

  return {
    event_id: eventId,
    event_type: eventType,
    aggregate_type: aggregateType as OneLvEventInput["aggregate_type"],
    aggregate_id: aggregateId,
    source_application: "1lv",
    payload,
  };
}

export async function applyOneLvEvent(event: OneLvEventInput, rawBody: string) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");

  const payloadHash = hashRawBody(rawBody);
  const previous = await prisma.sourceSynchronizationEvent.findUnique({
    where: { eventId: event.event_id },
  });

  if (previous) {
    if (previous.payloadHash !== payloadHash) {
      throw new OneLvIdentityConflictError(["event_id"]);
    }

    const response =
      previous.responsePayload &&
      typeof previous.responsePayload === "object" &&
      !Array.isArray(previous.responsePayload)
        ? (previous.responsePayload as JsonRecord)
        : {};

    return {
      duplicate: true,
      id: asString(response.id) ?? previous.id,
      result: asString(response.result) ?? "ALREADY_PROCESSED",
    };
  }

  let remoteId: string;
  let sourceProfileId: string | null = null;
  let identityId: string | null = null;
  let result = "EVENT_PROCESSED";

  if (event.aggregate_type === "customer") {
    const person = await resolveOneLvPerson(event.payload);
    remoteId = person.id;
    sourceProfileId = person.sourceProfileId;
    identityId = person.id;
    result = person.created ? "PERSON_CREATED" : "PERSON_UPDATED";
  } else if (event.aggregate_type === "merchant") {
    const merchant = await resolveOneLvMerchant(event.payload);
    remoteId = merchant.id;
    result = "MERCHANT_SYNCHRONIZED";
  } else {
    remoteId = stableUuid(`1lv:${event.aggregate_type}:${event.aggregate_id}`);
  }

  const responsePayload = {
    id: remoteId,
    result,
    aggregate_type: event.aggregate_type,
  };

  await prisma.sourceSynchronizationEvent.create({
    data: {
      eventId: event.event_id,
      eventType: event.event_type,
      sourceApplication: "1lv",
      sourceProfileId,
      identityId,
      payloadHash,
      responsePayload: responsePayload as Prisma.InputJsonValue,
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });

  return {
    duplicate: false,
    ...responsePayload,
  };
}
