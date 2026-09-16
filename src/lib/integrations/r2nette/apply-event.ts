import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";

import type {
  R2NetteEvent,
  R2NetteProfileEvent,
} from "./types";

type Transaction = Prisma.TransactionClient;

export class IdentityConflictError extends Error {
  constructor(
    public readonly conflictingFields: string[],
  ) {
    super("Identity conflict requires review.");
    this.name = "IdentityConflictError";
  }
}

function normalizeEmail(
  value?: string,
): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function normalizePhone(
  value?: string,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) {
    return undefined;
  }

  return trimmed.startsWith("+")
    ? `+${digits}`
    : digits;
}

function hashPayload(value: string): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

async function resolveIdentity(
  transaction: Transaction,
  event: R2NetteProfileEvent,
) {
  const existingSource =
    await transaction.sourceProfile.findUnique({
      where: {
        sourceApplication_externalUserId: {
          sourceApplication:
            event.sourceApplication,
          externalUserId: event.externalUserId,
        },
      },
      include: {
        identity: true,
      },
    });

  if (existingSource) {
    return {
      identity: existingSource.identity,
      sourceProfile: existingSource,
      created: false,
    };
  }

  const email = normalizeEmail(
    event.collectedFields.email,
  );

  const phone = normalizePhone(
    event.collectedFields.phone,
  );

  const emailVerified =
    Boolean(email) &&
    event.verifiedFields.includes("email");

  const phoneVerified =
    Boolean(phone) &&
    event.verifiedFields.includes("phone");

  const candidates =
    await transaction.masterIdentity.findMany({
      where: {
        OR: [
          ...(emailVerified
            ? [{ primaryEmail: email }]
            : []),
          ...(phoneVerified
            ? [{ primaryPhone: phone }]
            : []),
        ],
      },
    });

  const candidateIds = new Set(
    candidates.map((candidate) => candidate.id),
  );

  if (candidateIds.size > 1) {
    throw new IdentityConflictError([
      "email",
      "phone",
    ]);
  }

  const identity =
    candidates[0] ??
    await transaction.masterIdentity.create({
      data: {
        firstName:
          event.collectedFields.firstName?.trim(),
        lastName:
          event.collectedFields.lastName?.trim(),
        primaryEmail: email,
        primaryEmailVerified: emailVerified,
        primaryPhone: phone,
        primaryPhoneVerified: phoneVerified,
        locale: event.collectedFields.locale,
        accountStatus:
          event.collectedFields.accountStatus,
        registeredAt:
          event.collectedFields.registeredAt
            ? new Date(
                event.collectedFields.registeredAt,
              )
            : undefined,
      },
    });

  const sourceProfile =
    await transaction.sourceProfile.create({
      data: {
        identityId: identity.id,
        sourceApplication:
          event.sourceApplication,
        externalUserId: event.externalUserId,
        collectedFields:
          event.collectedFields as Prisma.InputJsonValue,
        verifiedFields: event.verifiedFields,
        consentRecords:
          event.consentRecords as Prisma.InputJsonValue,
        accountStatus:
          event.collectedFields.accountStatus,
        lastSynchronizedAt:
          new Date(event.occurredAt),
      },
    });

  return {
    identity,
    sourceProfile,
    created: candidates.length === 0,
  };
}

