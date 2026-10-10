import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

const REVERS_PRODUCT_CODE = "revers" as const;
const REVERS_ACCESS_ENTITLEMENT = "revers_access" as const;
const REVERS_PLAN_CODE = "revers_community" as const;
const REVERS_SOURCE_APPLICATION = "revers" as const;

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

export function authorizeReversExperienceService(request: Request): boolean {
  const expected = process.env.TAKATAK_REVERS_SERVICE_TOKEN?.trim() ?? "";
  if (!expected) return false;

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;

  return safeSecretEqual(authorization.slice(7).trim(), expected);
}

function reversCallbackUrl(): URL {
  const raw = process.env.REVERS_EXPERIENCE_CALLBACK_URL?.trim() ?? "";
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new ServiceError(
      "unavailable",
      "REVERS experience callback is not configured.",
    );
  }

  if (
    url.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")
  ) {
    throw new ServiceError(
      "unavailable",
      "REVERS experience callback must use HTTPS in production.",
    );
  }

  return url;
}

async function getReversCatalogPlan() {
  const prisma = getPrisma();
  if (!prisma) return null;

  const plan = await prisma.productPlan.findFirst({
    where: {
      product: { code: REVERS_PRODUCT_CODE, status: "active" },
      code: REVERS_PLAN_CODE,
      status: "active",
    },
    select: {
      code: true,
      name: true,
      entitlements: {
        where: { entitlement: { active: true } },
        select: { entitlement: { select: { code: true } } },
      },
    },
  });

  if (!plan) return null;

  return {
    code: plan.code,
    name: plan.name,
    entitlements: plan.entitlements.map((row) => row.entitlement.code),
  };
}

export async function createReversExperienceLaunch(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "REVERS access is temporarily unavailable.",
    );
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!identity) {
    throw new ServiceError(
      "forbidden",
      "TAKATAK master identity is not available for REVERS.",
    );
  }

  const plan = await getReversCatalogPlan();
  if (!plan || !plan.entitlements.includes(REVERS_ACCESS_ENTITLEMENT)) {
    throw new ServiceError(
      "unavailable",
      "REVERS access entitlement is not configured.",
    );
  }

  const existing = await prisma.reversMembership.findUnique({
    where: {
      identityId_sourceApplication: {
        identityId: identity.id,
        sourceApplication: REVERS_SOURCE_APPLICATION,
      },
    },
    select: { status: true, planCode: true },
  });

  if (!existing) {
    await prisma.reversMembership.create({
      data: {
        identityId: identity.id,
        sourceApplication: REVERS_SOURCE_APPLICATION,
        status: "active",
        planCode: plan.code,
        planName: plan.name,
      },
    });
  } else if (existing.status !== "active") {
    throw new ServiceError(
      "forbidden",
      "REVERS access is not active for this identity.",
    );
  }

  const rawCode = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LAUNCH_TTL_MS);

  await prisma.experienceLaunchCode.create({
    data: {
      codeHash: hashLaunchCode(rawCode),
      identityId: identity.id,
      productCode: REVERS_PRODUCT_CODE,
      entitlementCode: REVERS_ACCESS_ENTITLEMENT,
      expiresAt,
    },
  });

  const callback = reversCallbackUrl();
  callback.searchParams.set("code", rawCode);

  return {
    url: callback.toString(),
    expiresAt,
  };
}

export async function exchangeReversExperienceLaunch(rawCode: string) {
  const code = rawCode.trim();

  if (!/^[A-Za-z0-9_-]{32,128}$/.test(code)) {
    throw new ServiceError("forbidden", "Invalid REVERS launch code.");
  }

  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "REVERS access is temporarily unavailable.",
    );
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
    launch.productCode !== REVERS_PRODUCT_CODE ||
    launch.entitlementCode !== REVERS_ACCESS_ENTITLEMENT
  ) {
    throw new ServiceError(
      "forbidden",
      "REVERS launch code is expired or invalid.",
    );
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
    throw new ServiceError(
      "forbidden",
      "REVERS launch code was already used.",
    );
  }

  const membership = await prisma.reversMembership.findUnique({
    where: {
      identityId_sourceApplication: {
        identityId: launch.identityId,
        sourceApplication: REVERS_SOURCE_APPLICATION,
      },
    },
    select: {
      status: true,
      planCode: true,
    },
  });

  const plan = await getReversCatalogPlan();

  if (
    !membership ||
    membership.status !== "active" ||
    !plan ||
    membership.planCode !== plan.code ||
    !plan.entitlements.includes(REVERS_ACCESS_ENTITLEMENT)
  ) {
    throw new ServiceError(
      "forbidden",
      "REVERS access is no longer active.",
    );
  }

  const defaultExpiry = new Date(Date.now() + EXPERIENCE_SESSION_TTL_MS);

  const displayName = [
    launch.identity.firstName,
    launch.identity.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    active: true as const,
    identityId: launch.identityId,
    displayName: displayName || null,
    product: REVERS_PRODUCT_CODE,
    entitlement: REVERS_ACCESS_ENTITLEMENT,
    planCode: plan.code,
    expiresAt: defaultExpiry.toISOString(),
  };
}
