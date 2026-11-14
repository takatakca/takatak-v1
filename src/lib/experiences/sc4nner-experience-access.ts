import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

const PRODUCT = "sc4nner";
const FREE_ACCESS = "sc4nner_free";
const LAUNCH_TTL_MS = 90_000;
// The workshop keeps the label studio open through the day; SC4NNER caps its
// own session at 12 h too, so a deactivated account loses access within 12 h.
const SESSION_TTL_MS = 12 * 60 * 60_000;

function codeHash(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
function constantTimeMatch(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function authorizeSc4nnerExchange(request: Request): boolean {
  const secret = process.env.TAKATAK_SC4NNER_SERVICE_TOKEN?.trim() || "";
  const auth = request.headers.get("authorization") || "";
  return secret.length >= 20 && auth.startsWith("Bearer ") && constantTimeMatch(auth.slice(7).trim(), secret);
}
function sc4nnerCallback(): URL {
  const configured = process.env.SC4NNER_EXPERIENCE_CALLBACK_URL || "";
  let url: URL;
  try { url = new URL(configured); } catch {
    throw new ServiceError("unavailable","SC4NNER experience callback not configured.");
  }
  if (url.username || url.password || url.hash || url.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && ["localhost","127.0.0.1"].includes(url.hostname))) {
    throw new ServiceError("unavailable","SC4NNER experience callback must use HTTPS.");
  }
  if (url.pathname !== "/auth/callback") {
    throw new ServiceError("unavailable","SC4NNER callback path is invalid.");
  }
  return url;
}
function requireState(state: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) {
    throw new ServiceError("forbidden","Invalid SC4NNER launch state.");
  }
}

export async function createSc4nnerExperienceLaunch(authUserId: string, state: string) {
  requireState(state);
  const callback = sc4nnerCallback();
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable","TAKATAK identity is unavailable.");
  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: { id: true, accountStatus: true },
  });
  if (!identity || identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden","SC4NNER is not available for this account.");
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

export async function exchangeSc4nnerExperienceLaunch(rawCode: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawCode)) {
    throw new ServiceError("forbidden","Invalid SC4NNER launch code.");
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
    throw new ServiceError("forbidden","SC4NNER launch code is expired or invalid.");
  }
  const consumed = await prisma.experienceLaunchCode.updateMany({
    where: { id: launch.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (consumed.count !== 1) throw new ServiceError("forbidden","SC4NNER launch code was already used.");

  // SC4NNER is free while it is in private testing: the only entitlement
  // issued is sc4nner_free. No label data is ever sent to or stored in V1;
  // this exchange returns the account context and nothing else.
  const name = [launch.identity.firstName,launch.identity.lastName].filter(Boolean).join(" ").trim();
  return {
    masterIdentityId: launch.identityId,
    displayName: name || "Atelier",
    productCode: PRODUCT,
    entitlements: [FREE_ACCESS],
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}
