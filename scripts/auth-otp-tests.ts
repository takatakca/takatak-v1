import { hashOtp } from "../src/lib/auth/otp/hash";
import {
  encodePendingOtp,
  isOtpReservationActive,
  OTP_HASH_TEXT_BUDGET_CHARS,
  parseStoredOtp,
  usableOtpHash,
} from "../src/lib/auth/otp/reservation";
import { sendEmailOtp, verifyEmailOtp } from "../src/lib/auth/otp/service";
import { unexpectedAuthFailure, wrapAuthRoute } from "../src/lib/auth/auth-json";
import { NextRequest } from "next/server";

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

type ProfileRow = {
  id: string;
  email: string;
  phone: string | null;
  authUserId: string;
  status: "active" | "invited" | "disabled";
  otpHash: string | null;
  otpExpiresAt: Date | null;
  lastOtpRequestedAt: Date | null;
  otpAttemptCount: number;
};

function matchesWhere(row: ProfileRow, where: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(where)) {
    if (key === "OR" && Array.isArray(value)) {
      const any = value.some((part) =>
        matchesWhere(row, part as Record<string, unknown>),
      );
      if (!any) return false;
      continue;
    }
    if (key === "AND" && Array.isArray(value)) {
      if (!value.every((part) => matchesWhere(row, part as Record<string, unknown>))) {
        return false;
      }
      continue;
    }
    const current = (row as Record<string, unknown>)[key];
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      const filter = value as Record<string, unknown>;
      if ("not" in filter && current === filter.not) return false;
      if ("lt" in filter && !(typeof current === "number" && current < Number(filter.lt))) {
        return false;
      }
      continue;
    }
    if (current !== value) return false;
  }
  return true;
}

function createFakePrisma(initial: ProfileRow) {
  const row: ProfileRow = { ...initial };
  return {
    profile: {
      findUnique: async ({ where }: { where: { email?: string; phone?: string; id?: string } }) => {
        if (where.email && row.email !== where.email) return null;
        if (where.phone && row.phone !== where.phone) return null;
        if (where.id && row.id !== where.id) return null;
        return { ...row };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ProfileRow>;
      }) => {
        if (row.id !== where.id) throw new Error("not found");
        Object.assign(row, data);
        return { ...row };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (!matchesWhere(row, where)) {
          return { count: 0 };
        }
        for (const [key, value] of Object.entries(data)) {
          if (
            value &&
            typeof value === "object" &&
            "increment" in (value as object)
          ) {
            (row as Record<string, unknown>)[key] =
              Number((row as Record<string, unknown>)[key] ?? 0) +
              Number((value as { increment: number }).increment);
          } else {
            (row as Record<string, unknown>)[key] = value;
          }
        }
        return { count: 1 };
      },
    },
    row,
  };
}

