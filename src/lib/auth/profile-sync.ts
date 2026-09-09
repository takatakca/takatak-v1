import type { User } from "@supabase/supabase-js";
import { ensureDefaultSocialSubscription } from "@/lib/billing/social/ensure-free-subscription";
import { getPrisma } from "@/lib/db/prisma";
import {
  normalizeEmail,
  normalizePersonName,
  validateFirstName,
  validateLastName,
} from "@/lib/auth/registration-validation";
import { getSessionUser } from "@/lib/auth/supabase-server";

export type ProfileSyncOutcome =
  | { outcome: "existing"; profileId: string }
  | { outcome: "created"; profileId: string }
  | { outcome: "updated"; profileId: string }
  | { outcome: "unavailable" }
  | { outcome: "denied" }
  | { outcome: "error" };


export type ProfileSyncOptions = {
  createPersonalWorkspace?: boolean;
};


function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function getMetadataName(
  user: User,
  key: "first_name" | "last_name",
): string | null {
  const value = user.user_metadata?.[key];

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = normalizePersonName(value);

  const validationError =
    key === "first_name"
      ? validateFirstName(normalizedValue)
      : validateLastName(normalizedValue);

  return validationError ? null : normalizedValue;
}

function getProfileIdentity(user: User): {
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  emailVerified: boolean;
} | null {
  if (!user.email) {
    return null;
  }

  const email = normalizeEmail(user.email);
  const firstName = getMetadataName(user, "first_name");
  const lastName = getMetadataName(user, "last_name");
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    email,
    firstName,
    lastName,
    displayName: fullName || email.split("@")[0] || "User",
    emailVerified: Boolean(user.email_confirmed_at),
  };
}

export async function ensurePersonalClientWorkspace(
  profileId: string,
  email: string,
  displayName: string,
): Promise<void> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new Error("Database is unavailable.");
  }

  const existingMembership =
    await prisma.clientMembership.findFirst({
      where: {
        profileId,
      },
      select: {
        id: true,
        clientId: true,
      },
    });

  if (existingMembership) {
    await ensureDefaultSocialSubscription(
      prisma,
      existingMembership.clientId,
    );
    return;
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.client.createMany({
      data: [
        {
          id: profileId,
          name: `${displayName}'s Workspace`,
          email,
          companyName: null,
          status: "active",
          assignedProfileId: profileId,
        },
      ],
      skipDuplicates: true,
    });

    const membershipResult =
      await transaction.clientMembership.createMany({
        data: [
          {
            profileId,
            clientId: profileId,
            role: "owner",
          },
        ],
        skipDuplicates: true,
      });

    await ensureDefaultSocialSubscription(transaction, profileId);

    if (membershipResult.count === 1) {
      await transaction.auditLog.create({
        data: {
          profileId,
          clientId: profileId,
          action: "personal_workspace_created",
          entityType: "Client",
          entityId: profileId,
          metadata: {
            source: "verified_registration",
          },
        },
      });
    }
  });
}

export async function ensureProfileForSupabaseUser(
  user: User,
  options: ProfileSyncOptions = {},
): Promise<ProfileSyncOutcome> {
  const shouldCreatePersonalWorkspace =
    options.createPersonalWorkspace !== false;
  const prisma = getPrisma();

  if (!prisma) {
    return { outcome: "unavailable" };
  }

  const identity = getProfileIdentity(user);

  if (!identity) {
    return { outcome: "error" };
  }

  try {
    const existingProfile = await prisma.profile.findUnique({
      where: {
        authUserId: user.id,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        status: true,
        _count: {
          select: {
            memberships: true,
          },
        },
      },
    });

    if (existingProfile) {
      const firstName =
        identity.firstName ?? existingProfile.firstName;

      const lastName =
        identity.lastName ?? existingProfile.lastName;

      const displayName =
        identity.firstName || identity.lastName
          ? identity.displayName
          : existingProfile.displayName || identity.displayName;

      const status =
        existingProfile.status === "disabled"
          ? "disabled"
          : identity.emailVerified
            ? "active"
            : existingProfile.status;

      const requiresUpdate =
        existingProfile.email !== identity.email ||
        existingProfile.firstName !== firstName ||
        existingProfile.lastName !== lastName ||
        existingProfile.displayName !== displayName ||
        existingProfile.status !== status;

      const hasWorkspace = existingProfile._count.memberships > 0;

      if (!requiresUpdate) {
        if (
          shouldCreatePersonalWorkspace &&
          identity.emailVerified &&
          existingProfile.status !== "disabled" &&
          !hasWorkspace
        ) {
          await ensurePersonalClientWorkspace(
            existingProfile.id,
            identity.email,
            displayName,
          );
        }

        return {
          outcome: "existing",
          profileId: existingProfile.id,
        };
      }

      const updatedProfile = await prisma.profile.update({
        where: {
          id: existingProfile.id,
        },
        data: {
          email: identity.email,
          firstName,
          lastName,
          displayName,
          status,
        },
      });
  
      if (
        shouldCreatePersonalWorkspace &&
        identity.emailVerified &&
        updatedProfile.status !== "disabled" &&
        !hasWorkspace
      ) {
        await ensurePersonalClientWorkspace(
          updatedProfile.id,
          identity.email,
          displayName,
        );
      }
  
      return {
        outcome: "updated",
        profileId: updatedProfile.id,
      };
    }

    const createdProfile = await prisma.profile.create({
      data: {
        authUserId: user.id,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        displayName: identity.displayName,
        role: "user",
        status: identity.emailVerified ? "active" : "invited",
      },
    });

    if (
      shouldCreatePersonalWorkspace &&
      identity.emailVerified &&
      createdProfile.status !== "disabled"
    ) {
      await ensurePersonalClientWorkspace(
        createdProfile.id,
        identity.email,
        identity.displayName,
      );
    }

    return {
      outcome: "created",
      profileId: createdProfile.id,
    };

  } catch (error) {
    if (isUniqueConstraintError(error)) {
      try {
        const concurrentProfile = await prisma.profile.findUnique({
          where: {
            authUserId: user.id,
          },
          select: {
            id: true,
          },
        });

        if (concurrentProfile) {
          return {
            outcome: "existing",
            profileId: concurrentProfile.id,
          };
        }
      } catch {
        return { outcome: "error" };
      }
    }

    console.error(
      "[profile-sync] Profile synchronization failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return { outcome: "error" };
  }
}

export async function ensureProfileForAuthenticatedUser(): Promise<ProfileSyncOutcome> {
  const user = await getSessionUser();

  if (!user) {
    return { outcome: "denied" };
  }

  return ensureProfileForSupabaseUser(user);
}