async function applyProfileEvent(
  transaction: Transaction,
  event: R2NetteProfileEvent,
) {
  const resolved = await resolveIdentity(
    transaction,
    event,
  );

  const current =
    await transaction.masterIdentity.findUniqueOrThrow({
      where: {
        id: resolved.identity.id,
      },
    });

  const email = normalizeEmail(
    event.collectedFields.email,
  );

  const phone = normalizePhone(
    event.collectedFields.phone,
  );

  const emailVerified =
    Boolean(email) &&
    event.verifiedFields.includes("email");

  const phoneVerified =
    Boolean(phone) &&
    event.verifiedFields.includes("phone");

  const emailOwner = email
    ? await transaction.masterIdentity.findFirst({
        where: {
          id: {
            not: current.id,
          },
          primaryEmail: email,
        },
      })
    : null;

  const phoneOwner = phone
    ? await transaction.masterIdentity.findFirst({
        where: {
          id: {
            not: current.id,
          },
          primaryPhone: phone,
        },
      })
    : null;

  const conflicts: string[] = [];

  if (emailOwner) {
    conflicts.push("email");
  }

  if (phoneOwner) {
    conflicts.push("phone");
  }

  if (conflicts.length > 0) {
    throw new IdentityConflictError(conflicts);
  }

  const acceptedFields: string[] = [];
  const ignoredFields: string[] = [];

  const update: Prisma.MasterIdentityUpdateInput = {};

  function accept(
    field: string,
    value: unknown,
  ): void {
    acceptedFields.push(field);

    (
      update as Record<string, unknown>
    )[field] = value;
  }

  function ignore(field: string): void {
    ignoredFields.push(field);
  }

  const firstName =
    event.collectedFields.firstName?.trim();

  if (firstName) {
    if (!current.firstName) {
      accept("firstName", firstName);
    } else if (current.firstName !== firstName) {
      ignore("firstName");
    }
  }

  const lastName =
    event.collectedFields.lastName?.trim();

  if (lastName) {
    if (!current.lastName) {
      accept("lastName", lastName);
    } else if (current.lastName !== lastName) {
      ignore("lastName");
    }
  }

  if (email) {
    if (
      !current.primaryEmail ||
      current.primaryEmail === email ||
      (
        emailVerified &&
        !current.primaryEmailVerified
      )
    ) {
      accept("primaryEmail", email);

      update.primaryEmailVerified =
        current.primaryEmailVerified ||
        emailVerified;
    } else {
      ignore("email");
    }
  }

  if (phone) {
    if (
      !current.primaryPhone ||
      current.primaryPhone === phone ||
      (
        phoneVerified &&
        !current.primaryPhoneVerified
      )
    ) {
      accept("primaryPhone", phone);

      update.primaryPhoneVerified =
        current.primaryPhoneVerified ||
        phoneVerified;
    } else {
      ignore("phone");
    }
  }

  if (event.collectedFields.locale) {
    if (
      !current.locale ||
      current.locale ===
        event.collectedFields.locale
    ) {
      accept(
        "locale",
        event.collectedFields.locale,
      );
    } else {
      ignore("locale");
    }
  }

  if (event.collectedFields.accountStatus) {
    accept(
      "accountStatus",
      event.collectedFields.accountStatus,
    );
  }

  await transaction.masterIdentity.update({
    where: {
      id: current.id,
    },
    data: update,
  });

  await transaction.sourceProfile.update({
    where: {
      id: resolved.sourceProfile.id,
    },
    data: {
      collectedFields:
        event.collectedFields as Prisma.InputJsonValue,
      verifiedFields: event.verifiedFields,
      consentRecords:
        event.consentRecords as Prisma.InputJsonValue,
      accountStatus:
        event.collectedFields.accountStatus,
      lastSynchronizedAt:
        new Date(event.occurredAt),
    },
  });

  for (
    const address of
      event.collectedFields.addresses ?? []
  ) {
    await transaction.sourceAddress.upsert({
      where: {
        sourceProfileId_externalAddressId: {
          sourceProfileId:
            resolved.sourceProfile.id,
          externalAddressId: address.id,
        },
      },
      create: {
        identityId: current.id,
        sourceProfileId:
          resolved.sourceProfile.id,
        externalAddressId: address.id,
        addressType: address.type,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
        country: address.country.toUpperCase(),
        active: address.active ?? true,
      },
      update: {
        addressType: address.type,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
        country: address.country.toUpperCase(),
        active: address.active ?? true,
      },
    });

    acceptedFields.push(
      `addresses.${address.id}`,
    );
  }

  return {
    identityId: current.id,
    sourceProfileId: resolved.sourceProfile.id,
    created: resolved.created,
    acceptedFields,
    ignoredFields,
  };
}