async function main() {
  console.log("[auth-otp] reservation + verify integrity");

  const hash = await hashOtp("123456");
  const pending = encodePendingOtp(hash, Date.now() + 30_000, "abc");
  assert("usable hash is original", usableOtpHash(hash) === hash);
  assert("pending is not usable", usableOtpHash(pending) === null);
  assert("pending is active", isOtpReservationActive(pending) === true);
  const expired = encodePendingOtp(hash, Date.now() - 1_000, "abc");
  assert("expired pending becomes hash", usableOtpHash(expired) === hash);
  assert(
    "parse pending keeps nonce",
    parseStoredOtp(pending)?.kind === "pending",
  );

  const baseProfile: ProfileRow = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "otp-diagnostic-do-not-use@takatak.ca",
    phone: null,
    authUserId: "22222222-2222-4222-8222-222222222222",
    status: "invited",
    otpHash: hash,
    otpExpiresAt: new Date(Date.now() + 60_000),
    lastOtpRequestedAt: new Date(),
    otpAttemptCount: 0,
  };

  {
    const db = createFakePrisma(baseProfile);
    const result = await verifyEmailOtp("otp-diagnostic-do-not-use@takatak.ca", "", {
      getPrisma: () => db as never,
    });
    assert("missing OTP is JSON 400", result.ok === false && result.status === 400);
  }

  {
    const db = createFakePrisma({
      ...baseProfile,
      email: "someone-else@takatak.ca",
    });
    const result = await verifyEmailOtp("missing@takatak.ca", "000000", {
      getPrisma: () => db as never,
    });
    assert(
      "unknown email returns Email not found",
      result.message === "Email not found" && result.status === 400,
    );
  }

  {
    const db = createFakePrisma({ ...baseProfile });
    const result = await verifyEmailOtp(baseProfile.email, "000000", {
      getPrisma: () => db as never,
    });
    assert("invalid OTP increments attempts", db.row.otpAttemptCount === 1);
    assert("invalid OTP keeps hash", db.row.otpHash === hash);
    assert("invalid OTP code", result.code === "invalid_otp");
  }

  {
    const db = createFakePrisma({
      ...baseProfile,
      otpExpiresAt: new Date(Date.now() - 1_000),
    });
    const result = await verifyEmailOtp(baseProfile.email, "123456", {
      getPrisma: () => db as never,
    });
    assert("expired OTP rejected", result.code === "expired_otp");
    assert("expired OTP cleared", db.row.otpHash === null);
  }

  {
    const db = createFakePrisma({
      ...baseProfile,
      otpAttemptCount: 5,
    });
    const result = await verifyEmailOtp(baseProfile.email, "123456", {
      getPrisma: () => db as never,
    });
    assert("excess attempts rejected", result.code === "too_many_attempts");
    assert("excess attempts keep hash", db.row.otpHash === hash);
  }

  {
    const db = createFakePrisma({
      ...baseProfile,
      status: "disabled",
    });
    const result = await verifyEmailOtp(baseProfile.email, "123456", {
      getPrisma: () => db as never,
    });
    assert("disabled account cannot authenticate", result.code === "disabled_account");
    assert("disabled stays disabled", db.row.status === "disabled");
    assert("disabled does not consume OTP", db.row.otpHash === hash);
  }

  {
    const db = createFakePrisma({ ...baseProfile });
    const result = await verifyEmailOtp(baseProfile.email, "123456", {
      getPrisma: () => db as never,
      createSession: async () => ({
        ok: false,
        message: "Unable to start a session. Please try again.",
        stage: "verify_magiclink",
        errorId: "test",
      }),
    });
    assert("session failure does not consume OTP", db.row.otpHash === hash);
    assert("session failure restores the exact hash", db.row.otpHash === hash);
    assert("session failure is retryable", result.code === "session_unavailable");
  }

  {
    const db = createFakePrisma({ ...baseProfile });
    const result = await verifyEmailOtp(baseProfile.email, "123456", {
      getPrisma: () => db as never,
      createSession: async () => ({
        ok: true,
        cookies: [{ name: "sb-auth-token", value: "chunk" }],
      }),
      scheduleUpmind: () => {
        throw new Error("upmind must not fail login");
      },
    });
    assert("successful session consumes OTP", result.ok && db.row.otpHash === null);
    assert("successful session activates profile", db.row.status === "active");
    assert("successful session resets attempts", db.row.otpAttemptCount === 0);
  }

  {
    const db = createFakePrisma({ ...baseProfile });
    let sessions = 0;
    const first = verifyEmailOtp(baseProfile.email, "123456", {
      getPrisma: () => db as never,
      createSession: async () => {
        sessions += 1;
        return { ok: true, cookies: [{ name: "sb-auth-token", value: "a" }] };
      },
      scheduleUpmind: () => undefined,
    });
    const second = verifyEmailOtp(baseProfile.email, "123456", {
      getPrisma: () => db as never,
      createSession: async () => {
        sessions += 1;
        return { ok: true, cookies: [{ name: "sb-auth-token", value: "b" }] };
      },
      scheduleUpmind: () => undefined,
    });
    const results = await Promise.all([first, second]);
    const successes = results.filter((item) => item.ok).length;
    assert("concurrent verify creates one successful session", successes === 1);
    assert("concurrent verify does not create two sessions", sessions === 1);
  }

  {
    const original = await hashOtp("123456");
    const pending = encodePendingOtp(original, Date.now() + 60_000, "lease");
    assert("reservation keeps reversible original hash", parseStoredOtp(pending)?.hash === original);
    assert("reservation is not an irreversible overwrite", original.includes(":") && pending.startsWith("pending.v1:"));
    const expired = encodePendingOtp(original, Date.now() - 5, "lease");
    assert("expired reservation is usable again", usableOtpHash(expired) === original);
    assert("expired reservation is not a permanent lock", isOtpReservationActive(expired) === false);
    assert(
      "otpHash TEXT budget holds a complete pending.v1 value",
      pending.length < OTP_HASH_TEXT_BUDGET_CHARS &&
        pending.length > original.length,
    );
    assert(
      "malformed reservation strings fail closed",
      parseStoredOtp("pending.v1:") === null &&
        parseStoredOtp("pending.v1:abc") === null &&
        parseStoredOtp("pending.v1:123.") === null &&
        usableOtpHash("pending.v1:not-a-lease.nonce") === null,
    );
    assert(
      "parser does not treat a normal OTP hash as a reservation",
      parseStoredOtp(original)?.kind === "hash" &&
        !original.startsWith("pending.v1:"),
    );
  }

  {
    const db = createFakePrisma({ ...baseProfile });
    const expiresAt = db.row.otpExpiresAt?.getTime();
    await verifyEmailOtp(baseProfile.email, "123456", {
      getPrisma: () => db as never,
      createSession: async () => ({
        ok: false,
        message: "Unable to start a session. Please try again.",
        stage: "verify_magiclink",
        errorId: "test",
      }),
    });
    assert("reserve/release keeps original expiration", db.row.otpExpiresAt?.getTime() === expiresAt);
  }

  {
    const reserved = encodePendingOtp(hash, Date.now() + 60_000, "live");
    const db = createFakePrisma({
      ...baseProfile,
      otpHash: reserved,
    });
    const previous = process.env.EMAIL_USER;
    const previousPassword = process.env.EMAIL_PASSWORD;
    process.env.EMAIL_USER = "otp-diagnostic-do-not-use@takatak.ca";
    process.env.EMAIL_PASSWORD = "test-app-password";
    const result = await sendEmailOtp(baseProfile.email, {
      getPrisma: () => db as never,
      sendEmail: async () => {
        throw new Error("must not send during reservation");
      },
    });
    process.env.EMAIL_USER = previous;
    process.env.EMAIL_PASSWORD = previousPassword;
    assert("resend during active reservation is blocked", result.code === "verification_in_progress");
    assert("resend during reservation cannot restore an obsolete OTP", db.row.otpHash === reserved);
  }

  {
    const expiredPending = encodePendingOtp(hash, Date.now() - 5, "expired");
    const db = createFakePrisma({
      ...baseProfile,
      otpHash: expiredPending,
    });
    let sessions = 0;
    const first = verifyEmailOtp(baseProfile.email, "123456", {
      getPrisma: () => db as never,
      createSession: async () => {
        sessions += 1;
        return { ok: true, cookies: [{ name: "sb-auth-token", value: "a" }] };
      },
      scheduleUpmind: () => undefined,
    });
    const second = verifyEmailOtp(baseProfile.email, "123456", {
      getPrisma: () => db as never,
      createSession: async () => {
        sessions += 1;
        return { ok: true, cookies: [{ name: "sb-auth-token", value: "b" }] };
      },
      scheduleUpmind: () => undefined,
    });
    const results = await Promise.all([first, second]);
    const successes = results.filter((item) => item.ok).length;
    assert("expired 45s lease still allows only one successful finalization", successes === 1);
    assert("expired 45s lease cannot finalize two sessions", sessions === 1);
  }

  {
    const db = createFakePrisma({ ...baseProfile });
    const expiresAt = db.row.otpExpiresAt?.getTime();
    const result = await verifyEmailOtp(baseProfile.email, "123456", {
      getPrisma: () => db as never,
      createSession: async () => {
        db.row.otpHash = encodePendingOtp(hash, Date.now() + 60_000, "stolen");
        return { ok: true, cookies: [{ name: "sb-auth-token", value: "should-not-return" }] };
      },
      scheduleUpmind: () => undefined,
    });
    assert("session then failed consume does not return cookies", result.ok === false && !result.cookies);
    assert("session then failed consume does not extend OTP expiry", db.row.otpExpiresAt?.getTime() === expiresAt);
  }

  {
    const db = createFakePrisma({
      ...baseProfile,
      lastOtpRequestedAt: new Date(Date.now() - 60_000),
    });
    const previousHash = db.row.otpHash;
    const expiresAt = db.row.otpExpiresAt?.getTime();
    const previous = process.env.EMAIL_USER;
    const previousPassword = process.env.EMAIL_PASSWORD;
    process.env.EMAIL_USER = "otp-diagnostic-do-not-use@takatak.ca";
    process.env.EMAIL_PASSWORD = "test-app-password";
    const result = await sendEmailOtp(baseProfile.email, {
      getPrisma: () => db as never,
      sendEmail: async () => {
        throw new Error("smtp down");
      },
    });
    process.env.EMAIL_USER = previous;
    process.env.EMAIL_PASSWORD = previousPassword;
    assert("infrastructure send failure does not rotate OTP", result.code === "verification_unavailable");
    assert("infrastructure send failure does not extend OTP validity", db.row.otpHash === previousHash);
    assert("infrastructure send failure keeps original expiry", db.row.otpExpiresAt?.getTime() === expiresAt);
  }

  {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/lib/auth/otp/reservation.ts", import.meta.url), "utf8"),
    );
    assert(
      "reservation helper does not log OTP or hashes",
      !source.includes("console."),
    );
  }

  {
    const previous = await hashOtp("111111");
    const db = createFakePrisma({
      ...baseProfile,
      otpHash: previous,
    });
    const nextHash = await hashOtp("654321");
    db.row.otpHash = nextHash;
    const oldCode = await verifyEmailOtp(baseProfile.email, "111111", {
      getPrisma: () => db as never,
    });
    assert("resent OTP invalidates previous code", oldCode.code === "invalid_otp");
  }

  {
    const response = unexpectedAuthFailure(
      "verify-otp",
      "The verification service is temporarily unavailable.",
      new Error("boom"),
    );
    const body = await response.json();
    assert("unexpected exception is JSON", response.headers.get("content-type")?.includes("application/json") === true);
    assert("unexpected exception schema", body.ok === false && typeof body.errorId === "string");
    assert("unexpected exception hides internals", body.message.includes("temporarily unavailable"));
  }

  {
    const handler = wrapAuthRoute("login", "The verification service is temporarily unavailable.", async () => {
      throw new Error("secret token=super-secret");
    });
    const response = await handler(
      new NextRequest("https://takatak.ca/api/auth/login", { method: "POST" }),
    );
    const body = await response.json();
    assert("wrapped route returns JSON 500", response.status === 500 && body.ok === false);
    assert("wrapped route includes errorId", typeof body.errorId === "string");
  }

  if (failed > 0) {
    process.exit(1);
  }
}

void main();
