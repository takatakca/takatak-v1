import "server-only";

import {
  Prisma,
  type MasterIdentity,
} from "@prisma/client";

import { normalizePhone } from "@/lib/auth/otp/phone";
import { getPrisma } from "@/lib/db/prisma";
import {
  MasterApiConflictError,
  MasterApiInputError,
  MasterApiUnavailableError,
} from "./errors";
import { assertMasterPayloadSafe } from "./payload-safety";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MasterPersonPayload = {
  source_application?: string;
  master_identity_id?: string | null;
  local_profile_id?: string | null;
  local_guest_reference?: string | null;
  is_guest?: boolean;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  preferred_language?: string | null;
  country?: string | null;
  province?: string | null;
  account_created_at?: string | null;
};

export type ResolvedMasterIdentity = {
  id: string;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  locale: string | null;
  sourceProfileId: string | null;
};

type Tx = Prisma.TransactionClient;

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function parseName(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function sourceApplication(payload: MasterPersonPayload): string {
  const source = payload.source_application?.trim().toLowerCase() ?? "";
  if (source !== "1lv") {
    throw new MasterApiInputError("Unsupported source application.");
  }
  return source;
}

function externalUserId(payload: MasterPersonPayload): string {
  const value =
    payload.local_profile_id?.trim() ||
    payload.local_guest_reference?.trim() ||
    "";

  if (!value || value.length > 200) {
    throw new MasterApiInputError(
      "A local profile or guest reference is required.",
    );
  }

  return value;
}

async function updateMissingIdentityFields(
  tx: Tx,
  identity: MasterIdentity,
  payload: MasterPersonPayload,
): Promise<MasterIdentity> {
  const name = parseName(payload.full_name);
  const data: Prisma.MasterIdentityUpdateInput = {};

  if (!identity.firstName && name.firstName) data.firstName = name.firstName;
  if (!identity.lastName && name.lastName) data.lastName = name.lastName;
  if (!identity.locale && payload.preferred_language) {
    data.locale = payload.preferred_language.slice(0, 16);
  }
  if (Object.keys(data).length === 0) return identity;

  return tx.masterIdentity.update({
    where: { id: identity.id },
    data,
  });
}

async function resolveExplicitIdentity(
  tx: Tx,
  payload: MasterPersonPayload,
): Promise<MasterIdentity | null> {
  const explicitId = payload.master_identity_id?.trim() ?? "";
  if (!explicitId) return null;

  if (!UUID_RE.test(explicitId)) {
    throw new MasterApiInputError("Invalid master identity id.");
  }

  const identity = await tx.masterIdentity.findUnique({
    where: { id: explicitId },
  });

  if (!identity) {
    throw new MasterApiConflictError(
      "Master identity link does not exist.",
    );
  }

  return identity;
}

export async function resolveMasterPerson(
  payload: MasterPersonPayload,
): Promise<ResolvedMasterIdentity> {
  assertMasterPayloadSafe(payload);
  const prisma = getPrisma();
  if (!prisma) {
    throw new MasterApiUnavailableError(
      "Authentication database is unavailable.",
    );
  }

  const source = sourceApplication(payload);
  const externalId = externalUserId(payload);
  const email = normalizeEmail(payload.email);
  const phone = payload.phone ? normalizePhone(payload.phone) : null;

  if (payload.phone && !phone) {
    throw new MasterApiInputError("Invalid phone number.");
  }

  return prisma.$transaction(async (tx) => {
    const existingSource = await tx.sourceProfile.findUnique({
      where: {
        sourceApplication_externalUserId: {
          sourceApplication: source,
          externalUserId: externalId,
        },
      },
      include: { identity: true },
    });

    if (existingSource) {
      const explicitId = payload.master_identity_id?.trim() ?? "";
      let linkedIdentity = existingSource.identity;

      if (explicitId && explicitId !== existingSource.identityId) {
        if (!UUID_RE.test(explicitId)) {
          throw new MasterApiInputError("Invalid master identity id.");
        }

        const verifiedTarget = await tx.masterIdentity.findUnique({
          where: { id: explicitId },
        });
        if (!verifiedTarget) {
          throw new MasterApiConflictError(
            "Master identity link does not exist.",
          );
        }

        const sourceOnlyIdentity =
          !existingSource.identity.profileId &&
          !existingSource.identity.primaryEmailVerified &&
          !existingSource.identity.primaryPhoneVerified;

        const sourceProfileCount = await tx.sourceProfile.count({
          where: { identityId: existingSource.identityId },
        });

        if (!sourceOnlyIdentity || sourceProfileCount !== 1) {
          throw new MasterApiConflictError(
            "This source profile is already linked to another master identity.",
          );
        }

        // A source-only placeholder may be promoted only after TAKATAK has
        // supplied an explicit verified master identity. Unverified source
        // email/phone values never perform this merge.
        await tx.sourceAddress.updateMany({
          where: { sourceProfileId: existingSource.id },
          data: { identityId: verifiedTarget.id },
        });
        await tx.sourcePaymentSummary.updateMany({
          where: { sourceProfileId: existingSource.id },
          data: { identityId: verifiedTarget.id },
        });
        await tx.sourceSynchronizationEvent.updateMany({
          where: { sourceProfileId: existingSource.id },
          data: { identityId: verifiedTarget.id },
        });
        await tx.sourceProfile.update({
          where: { id: existingSource.id },
          data: { identityId: verifiedTarget.id },
        });

        linkedIdentity = verifiedTarget;
      }

      const identity = await updateMissingIdentityFields(
        tx,
        linkedIdentity,
        payload,
      );

      const verifiedFields = [
        ...(identity.primaryEmailVerified &&
        email &&
        identity.primaryEmail === email
          ? ["email"]
          : []),
        ...(identity.primaryPhoneVerified &&
        phone &&
        identity.primaryPhone === phone
          ? ["phone"]
          : []),
      ];

      await tx.sourceProfile.update({
        where: { id: existingSource.id },
        data: {
          collectedFields: payload as Prisma.InputJsonValue,
          verifiedFields,
          accountStatus: payload.is_guest ? "guest" : "active",
          lastSynchronizedAt: new Date(),
        },
      });

      return {
        id: identity.id,
        phone: identity.primaryPhone,
        email: identity.primaryEmail,
        firstName: identity.firstName,
        lastName: identity.lastName,
        locale: identity.locale,
        sourceProfileId: existingSource.id,
      };
    }

    let identity = await resolveExplicitIdentity(tx, payload);

    if (!identity) {
      identity = await tx.masterIdentity.create({
        data: {
          // Unverified source identifiers stay only in SourceProfile.
          // They must never become global TAKATAK identity keys.
          firstName: null,
          lastName: null,
          primaryEmail: null,
          primaryEmailVerified: false,
          primaryPhone: null,
          primaryPhoneVerified: false,
          locale: null,
          accountStatus: "source_only",
          registeredAt: payload.account_created_at
            ? new Date(payload.account_created_at)
            : undefined,
        },
      });
    } else {
      identity = await updateMissingIdentityFields(tx, identity, payload);
    }

    const verifiedFields = [
      ...(identity.primaryEmailVerified &&
      email &&
      identity.primaryEmail === email
        ? ["email"]
        : []),
      ...(identity.primaryPhoneVerified &&
      phone &&
      identity.primaryPhone === phone
        ? ["phone"]
        : []),
    ];

    const sourceProfile = await tx.sourceProfile.create({
      data: {
        identityId: identity.id,
        sourceApplication: source,
        externalUserId: externalId,
        collectedFields: payload as Prisma.InputJsonValue,
        verifiedFields,
        consentRecords: Prisma.JsonNull,
        accountStatus: payload.is_guest ? "guest" : "active",
        lastSynchronizedAt: new Date(),
      },
    });

    return {
      id: identity.id,
      phone: identity.primaryPhone,
      email: identity.primaryEmail,
      firstName: identity.firstName,
      lastName: identity.lastName,
      locale: identity.locale,
      sourceProfileId: sourceProfile.id,
    };
  });
}

export async function resolveVerifiedPhoneIdentity(
  rawPhone: string,
  verifiedAuthUserId: string,
  metadata: {
    firstName?: string | null;
    lastName?: string | null;
    locale?: string | null;
  } = {},
): Promise<ResolvedMasterIdentity> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new MasterApiUnavailableError(
      "Authentication database is unavailable.",
    );
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) throw new MasterApiInputError("Invalid phone number.");
  if (!UUID_RE.test(verifiedAuthUserId)) {
    throw new MasterApiInputError("Invalid verified auth user id.");
  }

  const firstName = metadata.firstName?.trim().slice(0, 100) || null;
  const lastName = metadata.lastName?.trim().slice(0, 100) || null;
  const locale = metadata.locale?.trim().slice(0, 16) || null;

  const emailForResponse = (identity: {
    primaryEmail: string | null;
    primaryEmailVerified: boolean;
  }): string | null =>
    identity.primaryEmailVerified ? identity.primaryEmail : null;

  const resultFromIdentity = (
    identity: {
      id: string;
      primaryPhone: string | null;
      primaryEmail: string | null;
      primaryEmailVerified: boolean;
      firstName: string | null;
      lastName: string | null;
      locale: string | null;
      profile?: {
        email: string;
        firstName: string | null;
        lastName: string | null;
        language: string;
      } | null;
    },
  ): ResolvedMasterIdentity => ({
    id: identity.id,
    phone: identity.primaryPhone,
    email: emailForResponse(identity),
    firstName: identity.firstName ?? identity.profile?.firstName ?? null,
    lastName: identity.lastName ?? identity.profile?.lastName ?? null,
    locale: identity.locale ?? identity.profile?.language ?? null,
    sourceProfileId: null,
  });

  const assertCompatible = (
    identity: {
      authUserId: string | null;
      profile?: { authUserId: string } | null;
    },
  ) => {
    if (identity.authUserId && identity.authUserId !== verifiedAuthUserId) {
      throw new MasterApiConflictError(
        "This verified phone is linked to another TAKATAK auth user.",
      );
    }
    if (
      identity.profile &&
      identity.profile.authUserId !== verifiedAuthUserId
    ) {
      throw new MasterApiConflictError(
        "This verified phone is linked to another TAKATAK auth user.",
      );
    }
  };

  try {
    return await prisma.$transaction(async (tx) => {
      // Auth UUID is the durable identity binding. This allows a legitimately
      // re-verified phone change without letting a recycled number take over an
      // unrelated master identity.
      const byAuthUser = await tx.masterIdentity.findUnique({
        where: { authUserId: verifiedAuthUserId },
        include: { profile: true },
      });

      if (byAuthUser) {
        assertCompatible(byAuthUser);

        const phoneOwner = await tx.masterIdentity.findUnique({
          where: { primaryPhone: phone },
        });
        if (phoneOwner && phoneOwner.id !== byAuthUser.id) {
          throw new MasterApiConflictError(
            "This verified phone belongs to another master identity.",
          );
        }

        const updated = await tx.masterIdentity.update({
          where: { id: byAuthUser.id },
          data: {
            primaryPhone: phone,
            primaryPhoneVerified: true,
            firstName: byAuthUser.firstName ?? firstName,
            lastName: byAuthUser.lastName ?? lastName,
            locale: byAuthUser.locale ?? locale,
          },
          include: { profile: true },
        });

        return resultFromIdentity(updated);
      }

      const byPhone = await tx.masterIdentity.findUnique({
        where: { primaryPhone: phone },
        include: { profile: true },
      });

      if (byPhone) {
        assertCompatible(byPhone);

        const updated = await tx.masterIdentity.update({
          where: { id: byPhone.id },
          data: {
            authUserId: verifiedAuthUserId,
            primaryPhoneVerified: true,
            firstName: byPhone.firstName ?? firstName,
            lastName: byPhone.lastName ?? lastName,
            locale: byPhone.locale ?? locale,
          },
          include: { profile: true },
        });

        return resultFromIdentity(updated);
      }

      const profile = await tx.profile.findUnique({
        where: { phone },
        include: { masterIdentity: true },
      });

      if (profile && profile.authUserId !== verifiedAuthUserId) {
        throw new MasterApiConflictError(
          "This verified phone is linked to another TAKATAK auth user.",
        );
      }

      if (profile?.masterIdentity) {
        assertCompatible({
          authUserId: profile.masterIdentity.authUserId,
          profile,
        });

        const updated = await tx.masterIdentity.update({
          where: { id: profile.masterIdentity.id },
          data: {
            authUserId: verifiedAuthUserId,
            primaryPhone: phone,
            primaryPhoneVerified: true,
            firstName:
              profile.masterIdentity.firstName ?? profile.firstName ?? firstName,
            lastName:
              profile.masterIdentity.lastName ?? profile.lastName ?? lastName,
            locale:
              profile.masterIdentity.locale ?? profile.language ?? locale,
          },
          include: { profile: true },
        });

        return resultFromIdentity(updated);
      }

      if (profile) {
        const created = await tx.masterIdentity.create({
          data: {
            profileId: profile.id,
            authUserId: verifiedAuthUserId,
            firstName: profile.firstName ?? firstName,
            lastName: profile.lastName ?? lastName,
            primaryEmail: null,
            primaryEmailVerified: false,
            primaryPhone: phone,
            primaryPhoneVerified: true,
            locale: profile.language ?? locale,
            accountStatus: profile.status,
            registeredAt: profile.createdAt,
          },
          include: { profile: true },
        });

        return resultFromIdentity(created);
      }

      const created = await tx.masterIdentity.create({
        data: {
          authUserId: verifiedAuthUserId,
          primaryPhone: phone,
          primaryPhoneVerified: true,
          firstName,
          lastName,
          locale,
          accountStatus: "active",
        },
        include: { profile: true },
      });

      return resultFromIdentity(created);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const [byAuthUser, byPhone] = await Promise.all([
        prisma.masterIdentity.findUnique({
          where: { authUserId: verifiedAuthUserId },
          include: { profile: true },
        }),
        prisma.masterIdentity.findUnique({
          where: { primaryPhone: phone },
          include: { profile: true },
        }),
      ]);

      if (
        byAuthUser &&
        byPhone &&
        byAuthUser.id !== byPhone.id
      ) {
        throw new MasterApiConflictError(
          "Verified Auth user and phone resolve to different master identities.",
        );
      }

      const existing = byAuthUser ?? byPhone;
      if (existing) {
        assertCompatible(existing);

        const updated = await prisma.masterIdentity.update({
          where: { id: existing.id },
          data: {
            authUserId: verifiedAuthUserId,
            primaryPhone: phone,
            primaryPhoneVerified: true,
            firstName: existing.firstName ?? firstName,
            lastName: existing.lastName ?? lastName,
            locale: existing.locale ?? locale,
          },
          include: { profile: true },
        });

        return resultFromIdentity(updated);
      }
    }

    throw error;
  }
}
