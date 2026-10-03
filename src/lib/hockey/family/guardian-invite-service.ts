import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_INVITES_PER_FAMILY = 5;
const TOKEN_RE = /^[A-Za-z0-9_-]{43,128}$/;

function tokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function memberCode(): string {
  return `HM-${randomUUID()}`;
}

async function requireIdentity(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Family invitations are temporarily unavailable.",
    );
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      accountStatus: true,
    },
  });

  if (!identity) {
    throw new ServiceError(
      "forbidden",
      "Verify your TAKATAK identity before managing hockey-family invitations.",
    );
  }

  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  return { prisma, identity };
}

async function requireGuardianAccess(identityId: string, familyId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Family invitations are temporarily unavailable.",
    );
  }

  const member = await prisma.hockeyFamilyMember.findFirst({
    where: {
      familyId,
      linkedIdentityId: identityId,
      memberType: "guardian",
      status: "active",
      family: {
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        status: "active",
      },
    },
    select: { id: true },
  });

  if (!member) {
    throw new ServiceError(
      "forbidden",
      "This TAKATAK identity cannot manage invitations for that hockey family.",
    );
  }
}

async function expireStaleInvites(familyId: string, now: Date) {
  const prisma = getPrisma();
  if (!prisma) return;

  await prisma.hockeyFamilyInvite.updateMany({
    where: {
      familyId,
      status: "pending",
      expiresAt: { lte: now },
    },
    data: {
      status: "expired",
    },
  });
}

export async function createHockeyFamilyGuardianInvite(input: {
  authUserId: string;
  familyId: string;
  now?: Date;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);
  await requireGuardianAccess(identity.id, input.familyId);

  const now = input.now ?? new Date();
  await expireStaleInvites(input.familyId, now);

  const activeCount = await prisma.hockeyFamilyInvite.count({
    where: {
      familyId: input.familyId,
      status: "pending",
      expiresAt: { gt: now },
    },
  });

  if (activeCount >= MAX_ACTIVE_INVITES_PER_FAMILY) {
    throw new ServiceError(
      "conflict",
      "Too many active guardian invitations. Revoke one before creating another.",
    );
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  const invite = await prisma.hockeyFamilyInvite.create({
    data: {
      familyId: input.familyId,
      inviterIdentityId: identity.id,
      tokenHash: tokenHash(token),
      role: "guardian",
      status: "pending",
      expiresAt,
    },
    select: {
      id: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return {
    invite: {
      ...invite,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    },
    token,
  };
}

export async function listHockeyFamilyGuardianInvites(input: {
  authUserId: string;
  familyId: string;
  now?: Date;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);
  await requireGuardianAccess(identity.id, input.familyId);

  const now = input.now ?? new Date();
  await expireStaleInvites(input.familyId, now);

  const invites = await prisma.hockeyFamilyInvite.findMany({
    where: {
      familyId: input.familyId,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      role: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      createdAt: true,
      inviterIdentityId: true,
      acceptedIdentityId: true,
    },
  });

  return invites.map((invite) => ({
    id: invite.id,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    revokedAt: invite.revokedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    createdByCurrentIdentity: invite.inviterIdentityId === identity.id,
    accepted: Boolean(invite.acceptedIdentityId),
  }));
}

export async function revokeHockeyFamilyGuardianInvite(input: {
  authUserId: string;
  familyId: string;
  inviteId: string;
  now?: Date;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);
  await requireGuardianAccess(identity.id, input.familyId);

  const now = input.now ?? new Date();
  const result = await prisma.hockeyFamilyInvite.updateMany({
    where: {
      id: input.inviteId,
      familyId: input.familyId,
      status: "pending",
    },
    data: {
      status: "revoked",
      revokedAt: now,
    },
  });

  return { revoked: result.count === 1 };
}

export async function acceptHockeyFamilyGuardianInvite(input: {
  authUserId: string;
  token: string;
  now?: Date;
}) {
  const token = input.token.trim();
  if (!TOKEN_RE.test(token)) {
    throw new ServiceError("invalid_input", "Guardian invitation token is invalid.");
  }

  const { prisma, identity } = await requireIdentity(input.authUserId);
  const now = input.now ?? new Date();
  const hash = tokenHash(token);

  const invite = await prisma.hockeyFamilyInvite.findUnique({
    where: { tokenHash: hash },
    select: {
      id: true,
      familyId: true,
      inviterIdentityId: true,
      role: true,
      status: true,
      expiresAt: true,
      family: {
        select: {
          sourceApplication: true,
          status: true,
        },
      },
    },
  });

  if (!invite) {
    throw new ServiceError("not_found", "Guardian invitation was not found.");
  }

  if (
    invite.family.sourceApplication !== HOCKEY_SOURCE_APPLICATION ||
    invite.family.status !== "active"
  ) {
    throw new ServiceError("not_found", "Hockey family is not active.");
  }

  if (invite.status !== "pending") {
    throw new ServiceError(
      "conflict",
      "Guardian invitation has already been used, revoked or expired.",
    );
  }

  if (invite.expiresAt.getTime() <= now.getTime()) {
    await prisma.hockeyFamilyInvite.updateMany({
      where: { id: invite.id, status: "pending" },
      data: { status: "expired" },
    });
    throw new ServiceError("conflict", "Guardian invitation has expired.");
  }

  if (invite.inviterIdentityId === identity.id) {
    throw new ServiceError(
      "conflict",
      "You cannot accept your own guardian invitation.",
    );
  }

  const displayName =
    [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim() ||
    "Parent";

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.hockeyFamilyInvite.updateMany({
      where: {
        id: invite.id,
        status: "pending",
        expiresAt: { gt: now },
      },
      data: {
        status: "accepted",
        acceptedIdentityId: identity.id,
        acceptedAt: now,
      },
    });

    if (claimed.count !== 1) {
      throw new ServiceError(
        "conflict",
        "Guardian invitation is no longer available.",
      );
    }

    const guardian = await tx.hockeyFamilyMember.upsert({
      where: {
        familyId_linkedIdentityId: {
          familyId: invite.familyId,
          linkedIdentityId: identity.id,
        },
      },
      update: {
        memberType: "guardian",
        displayName,
        status: "active",
      },
      create: {
        familyId: invite.familyId,
        linkedIdentityId: identity.id,
        memberCode: memberCode(),
        memberType: "guardian",
        displayName,
        status: "active",
      },
      select: {
        id: true,
        memberCode: true,
        memberType: true,
        displayName: true,
      },
    });

    return {
      familyId: invite.familyId,
      guardian,
      acceptedAt: now.toISOString(),
    };
  });
}

export function hashHockeyFamilyInviteTokenForTest(token: string): string {
  return tokenHash(token);
}