export async function applyR2NetteEvent(
  event: R2NetteEvent,
  rawBody: string,
) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new Error("database_unavailable");
  }

  const payloadHash = hashPayload(rawBody);

  return prisma.$transaction(
    async (transaction) => {
      const previousEvent =
        await transaction
          .sourceSynchronizationEvent
          .findUnique({
            where: {
              eventId: event.eventId,
            },
          });

      if (previousEvent) {
        if (
          previousEvent.payloadHash !== payloadHash
        ) {
          throw new IdentityConflictError([
            "eventId",
          ]);
        }

        if (previousEvent.responsePayload) {
            return previousEvent.responsePayload as {
              duplicate: boolean;
              takatakIdentityId: string | null;
              sourceProfileId: string | null;
              result: string;
              acceptedFields: string[];
              ignoredFields: string[];
            };
        }

        return {
          duplicate: true,
          takatakIdentityId:
            previousEvent.identityId,
          sourceProfileId:
            previousEvent.sourceProfileId,
          result: "ALREADY_PROCESSED",
          acceptedFields: [],
          ignoredFields: [],
        };
      }

      if (
        event.eventType ===
        "PAYMENT_SUMMARY_UPDATED"
      ) {
        const sourceProfile =
          await transaction.sourceProfile.findUnique({
            where: {
              sourceApplication_externalUserId: {
                sourceApplication:
                  event.sourceApplication,
                externalUserId:
                  event.externalUserId,
              },
            },
          });

        if (!sourceProfile) {
          throw new Error(
            "source_profile_not_found",
          );
        }

        await transaction
          .sourcePaymentSummary
          .upsert({
            where: {
              sourceApplication_bookingNumber: {
                sourceApplication:
                  event.sourceApplication,
                bookingNumber:
                  event.payment.bookingNumber,
              },
            },
            create: {
              identityId:
                sourceProfile.identityId,
              sourceProfileId:
                sourceProfile.id,
              sourceApplication:
                event.sourceApplication,
              bookingNumber:
                event.payment.bookingNumber,
              status: event.payment.status,
              amountMinor: event.payment.amount,
              refundedAmountMinor:
                event.payment.refundedAmount,
              currency:
                event.payment.currency,
              transactionDate: new Date(
                event.payment.transactionDate,
              ),
              stripeCustomerReference:
                event.payment
                  .stripeCustomerReference,
            },
            update: {
              status: event.payment.status,
              amountMinor: event.payment.amount,
              refundedAmountMinor:
                event.payment.refundedAmount,
              currency:
                event.payment.currency,
              transactionDate: new Date(
                event.payment.transactionDate,
              ),
              stripeCustomerReference:
                event.payment
                  .stripeCustomerReference,
            },
          });
        const paymentResponse = {
            duplicate: false,
            takatakIdentityId:
              sourceProfile.identityId,
            sourceProfileId:
              sourceProfile.id,
            result: "PAYMENT_UPDATED",
            acceptedFields: ["payment"],
            ignoredFields: [],
        };
            
        await transaction
          .sourceSynchronizationEvent
          .create({
            data: {
              eventId: event.eventId,
              eventType: event.eventType,
              sourceApplication:
                event.sourceApplication,
              sourceProfileId:
                sourceProfile.id,
              identityId:
                sourceProfile.identityId,
                payloadHash,
                responsePayload:
                  paymentResponse as Prisma.InputJsonValue,
                status: "PROCESSED",
              processedAt: new Date(),
            },
          });

        return {
          duplicate: false,
          takatakIdentityId:
            sourceProfile.identityId,
          sourceProfileId:
            sourceProfile.id,
          result: "PAYMENT_UPDATED",
          acceptedFields: ["payment"],
          ignoredFields: [],
        };
      }

      const profileResult =
        await applyProfileEvent(
          transaction,
          event,
        );

        const profileResponse = {
            duplicate: false,
            takatakIdentityId:
              profileResult.identityId,
            sourceProfileId:
              profileResult.sourceProfileId,
            result: profileResult.created
              ? "PROFILE_CREATED"
              : "PROFILE_UPDATED",
            acceptedFields:
              profileResult.acceptedFields,
            ignoredFields:
              profileResult.ignoredFields,
          };

      await transaction
        .sourceSynchronizationEvent
        .create({
          data: {
            eventId: event.eventId,
            eventType: event.eventType,
            sourceApplication:
              event.sourceApplication,
            sourceProfileId:
              profileResult.sourceProfileId,
            identityId:
              profileResult.identityId,
            payloadHash,
            responsePayload:
              profileResponse as Prisma.InputJsonValue,
            status: "PROCESSED",
            processedAt: new Date(),
          },
        });

      return {
        duplicate: false,
        takatakIdentityId:
          profileResult.identityId,
        sourceProfileId:
          profileResult.sourceProfileId,
        result: profileResult.created
          ? "PROFILE_CREATED"
          : "PROFILE_UPDATED",
        acceptedFields:
          profileResult.acceptedFields,
        ignoredFields:
          profileResult.ignoredFields,
      };
    },
    {
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}