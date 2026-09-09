import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/auth/registration-validation";
import { isEmailOtpConfigured, isPhoneOtpConfigured } from "./env";
import { generateOtp, hashOtp, otpMatches } from "./hash";
import { normalizePhone } from "./phone";
import { sendOtpToEmail } from "./send-email";
import { checkOtpFromPhone, sendOtpToPhone } from "./send-phone";
import { createSessionForEmail } from "./session";
import { scheduleUpmindCustomerLink } from "@/lib/web-hosting/upmind-session-customer";
import type { SessionCookieWrite } from "@/lib/auth/workspace-session-cookies";
import { createAuthErrorId } from "@/lib/auth/auth-error-id";
import { logAuthFailure, type AuthFailureCode } from "@/lib/auth/auth-json";
import {
  MAX_VERIFY_ATTEMPTS,
  OTP_RESERVATION_LEASE_MS,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  encodePendingOtp,
  isOtpReservationActive,
  parseStoredOtp,
  usableOtpHash,
} from "./reservation";

export type OtpActionResult = {
  ok: boolean;
  status: number;
  message: string;
  code?: AuthFailureCode;
  cookies?: SessionCookieWrite[];
};

type SessionCookieSnapshot = { name: string; value?: string };

type VerifyContext = {
  existingCookies?: SessionCookieSnapshot[];
  getPrisma?: typeof getPrisma;
  createSession?: typeof createSessionForEmail;
  scheduleUpmind?: typeof scheduleUpmindCustomerLink;
  checkPhone?: typeof checkOtpFromPhone;
  sendEmail?: typeof sendOtpToEmail;
};

function prismaUnavailable(): OtpActionResult {
  return {
    ok: false,
    status: 503,
    message: "The authentication database is not configured.",
    code: "database_unavailable",
  };
}

function disabledAccount(): OtpActionResult {
  return {
    ok: false,
    status: 403,
    message: "This account has been disabled.",
    code: "disabled_account",
  };
}

export async function sendEmailOtp(
  rawEmail: string,
  context: VerifyContext = {},
): Promise<OtpActionResult> {
  if (!isEmailOtpConfigured()) {
    return {
      ok: false,
      status: 503,
      message:
        "Email OTP is not configured. Add EMAIL_USER and EMAIL_PASSWORD (Gmail app password), or SendGrid later.",
      code: "configuration_unavailable",
    };
  }

  const prisma = (context.getPrisma ?? getPrisma)();
  if (!prisma) {
    return prismaUnavailable();
  }

  const email = normalizeEmail(rawEmail);
  const profile = await prisma.profile.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      status: true,
      lastOtpRequestedAt: true,
      otpHash: true,
      otpExpiresAt: true,
    },
  });

  if (!profile) {
    return {
      ok: false,
      status: 401,
      message: "Email address not found",
      code: "email_not_found",
    };
  }

  if (profile.status === "disabled") {
    return disabledAccount();
  }

  if (isOtpReservationActive(profile.otpHash)) {
    return {
      ok: false,
      status: 409,
      message: "Verification is already in progress. Please wait and try again.",
      code: "verification_in_progress",
    };
  }

  if (
    profile.lastOtpRequestedAt &&
    Date.now() - profile.lastOtpRequestedAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    return {
      ok: false,
      status: 429,
      message: "Please wait before requesting another code.",
    };
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const send = context.sendEmail ?? sendOtpToEmail;

  try {
    await send(profile.email, otp);
  } catch {
    return {
      ok: false,
      status: 500,
      message: "Failed to send OTP. Please try again later.",
      code: "verification_unavailable",
    };
  }

  await prisma.profile.updateMany({
    where: {
      id: profile.id,
      status: { not: "disabled" },
      OR: [{ otpHash: null }, { otpHash: profile.otpHash }],
    },
    data: {
      otpHash,
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      lastOtpRequestedAt: new Date(),
      otpAttemptCount: 0,
    },
  });

  return {
    ok: true,
    status: 200,
    message: "OTP sent to your email",
  };
}

