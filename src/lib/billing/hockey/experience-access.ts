import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { getHockeyMembershipSnapshot } from "./membership-service";
import {
  AHMV_ACCESS_ENTITLEMENT,
  AHMV_PRODUCT_CODE,
} from "./product-catalog-service";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

const LAUNCH_TTL_MS = 90_000;
const EXPERIENCE_SESSION_TTL_MS = 10 * 60_000;

function hashLaunchCode(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeSecretEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function authorizeAhmvExperienceService(request: Request): boolean {
  const expected = process.env.TAKATAK_AHMV_SERVICE_TOKEN?.trim() ?? "";
  if (!expected) return false;

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  return safeSecretEqual(authorization.slice(7).trim(), expected);
}

function ahmvCallbackUrl(): URL {
  const raw = process.env.AHMV_EXPERIENCE_CALLBACK_URL?.trim() ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ServiceError(
      "unavailable",
      "AHMV experience callback is not configured.",
    );
  }

  if (url.protocol !== "https:") {
    throw new ServiceError(
      "unavailable",
      "AHMV experience callback must use HTTPS.",
    );
  }
  return url;
}

export async function createAhmvExperienceLaunch(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "AHMV access is temporarily unavailable.");
  }

  const membership = await getHockeyMembershipSnapshot(authUserId);
  if (!membership.hasAhmvAccess || !membership.identityId) {
    throw new ServiceError("forbidden", "AHMV access is not active for this identity.");
  }

  const rawCode = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LAUNCH_TTL_MS);

  await prisma.experienceLaunchCode.create({
    data: {
      codeHash: hashLaunchCode(rawCode),
      identityId: membership.identityId,
      productCode: AHMV_PRODUCT_CODE,
      entitlementCode: AHMV_ACCESS_ENTITLEMENT,
      expiresAt,
    },
  });

  const callback = ahmvCallbackUrl();
  callback.searchParams.set("code", rawCode);

  return { url: callback.toString(), expiresAt };
}

export async function exchangeAhmvExperienceLaunch(rawCode: string) {
  const code = rawCode.trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(code)) {
    throw new ServiceError("forbidden", "Invalid AHMV launch code.");
  }

  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "AHMV access is temporarily unavailable.");
  }

  const now = new Date();
  const codeHash = hashLaunchCode(code);
  const launch = await prisma.experienceLaunchCode.findUnique({
    where: { codeHash },
    select: {
      id: true,
      identityId: true,
      productCode: true,
      entitlementCode: true,
      expiresAt: true,
      usedAt: true,
      identity: {
        select: {
          authUserId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (
    !launch ||
    launch.usedAt ||
    launch.expiresAt <= now ||
    launch.productCode !== AHMV_PRODUCT_CODE ||
    launch.entitlementCode !== AHMV_ACCESS_ENTITLEMENT ||
    !launch.identity.authUserId
  ) {
    throw new ServiceError("forbidden", "AHMV launch code is expired or invalid.");
  }

  const consumed = await prisma.experienceLaunchCode.updateMany({
    where: {
      id: launch.id,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });
  if (consumed.count !== 1) {
    throw new ServiceError("forbidden", "AHMV launch code was already used.");
  }

  // Re-check subscription + entitlement after the one-time code is consumed.
  // A canceled/suspended membership therefore cannot create a product session.
  const membership = await getHockeyMembershipSnapshot(launch.identity.authUserId);
  if (!membership.hasAhmvAccess || membership.identityId !== launch.identityId) {
    throw new ServiceError("forbidden", "AHMV access is no longer active.");
  }

  const defaultExpiry = new Date(Date.now() + EXPERIENCE_SESSION_TTL_MS);
  const periodEnd = membership.currentPeriodEnd
    ? new Date(membership.currentPeriodEnd)
    : null;
  const expiresAt =
    periodEnd && periodEnd > now && periodEnd < defaultExpiry
      ? periodEnd
      : defaultExpiry;

  const displayName = [launch.identity.firstName, launch.identity.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    active: true as const,
    identityId: launch.identityId,
    displayName: displayName || null,
    product: AHMV_PRODUCT_CODE,
    entitlement: AHMV_ACCESS_ENTITLEMENT,
    planCode: membership.planCode,
    status: membership.status,
    expiresAt: expiresAt.toISOString(),
  };
}


export async function introspectAhmvExperienceIdentity(identityId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "AHMV access is temporarily unavailable.");
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { id: identityId },
    select: { authUserId: true, accountStatus: true },
  });

  if (
    !identity?.authUserId ||
    (identity.accountStatus && identity.accountStatus !== "active")
  ) {
    return { active: false as const };
  }

  const membership = await getHockeyMembershipSnapshot(identity.authUserId);
  if (!membership.hasAhmvAccess || membership.identityId !== identityId) {
    return { active: false as const };
  }

  return {
    active: true as const,
    product: AHMV_PRODUCT_CODE,
    entitlement: AHMV_ACCESS_ENTITLEMENT,
    planCode: membership.planCode,
    status: membership.status,
    currentPeriodEnd: membership.currentPeriodEnd,
  };
}
