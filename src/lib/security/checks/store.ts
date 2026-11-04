import "server-only";

import type { PrismaClient } from "@prisma/client";

import { matchChoices } from "./numbers";

/**
 * Security screens (docs/security/SECURITY_SCREENS.md).
 *
 * support_identity — a TAKATAK agent on a call asks the system to check that
 *   the person on the line is the account holder. The person's signed-in
 *   devices show « Êtes-vous en contact avec le soutien TAKATAK ? » and three
 *   numbers; the agent reads out the right one. Expires after 3 minutes.
 * new_sign_in — a browser the account never used before signs in. Every other
 *   signed-in device of that person is asked « C'était vous ? » and must tap the
 *   number shown on the new device; « Ce n'était pas moi » closes the other
 *   sessions (server.ts). Expires after 24 hours.
 *
 * The number to tap is never sent to the device that must tap it.
 */

export const SUPPORT_CHECK_TTL_MS = 3 * 60_000;
export const SIGN_IN_CHECK_TTL_MS = 24 * 60 * 60_000;
/** One tap, like Google: a blind tap passes one time in three, never two in three. */
export const MAX_ATTEMPTS = 1;
const MAX_PENDING_SUPPORT_CHECKS = 3;

export type CheckKind = "support_identity" | "new_sign_in";
export type CheckStatus = "pending" | "confirmed" | "denied" | "mismatch" | "expired";

type Db = Pick<PrismaClient, "securityCheck" | "securityDevice" | "profile" | "auditLog" | "$transaction">;

/** What a device that must answer may see: never the number to tap. */
export type PendingPrompt = {
  id: string;
  kind: CheckKind;
  choices: number[];
  deviceLabel: string | null;
  ipHint: string | null;
  createdAt: string;
  expiresAt: string;
};

async function audit(db: Db, input: { profileId: string; action: string; checkId: string; metadata?: Record<string, unknown> }) {
  await db.auditLog.create({
    data: {
      profileId: input.profileId,
      action: input.action,
      entityType: "security_check",
      entityId: input.checkId,
      metadata: (input.metadata ?? {}) as object,
    },
  });
}

/** Close every pending check whose time is up (cheap; runs before each read). */
async function expireStale(db: Db, profileId: string, now: Date) {
  await db.securityCheck.updateMany({
    where: { profileId, status: "pending", expiresAt: { lte: now } },
    data: { status: "expired" },
  });
}

export type CreateSupportResult =
  | { ok: true; checkId: string; matchNumber: number; expiresAt: string }
  | { ok: false; code: "not_found" | "self" | "disabled" | "too_many" };

/** A TAKATAK agent (platform owner/admin, checked by the caller) starts an identity check. */
export async function createSupportCheck(
  db: Db,
  input: { agentProfileId: string; targetProfileId: string; now?: Date },
): Promise<CreateSupportResult> {
  const now = input.now ?? new Date();
  if (input.agentProfileId === input.targetProfileId) return { ok: false, code: "self" };
  const target = await db.profile.findUnique({ where: { id: input.targetProfileId }, select: { id: true, status: true } });
  if (!target) return { ok: false, code: "not_found" };
  if (target.status === "disabled") return { ok: false, code: "disabled" };
  await expireStale(db, target.id, now);
  const pending = await db.securityCheck.count({ where: { profileId: target.id, kind: "support_identity", status: "pending" } });
  if (pending >= MAX_PENDING_SUPPORT_CHECKS) return { ok: false, code: "too_many" };

  const { matchNumber, choices } = matchChoices();
  const check = await db.securityCheck.create({
    data: {
      profileId: target.id,
      kind: "support_identity",
      matchNumber,
      choices,
      requestedByProfileId: input.agentProfileId,
      expiresAt: new Date(now.getTime() + SUPPORT_CHECK_TTL_MS),
    },
  });
  await audit(db, {
    profileId: target.id,
    action: "security.support_check.requested",
    checkId: check.id,
    metadata: { requestedBy: input.agentProfileId },
  });
  return { ok: true, checkId: check.id, matchNumber, expiresAt: check.expiresAt.toISOString() };
}

export type AgentView = {
  status: CheckStatus;
  matchNumber: number;
  expiresAt: string;
  respondedAt: string | null;
};

/** The agent who asked (and only that agent) follows the answer live. */
export async function agentCheckStatus(
  db: Db,
  input: { checkId: string; agentProfileId: string; now?: Date },
): Promise<AgentView | null> {
  const now = input.now ?? new Date();
  const check = await db.securityCheck.findUnique({ where: { id: input.checkId } });
  if (!check || check.kind !== "support_identity" || check.requestedByProfileId !== input.agentProfileId) return null;
  if (check.status === "pending" && check.expiresAt <= now) {
    await db.securityCheck.update({ where: { id: check.id }, data: { status: "expired" } });
    check.status = "expired";
  }
  return {
    status: check.status as CheckStatus,
    matchNumber: check.matchNumber,
    expiresAt: check.expiresAt.toISOString(),
    respondedAt: check.respondedAt?.toISOString() ?? null,
  };
}

export type DeviceSeenResult = {
  isNew: boolean;
  /** Set when this new device must show a number to the person's other devices. */
  signInCheck: { checkId: string; matchNumber: number; expiresAt: string } | null;
};

/**
 * Called once per browser session from the dashboard. A device id the account
 * has never used is recorded; if the account already had other devices, a
 * new_sign_in check is opened for them (the first device of an account is not
 * a "new sign-in", it is the account's first sign-in).
 */