export async function sendPhoneOtp(rawPhone: string): Promise<OtpActionResult> {
  if (!isPhoneOtpConfigured()) {
    return {
      ok: false,
      status: 503,
      message:
        "Phone OTP is not configured. Add Twilio Verify keys or sign in with email.",
      code: "configuration_unavailable",
    };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return prismaUnavailable();
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return {
      ok: false,
      status: 400,
      message: "Enter a valid phone number.",
      code: "invalid_request" as AuthFailureCode,
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { phone },
    select: {
      id: true,
      phone: true,
      status: true,
      lastOtpRequestedAt: true,
    },
  });

  if (!profile?.phone) {
    return {
      ok: false,
      status: 401,
      message: "Phone number not found",
      code: "phone_not_found",
    };
  }

  if (profile.status === "disabled") {
    return disabledAccount();
  }

  if (
    profile.lastOtpRequestedAt &&
    Date.now() - profile.lastOtpRequestedAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    return {
      ok: false,
      status: 429,
      message: "Please wait before requesting another code.",
    };
  }

  try {
    await sendOtpToPhone(profile.phone);
  } catch {
    return {
      ok: false,
      status: 500,
      message: "Failed to send OTP. Check phone number or try again later.",
      code: "verification_unavailable",
    };
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      lastOtpRequestedAt: new Date(),
      otpAttemptCount: 0,
      otpHash: null,
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  return {
    ok: true,
    status: 200,
    message: "OTP sent to your phone",
  };
}

async function releaseEmailReservation(
  profileId: string,
  reservedValue: string,
  originalHash: string,
  originalExpiresAt: Date | null,
  getPrismaFn: typeof getPrisma = getPrisma,
): Promise<void> {
  const prisma = getPrismaFn();
  if (!prisma) {
    return;
  }

  await prisma.profile.updateMany({
    where: {
      id: profileId,
      otpHash: reservedValue,
    },
    data: {
      otpHash: originalHash,
      otpExpiresAt: originalExpiresAt,
    },
  });
}

async function consumeReservedOtp(input: {
  profileId: string;
  reservedValue: string;
  disabled: boolean;
  getPrismaFn?: typeof getPrisma;
}): Promise<boolean> {
  const prisma = (input.getPrismaFn ?? getPrisma)();
  if (!prisma) {
    return false;
  }

  const consumed = await prisma.profile.updateMany({
    where: {
      id: input.profileId,
      otpHash: input.reservedValue,
      status: input.disabled ? "disabled" : { not: "disabled" },
    },
    data: {
      otpHash: null,
      otpExpiresAt: null,
      otpAttemptCount: 0,
      ...(input.disabled ? {} : { status: "active" }),
    },
  });

  return consumed.count === 1;
}

export async function verifyEmailOtp(
  rawEmail: string,
  otp: string,
  context: VerifyContext = {},
): Promise<OtpActionResult & { redirectTo?: string }> {
  const prisma = (context.getPrisma ?? getPrisma)();
  if (!prisma) {
    return prismaUnavailable();
  }

  if (!/^\d{6}$/.test(otp)) {
    return {
      ok: false,
      status: 400,
      message: "OTP is required",
      code: "invalid_request" as AuthFailureCode,
    };
  }

  const email = normalizeEmail(rawEmail);
  const profile = await prisma.profile.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      authUserId: true,
      otpHash: true,
      otpExpiresAt: true,
      otpAttemptCount: true,
      status: true,
    },
  });

  if (!profile) {
    return {
      ok: false,
      status: 400,
      message: "Email not found",
      code: "email_not_found",
    };
  }

  if (profile.status === "disabled") {
    return disabledAccount();
  }

  if (isOtpReservationActive(profile.otpHash)) {
    return {
      ok: false,
      status: 409,
      message: "Verification is already in progress. Please wait and try again.",
      code: "verification_in_progress",
    };
  }

  const currentHash = usableOtpHash(profile.otpHash);
  if (!currentHash) {
    return {
      ok: false,
      status: 400,
      message: "OTP not requested",
      code: "otp_not_requested",
    };
  }

  if (profile.otpAttemptCount >= MAX_VERIFY_ATTEMPTS) {
    return {
      ok: false,
      status: 400,
      message: "Too many attempts. Request a new code.",
      code: "too_many_attempts",
    };
  }

  if (!profile.otpExpiresAt || Date.now() > profile.otpExpiresAt.getTime()) {
    await prisma.profile.updateMany({
      where: {
        id: profile.id,
        otpHash: profile.otpHash,
      },
      data: {
        otpHash: null,
        otpExpiresAt: null,
      },
    });
    return {
      ok: false,
      status: 400,
      message: "OTP expired",
      code: "expired_otp",
    };
  }

  const matches = await otpMatches(otp, currentHash);
  if (!matches) {
    const incremented = await prisma.profile.updateMany({
      where: {
        id: profile.id,
        otpHash: profile.otpHash,
        otpAttemptCount: { lt: MAX_VERIFY_ATTEMPTS },
      },
      data: {
        otpAttemptCount: { increment: 1 },
      },
    });
    if (
      incremented.count === 1 &&
      profile.otpAttemptCount + 1 >= MAX_VERIFY_ATTEMPTS
    ) {
      return {
        ok: false,
        status: 400,
        message: "Too many attempts. Request a new code.",
        code: "too_many_attempts",
      };
    }
    return {
      ok: false,
      status: 400,
      message: "Invalid OTP recheck!",
      code: "invalid_otp",
    };
  }

  const reservedValue = encodePendingOtp(
    currentHash,
    Date.now() + OTP_RESERVATION_LEASE_MS,
  );
  const reserved = await prisma.profile.updateMany({
    where: {
      id: profile.id,
      otpHash: profile.otpHash,
      status: { not: "disabled" },
      otpAttemptCount: { lt: MAX_VERIFY_ATTEMPTS },
    },
    data: {
      otpHash: reservedValue,
    },
  });

  if (reserved.count !== 1) {
    return {
      ok: false,
      status: 409,
      message: "Verification is already in progress. Please wait and try again.",
      code: "verification_in_progress",
    };
  }

  let session: Awaited<ReturnType<typeof createSessionForEmail>>;
  const createSession = context.createSession ?? createSessionForEmail;
  const getPrismaFn = context.getPrisma ?? getPrisma;
  try {
    session = await createSession(
      profile.email,
      profile.authUserId,
      context.existingCookies ?? [],
    );
  } catch {
    await releaseEmailReservation(
      profile.id,
      reservedValue,
      currentHash,
      profile.otpExpiresAt,
      getPrismaFn,
    );
    return {
      ok: false,
      status: 503,
      message: "Unable to start a session. Please try again.",
      code: "session_unavailable",
    };
  }

  if (!session.ok) {
    await releaseEmailReservation(
      profile.id,
      reservedValue,
      currentHash,
      profile.otpExpiresAt,
      getPrismaFn,
    );
    return {
      ok: false,
      status: 503,
      message: session.message,
      code: "session_unavailable",
    };
  }

  // Consume only after a verified session exists. The pending.v1 value in
  // Profile.otpHash is the original scrypt hash, not an irreversible token.
  // A crash before consume expires after OTP_RESERVATION_LEASE_MS and the
  // original hash becomes usable again — the account is not permanently locked.
  const consumed = await consumeReservedOtp({
    profileId: profile.id,
    reservedValue,
    disabled: false,
    getPrismaFn,
  });

  if (!consumed) {
    logAuthFailure(
      "verify-otp",
      "consume_after_session",
      createAuthErrorId(),
      "session created but OTP consume missed",
    );
    return {
      ok: false,
      status: 409,
      message: "Verification is already in progress. Please wait and try again.",
      code: "verification_in_progress",
    };
  }

  try {
    (context.scheduleUpmind ?? scheduleUpmindCustomerLink)(profile.id);
  } catch {
    console.error("[otp] Upmind scheduling failed after successful session");
  }

  return {
    ok: true,
    status: 200,
    message: "User verified successfully",
    cookies: session.cookies,
  };
}

