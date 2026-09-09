import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/auth/registration-validation";
import { isEmailOtpConfigured, isPhoneOtpConfigured } from "./env";
import { generateOtp, hashOtp, otpMatches } from "./hash";
import { normalizePhone } from "./phone";
import { sendOtpToEmail } from "./send-email";
import { checkOtpFromPhone, sendOtpToPhone } from "./send-phone";
import { createSessionForEmail } from "./session";
import { linkUpmindCustomerForProfile } from "@/lib/web-hosting/upmind-session-customer";
import type { SessionCookieWrite } from "@/lib/auth/workspace-session-cookies";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

export type OtpActionResult = {
  ok: boolean;
  status: number;
  message: string;
  cookies?: SessionCookieWrite[];
};

function prismaUnavailable(): OtpActionResult {
  return {
    ok: false,
    status: 503,
    message: "The authentication database is not configured.",
  };
}

export async function sendEmailOtp(rawEmail: string): Promise<OtpActionResult> {
  if (!isEmailOtpConfigured()) {
    return {
      ok: false,
      status: 503,
      message:
        "Email OTP is not configured. Add EMAIL_USER and EMAIL_PASSWORD (Gmail app password), or SendGrid later.",
    };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return prismaUnavailable();
  }

  const email = normalizeEmail(rawEmail);
  const profile = await prisma.profile.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      lastOtpRequestedAt: true,
    },
  });

  if (!profile) {
    return {
      ok: false,
      status: 401,
      message: "Email address not found",
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

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      otpHash,
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      lastOtpRequestedAt: new Date(),
      otpAttemptCount: 0,
    },
  });

  try {
    await sendOtpToEmail(profile.email, otp);
  } catch {
    return {
      ok: false,
      status: 500,
      message: "Failed to send OTP. Please try again later.",
    };
  }

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
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { phone },
    select: {
      id: true,
      phone: true,
      lastOtpRequestedAt: true,
    },
  });

  if (!profile?.phone) {
    return {
      ok: false,
      status: 401,
      message: "Phone number not found",
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

  try {
    await sendOtpToPhone(profile.phone);
  } catch {
    return {
      ok: false,
      status: 500,
      message: "Failed to send OTP. Check phone number or try again later.",
    };
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      lastOtpRequestedAt: new Date(),
      otpAttemptCount: 0,
      otpHash: null,
      otpExpiresAt: null,
    },
  });

  return {
    ok: true,
    status: 200,
    message: "OTP sent to your phone",
  };
}

export async function verifyEmailOtp(
  rawEmail: string,
  otp: string,
): Promise<OtpActionResult & { redirectTo?: string }> {
  const prisma = getPrisma();
  if (!prisma) {
    return prismaUnavailable();
  }

  if (!/^\d{6}$/.test(otp)) {
    return {
      ok: false,
      status: 400,
      message: "OTP is required",
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
    };
  }

  if (!profile.otpHash) {
    return {
      ok: false,
      status: 400,
      message: "OTP not requested",
    };
  }

  if (profile.otpAttemptCount >= MAX_VERIFY_ATTEMPTS) {
    return {
      ok: false,
      status: 400,
      message: "Too many attempts. Request a new code.",
    };
  }

  if (!profile.otpExpiresAt || Date.now() > profile.otpExpiresAt.getTime()) {
    await prisma.profile.update({
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
    };
  }

  const matches = await otpMatches(otp, profile.otpHash);
  if (!matches) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        otpAttemptCount: { increment: 1 },
      },
    });
    return {
      ok: false,
      status: 400,
      message: "Invalid OTP recheck!",
    };
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      otpHash: null,
      otpExpiresAt: null,
      otpAttemptCount: 0,
      status: profile.status === "disabled" ? "disabled" : "active",
    },
  });

  const session = await createSessionForEmail(
    profile.email,
    profile.authUserId,
  );
  if (!session.ok) {
    return {
      ok: false,
      status: 503,
      message: session.message,
    };
  }

  await linkUpmindCustomerForProfile(profile.id);

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
): Promise<OtpActionResult> {
  if (!isPhoneOtpConfigured()) {
    return {
      ok: false,
      status: 503,
      message: "Phone OTP is not configured.",
    };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return prismaUnavailable();
  }

  if (!otp) {
    return {
      ok: false,
      status: 400,
      message: "OTP is required",
    };
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return {
      ok: false,
      status: 400,
      message: "Enter a valid phone number.",
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
      otpAttemptCount: true,
    },
  });

  if (!profile?.phone) {
    return {
      ok: false,
      status: 401,
      message: "Phone number not found",
    };
  }

  if (profile.otpAttemptCount >= MAX_VERIFY_ATTEMPTS) {
    return {
      ok: false,
      status: 400,
      message: "Too many attempts. Request a new code.",
    };
  }

  const valid = await checkOtpFromPhone(profile.phone, otp);
  if (!valid) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        otpAttemptCount: { increment: 1 },
      },
    });
    return {
      ok: false,
      status: 400,
      message: "Invalid or expired code",
    };
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      otpHash: null,
      otpExpiresAt: null,
      otpAttemptCount: 0,
      status: profile.status === "disabled" ? "disabled" : "active",
    },
  });

  const session = await createSessionForEmail(
    profile.email,
    profile.authUserId,
  );
  if (!session.ok) {
    return {
      ok: false,
      status: 503,
      message: session.message,
    };
  }

  await linkUpmindCustomerForProfile(profile.id);

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
    };
  }

  return {
    ok: true,
    status: 201,
    message: "New user registered. OTP sent.",
  };
}