export async function noteDeviceSeen(
  db: Db,
  input: { profileId: string; deviceId: string; label: string; ipHint: string | null; now?: Date },
): Promise<DeviceSeenResult> {
  const now = input.now ?? new Date();
  const known = await db.securityDevice.findUnique({
    where: { profileId_deviceId: { profileId: input.profileId, deviceId: input.deviceId } },
  });
  if (known) {
    await db.securityDevice.update({ where: { id: known.id }, data: { lastSeenAt: now } });
    return { isNew: false, signInCheck: null };
  }
  const others = await db.securityDevice.count({ where: { profileId: input.profileId } });
  await db.securityDevice.create({
    data: { profileId: input.profileId, deviceId: input.deviceId, label: input.label, firstSeenAt: now, lastSeenAt: now },
  });
  if (others === 0) return { isNew: true, signInCheck: null };

  const { matchNumber, choices } = matchChoices();
  const check = await db.securityCheck.create({
    data: {
      profileId: input.profileId,
      kind: "new_sign_in",
      matchNumber,
      choices,
      deviceId: input.deviceId,
      deviceLabel: input.label,
      ipHint: input.ipHint,
      expiresAt: new Date(now.getTime() + SIGN_IN_CHECK_TTL_MS),
    },
  });
  await audit(db, {
    profileId: input.profileId,
    action: "security.new_device",
    checkId: check.id,
    metadata: { deviceLabel: input.label, ipHint: input.ipHint },
  });
  return { isNew: true, signInCheck: { checkId: check.id, matchNumber, expiresAt: check.expiresAt.toISOString() } };
}

/** Questions this device must answer: support checks, and sign-ins of OTHER devices. */
export async function pendingPrompts(
  db: Db,
  input: { profileId: string; deviceId: string | null; now?: Date },
): Promise<PendingPrompt[]> {
  const now = input.now ?? new Date();
  await expireStale(db, input.profileId, now);
  const rows = await db.securityCheck.findMany({
    where: { profileId: input.profileId, status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return rows
    .filter((r) => r.kind === "support_identity" || (r.kind === "new_sign_in" && input.deviceId && r.deviceId !== input.deviceId))
    .map((r) => ({
      id: r.id,
      kind: r.kind as CheckKind,
      choices: r.choices,
      deviceLabel: r.deviceLabel,
      ipHint: r.ipHint,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
    }));
}

/** The new device follows its own sign-in check (to show the number, then « Connexion approuvée »). */
export async function ownSignInCheck(
  db: Db,
  input: { profileId: string; deviceId: string; now?: Date },
): Promise<{ checkId: string; status: CheckStatus; matchNumber: number; expiresAt: string } | null> {
  const now = input.now ?? new Date();
  await expireStale(db, input.profileId, now);
  const check = await db.securityCheck.findFirst({
    where: { profileId: input.profileId, kind: "new_sign_in", deviceId: input.deviceId },
    orderBy: { createdAt: "desc" },
  });
  if (!check) return null;
  return { checkId: check.id, status: check.status as CheckStatus, matchNumber: check.matchNumber, expiresAt: check.expiresAt.toISOString() };
}

export type RespondResult =
  | { ok: true; status: "confirmed" | "denied" | "mismatch"; kind: CheckKind }
  | { ok: true; status: "wrong_number"; kind: CheckKind; attemptsLeft: number }
  | { ok: false; code: "not_found" | "closed" | "expired" | "own_device" };

/**
 * The person answers on one of their devices: a number, or « Ce n'est pas moi ».
 * A wrong number closes the check as a mismatch (MAX_ATTEMPTS = 1): the agent
 * sees it, or the sign-in is treated as not confirmed. The agent can start a
 * new check if the person simply mistapped.
 */
export async function respondToCheck(
  db: Db,
  input: { profileId: string; checkId: string; deviceId: string | null; answer: number | "not_me"; now?: Date },
): Promise<RespondResult> {
  const now = input.now ?? new Date();
  const check = await db.securityCheck.findUnique({ where: { id: input.checkId } });
  if (!check || check.profileId !== input.profileId) return { ok: false, code: "not_found" };
  const kind = check.kind as CheckKind;
  if (check.status !== "pending") return { ok: false, code: "closed" };
  if (check.expiresAt <= now) {
    await db.securityCheck.update({ where: { id: check.id }, data: { status: "expired" } });
    return { ok: false, code: "expired" };
  }
  if (kind === "new_sign_in" && (!input.deviceId || input.deviceId === check.deviceId)) {
    return { ok: false, code: "own_device" };
  }

  const close = async (status: "confirmed" | "denied" | "mismatch") => {
    // Only a still-pending check can close: two devices answering at once cannot both win.
    const done = await db.securityCheck.updateMany({
      where: { id: check.id, status: "pending" },
      data: { status, respondedAt: now, responseDeviceId: input.deviceId, attempts: { increment: 1 } },
    });
    if (done.count === 0) return { ok: false as const, code: "closed" as const };
    await audit(db, { profileId: input.profileId, action: `security.${kind}.${status}`, checkId: check.id });
    return { ok: true as const, status, kind };
  };

  if (input.answer === "not_me") return close("denied");
  if (input.answer === check.matchNumber) return close("confirmed");

  const attempts = check.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) return close("mismatch");
  const bumped = await db.securityCheck.updateMany({
    where: { id: check.id, status: "pending", attempts: check.attempts },
    data: { attempts },
  });
  if (bumped.count === 0) return { ok: false, code: "closed" };
  await audit(db, { profileId: input.profileId, action: `security.${kind}.wrong_number`, checkId: check.id });
  return { ok: true, status: "wrong_number", kind, attemptsLeft: MAX_ATTEMPTS - attempts };
}