export async function verifyPhoneOtp(
  rawPhone: string,
  otp: string,
  context: VerifyContext = {},
): Promise<OtpActionResult> {
  if (!isPhoneOtpConfigured()) {
    return {
      ok: false,
      status: 503,
      message: "Phone OTP is not configured.",
      code: "configuration_unavailable",
    };
  }

  const prisma = (context.getPrisma ?? getPrisma)();
  if (!prisma) {
    return prismaUnavailable();
  }

  if (!otp) {
    return {
      ok: false,
      status: 400,
      message: "OTP is required",
      code: "invalid_request" as AuthFailureCode,
    };
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return {
      ok: false,
      status: 400,
      message: "Enter a valid phone number.",
      code: "invalid_request" as AuthFailureCode,
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { phone },
    select: {
      id: true,
      email: true,
      phone: true,
      authUserId: true,
      status: true,
      otpHash: true,
      otpExpiresAt: true,
      otpAttemptCount: true,
    },
  });

  if (!profile?.phone) {
    return {
      ok: false,
      status: 401,
      message: "Phone number not found",
      code: "phone_not_found",
    };
  }

  if (profile.status === "disabled") {
    return disabledAccount();
  }

  if (isOtpReservationActive(profile.otpHash)) {
    return {
      ok: false,
      status: 409,
      message: "Verification is already in progress. Please wait and try again.",
      code: "verification_in_progress",
    };
  }

  if (profile.otpAttemptCount >= MAX_VERIFY_ATTEMPTS) {
    return {
      ok: false,
      status: 400,
      message: "Too many attempts. Request a new code.",
      code: "too_many_attempts",
    };
  }

  if (profile.otpExpiresAt && Date.now() > profile.otpExpiresAt.getTime()) {
    await prisma.profile.updateMany({
      where: { id: profile.id },
      data: {
        otpHash: null,
        otpExpiresAt: null,
      },
    });
    return {
      ok: false,
      status: 400,
      message: "OTP expired",
      code: "expired_otp",
    };
  }

  const pendingMarker = encodePendingOtp(
    `phone:${profile.id}`,
    Date.now() + OTP_RESERVATION_LEASE_MS,
  );
  const reserved = await prisma.profile.updateMany({
    where: {
      id: profile.id,
      status: { not: "disabled" },
      otpAttemptCount: { lt: MAX_VERIFY_ATTEMPTS },
      OR: [{ otpHash: null }, { otpHash: profile.otpHash }],
    },
    data: {
      otpHash: pendingMarker,
    },
  });

  if (reserved.count !== 1) {
    return {
      ok: false,
      status: 409,
      message: "Verification is already in progress. Please wait and try again.",
      code: "verification_in_progress",
    };
  }

  let valid = false;
  try {
    valid = await (context.checkPhone ?? checkOtpFromPhone)(profile.phone, otp);
  } catch {
    await prisma.profile.updateMany({
      where: { id: profile.id, otpHash: pendingMarker },
      data: { otpHash: null },
    });
    return {
      ok: false,
      status: 503,
      message: "The verification service is temporarily unavailable.",
      code: "verification_unavailable",
    };
  }

  if (!valid) {
    await prisma.profile.updateMany({
      where: { id: profile.id, otpHash: pendingMarker },
      data: {
        otpHash: null,
        otpAttemptCount: { increment: 1 },
      },
    });
    return {
      ok: false,
      status: 400,
      message: "Invalid or expired code",
      code: "invalid_otp",
    };
  }

  let session: Awaited<ReturnType<typeof createSessionForEmail>>;
  const createSession = context.createSession ?? createSessionForEmail;
  try {
    session = await createSession(
      profile.email,
      profile.authUserId,
      context.existingCookies ?? [],
    );
  } catch {
    await prisma.profile.updateMany({
      where: { id: profile.id, otpHash: pendingMarker },
      data: { otpHash: null },
    });
    return {
      ok: false,
      status: 503,
      message: "Unable to start a session. Please try again.",
      code: "session_unavailable",
    };
  }

  if (!session.ok) {
    await prisma.profile.updateMany({
      where: { id: profile.id, otpHash: pendingMarker },
      data: { otpHash: null },
    });
    return {
      ok: false,
      status: 503,
      message: session.message,
      code: "session_unavailable",
    };
  }

  const consumed = await consumeReservedOtp({
    profileId: profile.id,
    reservedValue: pendingMarker,
    disabled: false,
    getPrismaFn: context.getPrisma ?? getPrisma,
  });

  if (!consumed) {
    return {
      ok: false,
      status: 409,
      message: "Verification is already in progress. Please wait and try again.",
      code: "verification_in_progress",
    };
  }

  try {
    (context.scheduleUpmind ?? scheduleUpmindCustomerLink)(profile.id);
  } catch {
    console.error("[otp] Upmind scheduling failed after successful session");
  }

  return {
    ok: true,
    status: 200,
    message: "User verified successfully",
    cookies: session.cookies,
  };
}

export async function issueRegistrationEmailOtp(
  profileId: string,
  email: string,
): Promise<OtpActionResult> {
  if (!isEmailOtpConfigured()) {
    return {
      ok: false,
      status: 503,
      message:
        "Email OTP is not configured. Add EMAIL_USER and EMAIL_PASSWORD (Gmail app password), or SendGrid later.",
      code: "configuration_unavailable",
    };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return prismaUnavailable();
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      otpHash,
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      lastOtpRequestedAt: new Date(),
      otpAttemptCount: 0,
    },
  });

  try {
    await sendOtpToEmail(email, otp);
  } catch {
    return {
      ok: false,
      status: 500,
      message: "Failed to send OTP. Please try again later.",
      code: "verification_unavailable",
    };
  }

  return {
    ok: true,
    status: 201,
    message: "New user registered. OTP sent.",
  };
}

export function getUsableOtpHashForTests(
  stored: string | null | undefined,
  now?: number,
): string | null {
  return usableOtpHash(stored, now);
}

export function parseStoredOtpForTests(
  stored: string | null | undefined,
  now?: number,
) {
  return parseStoredOtp(stored, now);
}
