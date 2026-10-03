import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import {
  MasterApiConflictError,
  MasterApiInputError,
  MasterApiUnavailableError,
} from "./errors";
import {
  resolveMasterPerson,
  type MasterPersonPayload,
} from "./identity";
import {
  resolveMasterMerchant,
  type MasterMerchantPayload,
} from "./merchant";
import { assertOneLvCustomerProjectionSafe } from "./payload-safety";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EVENT_TYPES = new Set([
  "customer.created",
  "customer.updated",
  "merchant.application.created",
  "merchant.approved",
  "merchant.suspended",
  "merchant.updated",
  "customer.vendor.first_order",
  "customer.vendor.order_completed",
  "customer.vendor.dispute_opened",
]);

const AGGREGATE_TYPES = new Set([
  "customer",
  "merchant",
  "relationship",
]);

const EXPECTED_AGGREGATE: Record<string, string> = {
  "customer.created": "customer",
  "customer.updated": "customer",
  "merchant.application.created": "merchant",
  "merchant.approved": "merchant",
  "merchant.suspended": "merchant",
  "merchant.updated": "merchant",
  "customer.vendor.first_order": "relationship",
  "customer.vendor.order_completed": "relationship",
  "customer.vendor.dispute_opened": "relationship",
};

export type MasterEventInput = {
  event_id?: string;
  event_type?: string;
  aggregate_type?: string;
  aggregate_id?: string;
  source_application?: string;
  payload?: Record<string, unknown>;
};

function parseInput(input: MasterEventInput) {
  const eventId = input.event_id?.trim() ?? "";
  const eventType = input.event_type?.trim() ?? "";
  const aggregateType = input.aggregate_type?.trim() ?? "";
  const aggregateId = input.aggregate_id?.trim() ?? "";
  const sourceApplication = input.source_application?.trim().toLowerCase() ?? "";

  if (!UUID_RE.test(eventId)) {
    throw new MasterApiInputError("Invalid event id.");
  }
  if (!EVENT_TYPES.has(eventType)) {
    throw new MasterApiInputError("Unsupported event type.");
  }
  if (!AGGREGATE_TYPES.has(aggregateType)) {
    throw new MasterApiInputError("Unsupported aggregate type.");
  }
  if (!aggregateId || aggregateId.length > 200) {
    throw new MasterApiInputError("Invalid aggregate id.");
  }
  if (sourceApplication !== "1lv") {
    throw new MasterApiInputError("Unsupported source application.");
  }
  if (
    !input.payload ||
    typeof input.payload !== "object" ||
    Array.isArray(input.payload)
  ) {
    throw new MasterApiInputError("Event payload is required.");
  }
  if (EXPECTED_AGGREGATE[eventType] !== aggregateType) {
    throw new MasterApiInputError(
      "Event type does not match aggregate type.",
    );
  }
  assertOneLvCustomerProjectionSafe(input.payload);

  return {
    eventId,
    eventType,
    aggregateType,
    aggregateId,
    sourceApplication,
    payload: input.payload,
  };
}

export function sourceCustomerReference(
  payload: Record<string, unknown>,
): string | null {
  for (const key of [
    "customer_local_id",
    "customer_local_reference",
    "guest_reference",
  ] as const) {
    const value = payload[key];
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (!normalized || normalized.length > 200) continue;

    if (
      key === "customer_local_reference" &&
      payload["customer_is_guest"] === true &&
      normalized.startsWith("guest:")
    ) {
      return `order:${normalized.slice("guest:".length)}`;
    }

    return normalized;
  }

  return null;
}

function sourceMerchantReference(
  payload: Record<string, unknown>,
): string | null {
  const value = payload["vendor_local_reference"];
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized && normalized.length <= 200 ? normalized : null;
}

function relationshipTimestamp(
  payload: Record<string, unknown>,
  key: "first_seen_at" | "last_seen_at",
): Date | null {
  const value = payload[key];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new MasterApiInputError(`${key} must be an ISO timestamp.`);
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new MasterApiInputError(`${key} must be an ISO timestamp.`);
  }

  return parsed;
}

function relationshipOrderCount(
  payload: Record<string, unknown>,
): number | null {
  const value = payload["order_count"];
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new MasterApiInputError(
      "order_count must be a non-negative integer.",
    );
  }
  return Number(value);
}

