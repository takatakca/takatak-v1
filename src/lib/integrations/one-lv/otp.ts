import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { isPhoneOtpConfigured } from "@/lib/auth/otp/env";
import { normalizePhone } from "@/lib/auth/otp/phone";
import {
  checkOtpFromPhone,
  sendOtpToPhone,
} from "@/lib/auth/otp/send-phone";

export class OneLvOtpConflictError extends Error {
  constructor() {
    super("Verified phone is linked to conflicting master identities.");
    this.name = "OneLvOtpConflictError";
  }
}

export type OneLvVerifiedIdentity = {
  id: string;
  phone: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  locale: string | null;
};

export async function sendOneLvPhoneOtp(rawPhone: string) {
  if (!isPhoneOtpConfigured()) {
    return {
      ok: false as const,
      status: 503,
      error: "Phone OTP is not configured in GROUPE TAKATAK.",
    };
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return {
      ok: false as const,
      status: 400,
      error: "Enter a valid phone number.",
    };
  }

  try {
    await sendOtpToPhone(phone);
    return {
      ok: true as const,
      status: 200,
      phone,
    };
  } catch {
    return {
      ok: false as const,
      status: 503,
      error: "Verification service is temporarily unavailable.",
    };
  }
}

export async function verifyOneLvPhoneOtp(
  rawPhone: string,
  code: string,
): Promise<
  | { ok: true; status: 200; identity: OneLvVerifiedIdentity }
  | { ok: false; status: 400 | 503; error: string }
> {
  if (!isPhoneOtpConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "Phone OTP is not configured in GROUPE TAKATAK.",
    };
  }

  const phone = normalizePhone(rawPhone);
  if (!phone || !/^\d{6}$/.test(code)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid phone or verification code.",
    };
  }

  let valid = false;
  try {
    valid = await checkOtpFromPhone(phone, code);
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Verification service is temporarily unavailable.",
    };
  }

  if (!valid) {
    return {
      ok: false,
      status: 400,
      error: "Invalid or expired verification code.",
    };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return {
      ok: false,
      status: 503,
      error: "Identity database is temporarily unavailable.",
    };
  }

  const identity = await prisma.$transaction(async (transaction) => {
    const [profile, byPhone] = await Promise.all([
      transaction.profile.findUnique({
        where: { phone },
        include: { masterIdentity: true },
      }),
      transaction.masterIdentity.findUnique({
        where: { primaryPhone: phone },
      }),
    ]);

    if (
      profile?.masterIdentity &&
      byPhone &&
      profile.masterIdentity.id !== byPhone.id
    ) {
      throw new OneLvOtpConflictError();
    }

    if (profile?.masterIdentity) {
      return transaction.masterIdentity.update({
        where: { id: profile.masterIdentity.id },
        data: {
          primaryPhone: phone,
          primaryPhoneVerified: true,
          accountStatus: "active",
        },
      });
    }

    if (byPhone) {
      if (profile && byPhone.profileId && byPhone.profileId !== profile.id) {
        throw new OneLvOtpConflictError();
      }

      return transaction.masterIdentity.update({
        where: { id: byPhone.id },
        data: {
          primaryPhoneVerified: true,
          accountStatus: "active",
          ...(profile && !byPhone.profileId ? { profileId: profile.id } : {}),
        },
      });
    }

    return transaction.masterIdentity.create({
      data: {
        profileId: profile?.id,
        primaryPhone: phone,
        primaryPhoneVerified: true,
        accountStatus: "active",
        firstName: profile?.firstName ?? null,
        lastName: profile?.lastName ?? null,
        locale: profile?.language ?? null,
        registeredAt: profile?.createdAt,
      },
    });
  });

  return {
    ok: true,
    status: 200,
    identity: {
      id: identity.id,
      phone,
      email:
        identity.primaryEmailVerified && identity.primaryEmail
          ? identity.primaryEmail
          : null,
      first_name: identity.firstName,
      last_name: identity.lastName,
      locale: identity.locale,
    },
  };
}
