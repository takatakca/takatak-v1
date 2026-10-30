import "server-only";

// ON2GO launch / exchange bridge (contract C3 of docs/ON2GO_HUB_ECOSYSTEM.md in foodhubca, modelled on AHMV's
// experience access): a person signed in on TAKATAK opens on2go.ca with a one-time code (90 s); ON2GO Hub (Food Hub,
// the only ON2GO server) exchanges the code with its own service token for a short session (10 min) that names the
// master identity. No workspace, no Client row: a customer is a MasterIdentity with a verified phone or email.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

export const ON2GO_PRODUCT_CODE = "on2go" as const;
export const ON2GO_CUSTOMER_ENTITLEMENT = "on2go_customer" as const;

const LAUNCH_TTL_MS = 90_000;
const SESSION_TTL_MS = 10 * 60_000;

function hashLaunchCode(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeSecretEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** ON2GO Hub's own service token (never the AHMV one, never a master API key). */
export function authorizeOn2goExperienceService(request: Request): boolean {
  const expected = process.env.TAKATAK_ON2GO_SERVICE_TOKEN?.trim() ?? "";
  if (expected.length < 32) return false;

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  return safeSecretEqual(authorization.slice(7).trim(), expected);
}

/** Where a launch lands: an https page of on2go.ca (or Food Hub) that receives `?code=`. */
export function on2goCallbackUrl(raw = process.env.ON2GO_EXPERIENCE_CALLBACK_URL): URL {
  let url: URL;
  try {
    url = new URL(raw?.trim() ?? "");
  } catch {
    throw new ServiceError("unavailable", "ON2GO launch callback is not configured.");
  }
  if (url.protocol !== "https:") {
    throw new ServiceError("unavailable", "ON2GO launch callback must use HTTPS.");
  }
  return url;
}

export function isLaunchCodeShape(value: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

type IdentityRow = {
  id: string;
  authUserId: string | null;
  accountStatus: string | null;
  firstName: string | null;
  lastName: string | null;
  locale: string | null;
  primaryPhone: string | null;
  primaryPhoneVerified: boolean;
  primaryEmail: string | null;
  primaryEmailVerified: boolean;
};

/** A customer may open ON2GO when the identity is active and one contact (phone or email) is verified. */
export function on2goIdentityUsable(identity: IdentityRow | null | undefined): identity is IdentityRow {
  if (!identity?.authUserId) return false;
  if (identity.accountStatus && identity.accountStatus !== "active") return false;
  return identity.primaryPhoneVerified || identity.primaryEmailVerified;
}

function sessionFor(identity: IdentityRow, expiresAt: Date) {
  const displayName = [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim();
  return {
    active: true as const,
    identityId: identity.id,
    displayName: displayName || null,
    phone: identity.primaryPhoneVerified ? identity.primaryPhone : null,
    email: identity.primaryEmailVerified ? identity.primaryEmail : null,
    locale: identity.locale,
    product: ON2GO_PRODUCT_CODE,
    entitlement: ON2GO_CUSTOMER_ENTITLEMENT,
    expiresAt: expiresAt.toISOString(),
  };
}

const IDENTITY_SELECT = {
  id: true,
  authUserId: true,
  accountStatus: true,
  firstName: true,
  lastName: true,
  locale: true,
  primaryPhone: true,
  primaryPhoneVerified: true,
  primaryEmail: true,
  primaryEmailVerified: true,
} as const;

export async function createOn2goExperienceLaunch(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "ON2GO access is temporarily unavailable.");
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: IDENTITY_SELECT,
  });
  if (!on2goIdentityUsable(identity)) {
    throw new ServiceError("forbidden", "ON2GO access needs a verified phone or email on this TAKATAK account.");
  }

  const rawCode = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LAUNCH_TTL_MS);

  await prisma.experienceLaunchCode.create({
    data: {
      codeHash: hashLaunchCode(rawCode),
      identityId: identity.id,
      productCode: ON2GO_PRODUCT_CODE,
      entitlementCode: ON2GO_CUSTOMER_ENTITLEMENT,
      expiresAt,
    },
  });

  const callback = on2goCallbackUrl();
  callback.searchParams.set("code", rawCode);
  return { url: callback.toString(), expiresAt };
}

export async function exchangeOn2goExperienceLaunch(rawCode: string) {
  const code = rawCode.trim();
  if (!isLaunchCodeShape(code)) {
    throw new ServiceError("forbidden", "Invalid ON2GO launch code.");
  }

  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "ON2GO access is temporarily unavailable.");
  }

  const now = new Date();
  const launch = await prisma.experienceLaunchCode.findUnique({
    where: { codeHash: hashLaunchCode(code) },
    select: {
      id: true,
      identityId: true,
      productCode: true,
      entitlementCode: true,
      expiresAt: true,
      usedAt: true,
      identity: { select: IDENTITY_SELECT },
    },
  });

  if (
    !launch ||
    launch.usedAt ||
    launch.expiresAt <= now ||
    launch.productCode !== ON2GO_PRODUCT_CODE ||
    launch.entitlementCode !== ON2GO_CUSTOMER_ENTITLEMENT
  ) {
    throw new ServiceError("forbidden", "ON2GO launch code is expired or invalid.");
  }

  const consumed = await prisma.experienceLaunchCode.updateMany({
    where: { id: launch.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (consumed.count !== 1) {
    throw new ServiceError("forbidden", "ON2GO launch code was already used.");
  }

  // Re-checked after the one-time code is consumed: a suspended identity never gets a session.
  if (!on2goIdentityUsable(launch.identity)) {
    throw new ServiceError("forbidden", "ON2GO access is no longer active.");
  }

  return sessionFor(launch.identity, new Date(Date.now() + SESSION_TTL_MS));
}

export async function introspectOn2goIdentity(identityId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "ON2GO access is temporarily unavailable.");
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { id: identityId },
    select: IDENTITY_SELECT,
  });
  if (!on2goIdentityUsable(identity)) return { active: false as const };

  return sessionFor(identity, new Date(Date.now() + SESSION_TTL_MS));
}
