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
  const email = normalizeEmail(payload.email);
  const phone = payload.phone ? normalizePhone(payload.phone) : null;
  const name = parseName(payload.full_name);
  const data: Prisma.MasterIdentityUpdateInput = {};

  if (!identity.firstName && name.firstName) data.firstName = name.firstName;
  if (!identity.lastName && name.lastName) data.lastName = name.lastName;
  if (!identity.locale && payload.preferred_language) {
    data.locale = payload.preferred_language.slice(0, 16);
  }
  if (!identity.primaryEmail && email) {
    data.primaryEmail = email;
    data.primaryEmailVerified = false;
  }
  if (!identity.primaryPhone && phone) {
    data.primaryPhone = phone;
    data.primaryPhoneVerified = false;
  }

  if (Object.keys(data).length === 0) return identity;

  return tx.masterIdentity.update({
    where: { id: identity.id },
    data,
  });
}

async function resolveCandidate(
  tx: Tx,
  payload: MasterPersonPayload,
): Promise<MasterIdentity | null> {
  const explicitId = payload.master_identity_id?.trim() ?? "";

  if (explicitId) {
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

  const email = normalizeEmail(payload.email);
  const phone = payload.phone ? normalizePhone(payload.phone) : null;
  const candidates = new Map<string, MasterIdentity>();

  if (phone) {
    const byPhone = await tx.masterIdentity.findUnique({
      where: { primaryPhone: phone },
    });
    if (byPhone?.primaryPhoneVerified) {
      candidates.set(byPhone.id, byPhone);
    }
  }

  if (email) {
    const byEmail = await tx.masterIdentity.findUnique({
      where: { primaryEmail: email },
    });
    if (byEmail?.primaryEmailVerified) {
      candidates.set(byEmail.id, byEmail);
    }

    const profile = await tx.profile.findUnique({
      where: { email },
      include: { masterIdentity: true },
    });
    if (profile?.masterIdentity) {
      candidates.set(profile.masterIdentity.id, profile.masterIdentity);
    }
  }

  if (candidates.size > 1) {
    throw new MasterApiConflictError(
      "Verified identifiers resolve to different master identities.",
    );
  }

  return [...candidates.values()][0] ?? null;
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
      const explicitId = payload.master_identity_id?.trim();
      if (explicitId && explicitId !== existingSource.identityId) {
        throw new MasterApiConflictError(
          "This source profile is already linked to another master identity.",
        );
      }

      const identity = await updateMissingIdentityFields(
        tx,
        existingSource.identity,
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

    let identity = await resolveCandidate(tx, payload);
    const name = parseName(payload.full_name);

    if (!identity) {
      identity = await tx.masterIdentity.create({
        data: {
          firstName: name.firstName,
          lastName: name.lastName,
          primaryEmail: email,
          primaryEmailVerified: false,
          primaryPhone: phone,
          primaryPhoneVerified: false,
          locale: payload.preferred_language?.slice(0, 16) || null,
          accountStatus: payload.is_guest ? "guest" : "active",
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
): Promise<ResolvedMasterIdentity> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new MasterApiUnavailableError(
      "Authentication database is unavailable.",
    );
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) throw new MasterApiInputError("Invalid phone number.");

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.masterIdentity.findUnique({
        where: { primaryPhone: phone },
        include: { profile: true },
      });

      if (existing) {
        const updated = await tx.masterIdentity.update({
          where: { id: existing.id },
          data: { primaryPhoneVerified: true },
          include: { profile: true },
        });

        return {
          id: updated.id,
          phone: updated.primaryPhone,
          email: updated.primaryEmail ?? updated.profile?.email ?? null,
          firstName: updated.firstName ?? updated.profile?.firstName ?? null,
          lastName: updated.lastName ?? updated.profile?.lastName ?? null,
          locale: updated.locale ?? updated.profile?.language ?? null,
          sourceProfileId: null,
        };
      }

      const profile = await tx.profile.findUnique({
        where: { phone },
        include: { masterIdentity: true },
      });

      if (profile?.masterIdentity) {
        if (
          profile.masterIdentity.primaryPhone &&
          profile.masterIdentity.primaryPhone !== phone
        ) {
          throw new MasterApiConflictError(
            "This dashboard profile is linked to another verified phone.",
          );
        }

        const updated = await tx.masterIdentity.update({
          where: { id: profile.masterIdentity.id },
          data: {
            primaryPhone: phone,
            primaryPhoneVerified: true,
          },
        });

        return {
          id: updated.id,
          phone,
          email: updated.primaryEmail ?? profile.email,
          firstName: updated.firstName ?? profile.firstName,
          lastName: updated.lastName ?? profile.lastName,
          locale: updated.locale ?? profile.language,
          sourceProfileId: null,
        };
      }

      if (profile) {
        const created = await tx.masterIdentity.create({
          data: {
            profileId: profile.id,
            firstName: profile.firstName,
            lastName: profile.lastName,
            primaryEmail: profile.email,
            primaryEmailVerified: false,
            primaryPhone: phone,
            primaryPhoneVerified: true,
            locale: profile.language,
            accountStatus: profile.status,
            registeredAt: profile.createdAt,
          },
        });

        return {
          id: created.id,
          phone,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          locale: profile.language,
          sourceProfileId: null,
        };
      }

      const created = await tx.masterIdentity.create({
        data: {
          primaryPhone: phone,
          primaryPhoneVerified: true,
          accountStatus: "active",
        },
      });

      return {
        id: created.id,
        phone,
        email: null,
        firstName: null,
        lastName: null,
        locale: null,
        sourceProfileId: null,
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.masterIdentity.findUnique({
        where: { primaryPhone: phone },
        include: { profile: true },
      });

      if (existing) {
        return {
          id: existing.id,
          phone: existing.primaryPhone,
          email: existing.primaryEmail ?? existing.profile?.email ?? null,
          firstName: existing.firstName ?? existing.profile?.firstName ?? null,
          lastName: existing.lastName ?? existing.profile?.lastName ?? null,
          locale: existing.locale ?? existing.profile?.language ?? null,
          sourceProfileId: null,
        };
      }
    }

    throw error;
  }
}
