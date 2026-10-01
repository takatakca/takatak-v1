import type { User } from '@supabase/supabase-js';
import { ensureDefaultSocialSubscription } from '@/lib/billing/social/ensure-default-subscription';
import { getPrisma } from '@/lib/db/prisma';
import {
  normalizeEmail,
  normalizePersonName,
  validateEmail,
  validateFirstName,
  validateLastName,
} from '@/lib/auth/registration-validation';
import { getSessionUser } from '@/lib/auth/supabase-server';
import { normalizePhone } from '@/lib/auth/otp/phone';

export type ProfileSyncOutcome =
  | { outcome: 'existing'; profileId: string }
  | { outcome: 'created'; profileId: string }
  | { outcome: 'updated'; profileId: string }
  | { outcome: 'unavailable' }
  | { outcome: 'denied' }
  | { outcome: 'error' };

export type ProfileSyncOptions = {
  createPersonalWorkspace?: boolean;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function getMetadataName(
  user: User,
  key: 'first_name' | 'last_name',
): string | null {
  const value = user.user_metadata?.[key];

  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = normalizePersonName(value);

  const validationError =
    key === 'first_name'
      ? validateFirstName(normalizedValue)
      : validateLastName(normalizedValue);

  return validationError ? null : normalizedValue;
}

function getProfileIdentity(user: User): {
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  verified: boolean;
} | null {
  const authEmail =
    typeof user.email === 'string' && user.email.trim()
      ? normalizeEmail(user.email)
      : '';
  const metadataEmail =
    typeof user.user_metadata?.email === 'string'
      ? normalizeEmail(user.user_metadata.email)
      : '';
  const email = authEmail || metadataEmail;

  if (!email || validateEmail(email)) {
    return null;
  }

  const authPhone =
    typeof user.phone === 'string' ? normalizePhone(user.phone) : null;
  const metadataPhone =
    typeof user.user_metadata?.phone === 'string'
      ? normalizePhone(user.user_metadata.phone)
      : null;
  const phone = authPhone || metadataPhone;

  const firstName = getMetadataName(user, 'first_name');
  const lastName = getMetadataName(user, 'last_name');
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const emailVerified = Boolean(authEmail && user.email_confirmed_at);
  const phoneVerified = Boolean(authPhone && user.phone_confirmed_at);

  return {
    email,
    phone,
    firstName,
    lastName,
    displayName: fullName || email.split('@')[0] || 'User',
    emailVerified,
    phoneVerified,
    verified: emailVerified || phoneVerified,
  };
}

type PrismaClientInstance = NonNullable<ReturnType<typeof getPrisma>>;

async function ensureMasterIdentityForVerifiedProfile(
  prisma: PrismaClientInstance,
  input: {
    profileId: string;
    email: string;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    registeredAt?: Date | null;
  },
): Promise<boolean> {
  if (!input.emailVerified && !input.phoneVerified) {
    return true;
  }

  return prisma.$transaction(async (transaction) => {
    const [currentIdentity, emailIdentity, phoneIdentity] = await Promise.all([
      transaction.masterIdentity.findUnique({
        where: { profileId: input.profileId },
      }),
      input.emailVerified
        ? transaction.masterIdentity.findUnique({
            where: { primaryEmail: input.email },
          })
        : Promise.resolve(null),
      input.phoneVerified && input.phone
        ? transaction.masterIdentity.findUnique({
            where: { primaryPhone: input.phone },
          })
        : Promise.resolve(null),
    ]);

    if (
      emailIdentity &&
      phoneIdentity &&
      emailIdentity.id !== phoneIdentity.id
    ) {
      return false;
    }

    for (const identity of [emailIdentity, phoneIdentity]) {
      if (identity?.profileId && identity.profileId !== input.profileId) {
        return false;
      }
    }

    if (currentIdentity) {
      if (
        (emailIdentity && emailIdentity.id !== currentIdentity.id) ||
        (phoneIdentity && phoneIdentity.id !== currentIdentity.id)
      ) {
        return false;
      }

      await transaction.masterIdentity.update({
        where: { id: currentIdentity.id },
        data: {
          primaryEmail: input.emailVerified
            ? input.email
            : currentIdentity.primaryEmail,
          primaryEmailVerified:
            currentIdentity.primaryEmailVerified || input.emailVerified,
          primaryPhone:
            input.phoneVerified && input.phone
              ? input.phone
              : currentIdentity.primaryPhone,
          primaryPhoneVerified:
            currentIdentity.primaryPhoneVerified || input.phoneVerified,
          firstName: currentIdentity.firstName ?? input.firstName,
          lastName: currentIdentity.lastName ?? input.lastName,
          registeredAt:
            currentIdentity.registeredAt ?? input.registeredAt ?? undefined,
          accountStatus: currentIdentity.accountStatus ?? 'active',
        },
      });

      return true;
    }

    const candidateIdentity = phoneIdentity ?? emailIdentity;

    if (candidateIdentity) {
      await transaction.masterIdentity.update({
        where: { id: candidateIdentity.id },
        data: {
          profileId: input.profileId,
          primaryEmail: input.emailVerified
            ? input.email
            : candidateIdentity.primaryEmail,
          primaryEmailVerified:
            candidateIdentity.primaryEmailVerified || input.emailVerified,
          primaryPhone:
            input.phoneVerified && input.phone
              ? input.phone
              : candidateIdentity.primaryPhone,
          primaryPhoneVerified:
            candidateIdentity.primaryPhoneVerified || input.phoneVerified,
          firstName: candidateIdentity.firstName ?? input.firstName,
          lastName: candidateIdentity.lastName ?? input.lastName,
          registeredAt:
            candidateIdentity.registeredAt ?? input.registeredAt ?? undefined,
          accountStatus: candidateIdentity.accountStatus ?? 'active',
        },
      });

      return true;
    }

    await transaction.masterIdentity.create({
      data: {
        profileId: input.profileId,
        primaryEmail: input.emailVerified ? input.email : null,
        primaryEmailVerified: input.emailVerified,
        primaryPhone:
          input.phoneVerified && input.phone ? input.phone : null,
        primaryPhoneVerified: input.phoneVerified,
        firstName: input.firstName,
        lastName: input.lastName,
        registeredAt: input.registeredAt ?? undefined,
        accountStatus: 'active',
      },
    });

    return true;
  });
}
export async function ensurePersonalClientWorkspace(
  profileId: string,
  email: string,
  displayName: string,
): Promise<void> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new Error('Database is unavailable.');
  }

  const existingMembership = await prisma.clientMembership.findFirst({
    where: {
      profileId,
    },
    select: {
      id: true,
      clientId: true,
    },
  });

  if (existingMembership) {
    await ensureDefaultSocialSubscription(prisma, existingMembership.clientId);
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
          status: 'active',
          assignedProfileId: profileId,
        },
      ],
      skipDuplicates: true,
    });

    const membershipResult = await transaction.clientMembership.createMany({
      data: [
        {
          profileId,
          clientId: profileId,
          role: 'owner',
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
          action: 'personal_workspace_created',
          entityType: 'Client',
          entityId: profileId,
          metadata: {
            source: 'verified_registration',
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
    return { outcome: 'unavailable' };
  }

  const identity = getProfileIdentity(user);

  if (!identity) {
    return { outcome: 'error' };
  }

  try {
    const existingProfile = await prisma.profile.findUnique({
      where: {
        authUserId: user.id,
      },
      select: {
        id: true,
        email: true,
        phone: true,
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
      const firstName = identity.firstName ?? existingProfile.firstName;

      const lastName = identity.lastName ?? existingProfile.lastName;

      const displayName =
        identity.firstName || identity.lastName
          ? identity.displayName
          : existingProfile.displayName || identity.displayName;

      const status =
        existingProfile.status === 'disabled'
          ? 'disabled'
          : identity.verified
            ? 'active'
            : existingProfile.status;

      const requiresUpdate =
        existingProfile.email !== identity.email ||
        existingProfile.phone !== identity.phone ||
        existingProfile.firstName !== firstName ||
        existingProfile.lastName !== lastName ||
        existingProfile.displayName !== displayName ||
        existingProfile.status !== status;

      const hasWorkspace = existingProfile._count.memberships > 0;

      if (!requiresUpdate) {
        if (
          shouldCreatePersonalWorkspace &&
          identity.verified &&
          existingProfile.status !== 'disabled' &&
          !hasWorkspace
        ) {
          await ensurePersonalClientWorkspace(
            existingProfile.id,
            identity.email,
            displayName,
          );
        }

        const masterIdentityLinked =
          await ensureMasterIdentityForVerifiedProfile(prisma, {
            profileId: existingProfile.id,
            email: identity.email,
            phone: identity.phone,
            firstName,
            lastName,
            emailVerified: identity.emailVerified,
            phoneVerified: identity.phoneVerified,
            registeredAt: user.created_at ? new Date(user.created_at) : null,
          });

        if (!masterIdentityLinked) {
          console.error(
            '[profile-sync] Verified contact conflicts with another master identity',
          );
          return { outcome: 'denied' };
        }

        return {
          outcome: 'existing',
          profileId: existingProfile.id,
        };
      }

      const updatedProfile = await prisma.profile.update({
        where: {
          id: existingProfile.id,
        },
        data: {
          email: identity.email,
          phone: identity.phone,
          firstName,
          lastName,
          displayName,
          status,
        },
      });

      if (
        shouldCreatePersonalWorkspace &&
        identity.verified &&
        updatedProfile.status !== 'disabled' &&
        !hasWorkspace
      ) {
        await ensurePersonalClientWorkspace(
          updatedProfile.id,
          identity.email,
          displayName,
        );
      }

      const masterIdentityLinked =
        await ensureMasterIdentityForVerifiedProfile(prisma, {
          profileId: updatedProfile.id,
          email: identity.email,
          phone: identity.phone,
          firstName,
          lastName,
          emailVerified: identity.emailVerified,
          phoneVerified: identity.phoneVerified,
          registeredAt: user.created_at ? new Date(user.created_at) : null,
        });

      if (!masterIdentityLinked) {
        console.error(
          '[profile-sync] Verified contact conflicts with another master identity',
        );
        return { outcome: 'denied' };
      }

      return {
        outcome: 'updated',
        profileId: updatedProfile.id,
      };
    }

    const createdProfile = await prisma.profile.create({
      data: {
        authUserId: user.id,
        email: identity.email,
        phone: identity.phone,
        firstName: identity.firstName,
        lastName: identity.lastName,
        displayName: identity.displayName,
        role: 'user',
        status: identity.verified ? 'active' : 'invited',
      },
    });

    if (
      shouldCreatePersonalWorkspace &&
      identity.verified &&
      createdProfile.status !== 'disabled'
    ) {
      await ensurePersonalClientWorkspace(
        createdProfile.id,
        identity.email,
        identity.displayName,
      );
    }

    const masterIdentityLinked =
      await ensureMasterIdentityForVerifiedProfile(prisma, {
        profileId: createdProfile.id,
        email: identity.email,
        phone: identity.phone,
        firstName: identity.firstName,
        lastName: identity.lastName,
        emailVerified: identity.emailVerified,
        phoneVerified: identity.phoneVerified,
        registeredAt: user.created_at ? new Date(user.created_at) : null,
      });

    if (!masterIdentityLinked) {
      console.error(
        '[profile-sync] Verified contact conflicts with another master identity',
      );
      return { outcome: 'denied' };
    }

    return {
      outcome: 'created',
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
            authUserId: true,
          },
        });

        if (concurrentProfile) {
          return {
            outcome: 'existing',
            profileId: concurrentProfile.id,
          };
        }

        const [emailCollision, phoneCollision] = await Promise.all([
          prisma.profile.findUnique({
            where: {
              email: identity.email,
            },
            select: {
              id: true,
              authUserId: true,
            },
          }),
          identity.phone
            ? prisma.profile.findUnique({
                where: {
                  phone: identity.phone,
                },
                select: {
                  id: true,
                  authUserId: true,
                },
              })
            : Promise.resolve(null),
        ]);

        if (emailCollision && emailCollision.authUserId !== user.id) {
          console.error(
            '[profile-sync] Email is already bound to a different auth user',
          );
          return { outcome: 'denied' };
        }

        if (phoneCollision && phoneCollision.authUserId !== user.id) {
          console.error(
            '[profile-sync] Phone is already bound to a different auth user',
          );
          return { outcome: 'denied' };
        }
      } catch {
        return { outcome: 'error' };
      }
    }

    console.error(
      '[profile-sync] Profile synchronization failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    return { outcome: 'error' };
  }
}

export async function ensureProfileForAuthenticatedUser(): Promise<ProfileSyncOutcome> {
  const user = await getSessionUser();

  if (!user) {
    return { outcome: 'denied' };
  }

  return ensureProfileForSupabaseUser(user);
}