export async function applyMasterEvent(
  rawBody: string,
  input: MasterEventInput,
) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new MasterApiUnavailableError("Database is unavailable.");
  }

  const parsed = parseInput(input);
  const payloadHash = createHash("sha256")
    .update(rawBody, "utf8")
    .digest("hex");

  const previous = await prisma.sourceSynchronizationEvent.findUnique({
    where: { eventId: parsed.eventId },
  });

  if (previous) {
    if (previous.payloadHash !== payloadHash) {
      throw new MasterApiConflictError(
        "Event id was already used with a different payload.",
      );
    }

    const response =
      previous.responsePayload &&
      typeof previous.responsePayload === "object" &&
      !Array.isArray(previous.responsePayload)
        ? (previous.responsePayload as Record<string, unknown>)
        : {};

    return {
      id: previous.id,
      duplicate: true,
      ...response,
    };
  }

  let identityId: string | null = null;
  let sourceProfileId: string | null = null;
  let merchantId: string | null = null;
  let relationshipId: string | null = null;

  if (parsed.aggregateType === "customer") {
    const person = await resolveMasterPerson(
      parsed.payload as MasterPersonPayload,
    );
    identityId = person.id;
    sourceProfileId = person.sourceProfileId;
  } else if (parsed.aggregateType === "merchant") {
    const merchant = await resolveMasterMerchant(
      parsed.payload as MasterMerchantPayload,
    );
    merchantId = merchant.id;
  } else if (parsed.aggregateType === "relationship") {
    const customerReference = sourceCustomerReference(parsed.payload);
    const vendorReference = sourceMerchantReference(parsed.payload);

    if (!customerReference || !vendorReference) {
      throw new MasterApiInputError(
        "Relationship events require customer and merchant references.",
      );
    }

    const [sourceProfile, sourceMerchant] = await Promise.all([
      prisma.sourceProfile.findUnique({
        where: {
          sourceApplication_externalUserId: {
            sourceApplication: "1lv",
            externalUserId: customerReference,
          },
        },
      }),
      prisma.sourceMerchant.findUnique({
        where: {
          sourceApplication_externalMerchantId: {
            sourceApplication: "1lv",
            externalMerchantId: vendorReference,
          },
        },
      }),
    ]);

    if (!sourceProfile) {
      throw new MasterApiConflictError(
        "1LV customer source profile must be synchronized before its relationship.",
      );
    }
    if (!sourceMerchant) {
      throw new MasterApiConflictError(
        "1LV merchant must be synchronized before its customer relationship.",
      );
    }

    identityId = sourceProfile.identityId;
    sourceProfileId = sourceProfile.id;
    merchantId = sourceMerchant.merchantId;

    const firstSeenAt = relationshipTimestamp(
      parsed.payload,
      "first_seen_at",
    );
    const lastSeenAt = relationshipTimestamp(
      parsed.payload,
      "last_seen_at",
    );
    const orderCount = relationshipOrderCount(parsed.payload);

    const relationship = await prisma.marketplaceRelationship.upsert({
      where: {
        sourceApplication_sourceCustomerRef_sourceMerchantId_relationshipType: {
          sourceApplication: "1lv",
          sourceCustomerRef: customerReference,
          sourceMerchantId: sourceMerchant.id,
          relationshipType: "customer_of",
        },
      },
      create: {
        identityId,
        sourceMerchantId: sourceMerchant.id,
        sourceApplication: "1lv",
        sourceCustomerRef: customerReference,
        relationshipType: "customer_of",
        firstSeenAt,
        lastSeenAt,
        orderCount:
          orderCount ??
          (parsed.eventType === "customer.vendor.first_order" ? 1 : null),
      },
      update: {
        identityId,
        ...(firstSeenAt ? { firstSeenAt } : {}),
        ...(lastSeenAt ? { lastSeenAt } : {}),
        ...(orderCount !== null ? { orderCount } : {}),
      },
    });
    relationshipId = relationship.id;
  }

  const responsePayload: Prisma.InputJsonObject = {
    aggregate_type: parsed.aggregateType,
    aggregate_id: parsed.aggregateId,
    ...(identityId ? { identity_id: identityId } : {}),
    ...(merchantId ? { merchant_id: merchantId } : {}),
    ...(relationshipId ? { relationship_id: relationshipId } : {}),
  };

  try {
    const created = await prisma.sourceSynchronizationEvent.create({
      data: {
        eventId: parsed.eventId,
        eventType: parsed.eventType,
        sourceApplication: parsed.sourceApplication,
        sourceProfileId,
        identityId,
        payloadHash,
        payload: parsed.payload as Prisma.InputJsonValue,
        responsePayload,
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    return {
      id: created.id,
      duplicate: false,
      ...responsePayload,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.sourceSynchronizationEvent.findUnique({
        where: { eventId: parsed.eventId },
      });

      if (raced?.payloadHash === payloadHash) {
        return {
          id: raced.id,
          duplicate: true,
          ...(raced.responsePayload as Record<string, unknown> | null),
        };
      }

      throw new MasterApiConflictError(
        "Event id was already used with a different payload.",
      );
    }

    throw error;
  }
}
