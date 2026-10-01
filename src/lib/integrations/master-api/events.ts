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
  "order.created",
  "order.paid",
  "order.fulfilled",
  "order.refunded",
]);

const AGGREGATE_TYPES = new Set([
  "customer",
  "merchant",
  "order",
  "relationship",
]);

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

  return {
    eventId,
    eventType,
    aggregateType,
    aggregateId,
    sourceApplication,
    payload: input.payload,
  };
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
  } else {
    const customerLocalId =
      typeof parsed.payload["customer_local_id"] === "string"
        ? parsed.payload["customer_local_id"]
        : null;

    if (customerLocalId) {
      const sourceProfile = await prisma.sourceProfile.findUnique({
        where: {
          sourceApplication_externalUserId: {
            sourceApplication: "1lv",
            externalUserId: customerLocalId,
          },
        },
      });
      identityId = sourceProfile?.identityId ?? null;
      sourceProfileId = sourceProfile?.id ?? null;
    }
  }

  const responsePayload: Prisma.InputJsonObject = {
    aggregate_type: parsed.aggregateType,
    aggregate_id: parsed.aggregateId,
    ...(identityId ? { identity_id: identityId } : {}),
    ...(merchantId ? { merchant_id: merchantId } : {}),
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
