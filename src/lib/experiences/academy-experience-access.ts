import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

const PRODUCT = "academy";
const FREE_ACCESS = "academy_free";
const LAUNCH_TTL_MS = 90_000;
const SESSION_TTL_MS = 10 * 60_000;

function codeHash(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
function constantTimeMatch(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function authorizeAcademyExchange(request: Request): boolean {
  const secret = process.env.TAKATAK_ACADEMY_SERVICE_TOKEN?.trim() || "";
  const auth = request.headers.get("authorization") || "";
  return secret.length >= 20 && auth.startsWith("Bearer ") && constantTimeMatch(auth.slice(7).trim(), secret);
}
function academyCallback(): URL {
  const configured = process.env.ACADEMY_EXPERIENCE_CALLBACK_URL || "";
  let url: URL;
  try { url = new URL(configured); } catch {
    throw new ServiceError("unavailable","Academy experience callback not configured.");
  }
  if (url.username || url.password || url.hash || url.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && ["localhost","127.0.0.1"].includes(url.hostname))) {
    throw new ServiceError("unavailable","Academy experience callback must use HTTPS.");
  }
  if (url.pathname !== "/auth/callback") {
    throw new ServiceError("unavailable","Academy callback path is invalid.");
  }
  return url;
}
function requireState(state: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) {
    throw new ServiceError("forbidden","Invalid Academy launch state.");
  }
}

export async function createAcademyExperienceLaunch(authUserId: string, state: string) {
  requireState(state);
  const callback = academyCallback();
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable","TAKATAK identity is unavailable.");
  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: { id: true, accountStatus: true },
  });
  if (!identity || identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden","Academy is not available for this account.");
  }
  const rawCode = randomBytes(32).toString("base64url");
  await prisma.experienceLaunchCode.create({
    data: {
      codeHash: codeHash(rawCode),
      identityId: identity.id,
      productCode: PRODUCT,
      entitlementCode: FREE_ACCESS,
      expiresAt: new Date(Date.now() + LAUNCH_TTL_MS),
    },
  });
  callback.searchParams.set("code", rawCode);
  callback.searchParams.set("state", state);
  return callback.toString();
}

export async function exchangeAcademyExperienceLaunch(rawCode: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawCode)) {
    throw new ServiceError("forbidden","Invalid Academy launch code.");
  }
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable","TAKATAK identity is unavailable.");
  const now = new Date();
  const launch = await prisma.experienceLaunchCode.findUnique({
    where: { codeHash: codeHash(rawCode) },
    select: {
      id: true,
      identityId: true,
      productCode: true,
      entitlementCode: true,
      expiresAt: true,
      usedAt: true,
      identity: { select: { firstName: true, lastName: true, accountStatus: true } },
    },
  });
  if (!launch || launch.usedAt || launch.expiresAt <= now ||
    launch.productCode !== PRODUCT || launch.entitlementCode !== FREE_ACCESS ||
    launch.identity.accountStatus && launch.identity.accountStatus !== "active") {
    throw new ServiceError("forbidden","Academy launch code is expired or invalid.");
  }
  const consumed = await prisma.experienceLaunchCode.updateMany({
    where: { id: launch.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (consumed.count !== 1) throw new ServiceError("forbidden","Academy launch code was already used.");

  // Until approved Academy subscriptions and purchases are stored centrally,
  // the only entitlement issued is the free learner entitlement. Paid lessons
  // must remain locked. Never trust incoming client-provided access claims.
  const name = [launch.identity.firstName,launch.identity.lastName].filter(Boolean).join(" ").trim();
  return {
    masterIdentityId: launch.identityId,
    displayName: name || "Learner",
    productCode: PRODUCT,
    entitlements: [FREE_ACCESS],
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}
